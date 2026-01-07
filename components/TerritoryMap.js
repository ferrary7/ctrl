'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSession } from 'next-auth/react';

/**
 * Main map component using MapLibre GL JS
 * Renders territories as polygons with dynamic styling
 * Auto-zooms to user territories on load
 */

export default function TerritoryMap({ 
  initialCenter = [78.9629, 20.5937], // Center of India
  initialZoom = 5,
  onTerritoryClick,
  userLocation,
  externalSelectedTerritory, // Territory selected from outside (battle feed, lists, etc.)
  activityId, // Activity ID from query parameter
  showOnlyActivity // Whether to show only the activity territory
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = useSession();
  const hasAutoZoomed = useRef(false);
  const [stats, setStats] = useState({ 
    territories: 0, 
    area: 0, 
    rank: null,
    captured: 0,
    lost: 0,
    recentActivity: [],
    territoryList: [],
    lostTerritories: []
  });
  const [showStats, setShowStats] = useState(false);
  const [showTerritoryList, setShowTerritoryList] = useState(false);
  const [territoryFilter, setTerritoryFilter] = useState('active'); // 'active' or 'lost'
  const [loadingState, setLoadingState] = useState('Initializing map');
  const [dataLoading, setDataLoading] = useState(false);
  
  // Refs for marker management functions
  const addStartEndMarkersRef = useRef(null);
  const addOverviewMarkersRef = useRef(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const startEndMarkersRef = useRef([]);
  
  // Expose territory list closer to global window for cross-component control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.closeTerritoryList = () => setShowTerritoryList(false);
      return () => {
        delete window.closeTerritoryList;
      };
    }
  }, []);
  
  useEffect(() => {
    if (map.current) return; // Initialize only once
    
    // Use a free OpenStreetMap style if MapTiler key is not configured
    const mapStyle = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE || {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
          maxzoom: 19
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#1a1a1a'
          }
        },
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
    
    setLoadingState('Preparing your view');
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      antialias: true
    });
    
    // Expose map globally for BattleFeed and other components to access
    if (typeof window !== 'undefined') {
      window.ctrlMap = map.current;
    }
    
    // Add error handling
    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });
    
    // Add controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    }), 'top-right');
    
    // Handle missing sprite images
    map.current.on('styleimagemissing', (e) => {
      const id = e.id;
      // Create a blank 1x1 image for missing sprites
      if (!map.current.hasImage(id)) {
        map.current.addImage(id, {
          width: 1,
          height: 1,
          data: new Uint8Array(4)
        });
      }
    });
    
    // Initialize territory layer when map loads
    map.current.on('load', () => {
      setLoaded(true);
      
      // Add territory source (empty initially)
      map.current.addSource('territories', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        promoteId: 'id' // Required for feature state
      });
      
      // Territory fill layer with user colors - lighter for corridors
      map.current.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': [
            'coalesce',
            ['get', 'userColor'],
            '#FF006E' // Default neon pink fallback
          ],
          'fill-opacity': [
            'case',
            // Dimmed state (other territories by same user when one is selected)
            ['boolean', ['feature-state', 'dimmed'], false],
            0.15,
            // Your territories - more opaque
            ['==', ['get', 'userId'], session?.user?.id || ''],
            [
              'case',
              ['==', ['get', 'territoryType'], 'corridor'], 0.35,
              0.5
            ],
            // Other users' territories - less opaque
            [
              'case',
              ['==', ['get', 'territoryType'], 'corridor'], 0.15,
              0.25
            ]
          ]
        }
      });
      
      // Territory border - thicker and more visible
      map.current.addLayer({
        id: 'territory-border',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': [
            'coalesce',
            ['get', 'userColor'],
            '#FF006E'
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 3,
            12, 4,
            16, 6
          ],
          'line-opacity': 1
        }
      });
      
      // Inner white border for contrast
      map.current.addLayer({
        id: 'territory-border-inner',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 1,
            12, 2,
            16, 3
          ],
          'line-opacity': 0.6,
          'line-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, -1.5,
            12, -2.5,
            16, -3.5
          ]
        }
      });
      
      // Outer glow layer for pulsing effect
      map.current.addLayer({
        id: 'territory-glow',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': [
            'coalesce',
            ['get', 'userColor'],
            '#FF006E'
          ],
          'line-width': 6,
          'line-opacity': 0.3,
          'line-blur': 4
        }
      });
      
      // Pulsing animation for glow
      let pulsePhase = 0;
      const animatePulse = () => {
        pulsePhase += 0.02;
        const opacity = 0.2 + Math.sin(pulsePhase) * 0.15;
        const width = 6 + Math.sin(pulsePhase) * 2;
        
        if (map.current && map.current.getLayer('territory-glow')) {
          map.current.setPaintProperty('territory-glow', 'line-opacity', opacity);
          map.current.setPaintProperty('territory-glow', 'line-width', width);
        }
        
        requestAnimationFrame(animatePulse);
      };
      animatePulse();
      
      // Store markers reference
      const overviewMarkers = [];
      
      // Function to add overview markers (pins visible at low zoom)
      const addOverviewMarkers = (geojsonData) => {
        const currentZoom = map.current.getZoom();
        
        // Clear existing markers
        overviewMarkers.forEach(m => m.remove());
        overviewMarkers.length = 0;
        
        // Only show at low zoom (overview level)
        if (currentZoom > 10) return;
        
        if (!geojsonData || !geojsonData.features) return;
        
        geojsonData.features.forEach(feature => {
          if (!feature.geometry || feature.geometry.type !== 'Polygon') return;
          
          // Calculate centroid
          const coords = feature.geometry.coordinates[0];
          if (!coords || coords.length === 0) return;
          
          const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
          const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
          const center = [sumLng / coords.length, sumLat / coords.length];
          
          // Create custom marker element
          const el = document.createElement('div');
          el.className = 'territory-overview-pin';
          el.style.cssText = `
            width: 24px;
            height: 24px;
            background: ${feature.properties.userColor || '#FF006E'};
            border: 3px solid white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          `;
          
          // Add subtle hover glow effect
          el.addEventListener('mouseenter', () => {
            el.style.boxShadow = `0 4px 12px rgba(0,0,0,0.6), 0 0 20px ${feature.properties.userColor || '#FF006E'}80`;
          });
          
          el.addEventListener('mouseleave', () => {
            el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.5)';
          });
          
          // Click handler to open territory info
          el.addEventListener('click', () => {
            if (onTerritoryClick) {
              onTerritoryClick(feature.properties);
            }
          });
          
          // No hover scale effect to prevent repositioning issues
          const marker = new maplibregl.Marker({ 
            element: el,
            anchor: 'center'
          })
            .setLngLat(center)
            .addTo(map.current);
          
          overviewMarkers.push(marker);
        });
      };
      
      // Store start/end markers
      const startEndMarkers = [];
      
      // Function to add start/end point markers (only for selected territory)
      const addStartEndMarkers = (geojsonData, selectedId) => {
        // Clear existing markers
        startEndMarkersRef.current.forEach(m => m.remove());
        startEndMarkersRef.current.length = 0;
        
        // Only show if a territory is selected
        if (!selectedId || !geojsonData || !geojsonData.features) return;
        
        // Find the selected territory - check both feature.id and feature.properties.id
        const selectedFeature = geojsonData.features.find(f => 
          f.id === selectedId || f.properties.id === selectedId
        );
        
        if (!selectedFeature || !selectedFeature.geometry || selectedFeature.geometry.type !== 'Polygon') {
          console.log('Could not find selected territory:', selectedId);
          return;
        }
        
        // Get first and last points of the polygon boundary
        const coords = selectedFeature.geometry.coordinates[0];
        if (!coords || coords.length < 2) return;
        
        const startPoint = coords[0];
        const endPoint = coords[coords.length - 2]; // -2 because last point = first point
        
        const userColor = selectedFeature.properties.userColor || '#FF006E';
        
        // Start marker (green circle with play icon)
        const startEl = document.createElement('div');
        startEl.innerHTML = '▶';
        startEl.style.cssText = `
          width: 32px;
          height: 32px;
          background: #10b981;
          color: white;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 0 rgba(16, 185, 129, 0.4);
          font-weight: bold;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          z-index: 5;
        `;
        
        const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'center' })
          .setLngLat(startPoint)
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false })
              .setHTML(`
                <div style="color: #000; padding: 6px 8px; font-size: 12px;">
                  <strong style="color: #10b981;">● Start</strong><br/>
                  <span style="color: #666; font-size: 11px;">${selectedFeature.properties.name || 'Territory'}</span>
                </div>
              `)
          )
          .addTo(map.current);
        
        startEndMarkersRef.current.push(startMarker);
        
        // End marker (red square with stop icon)
        const endEl = document.createElement('div');
        endEl.innerHTML = '■';
        endEl.style.cssText = `
          width: 32px;
          height: 32px;
          background: #ef4444;
          color: white;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 0 rgba(239, 68, 68, 0.4);
          font-weight: bold;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          animation-delay: 1s;
          z-index: 5;
        `;
        
        const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'center' })
          .setLngLat(endPoint)
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false })
              .setHTML(`
                <div style="color: #000; padding: 6px 8px; font-size: 12px;">
                  <strong style="color: #ef4444;">● End</strong><br/>
                  <span style="color: #666; font-size: 11px;">${selectedFeature.properties.name || 'Territory'}</span>
                </div>
              `)
          )
          .addTo(map.current);
        
        startEndMarkersRef.current.push(endMarker);
      };
      
      // Store the function in ref for external access
      addStartEndMarkersRef.current = addStartEndMarkers;
      addOverviewMarkersRef.current = addOverviewMarkers;
      
      // Hover effect with feature state
      let hoveredFeatureId = null;
      
      map.current.on('mouseenter', 'territory-fill', (e) => {
        map.current.getCanvas().style.cursor = 'pointer';
        
        if (e.features.length > 0 && e.features[0].id) {
          if (hoveredFeatureId !== null) {
            map.current.setFeatureState(
              { source: 'territories', id: hoveredFeatureId },
              { hover: false }
            );
          }
          hoveredFeatureId = e.features[0].id;
          map.current.setFeatureState(
            { source: 'territories', id: hoveredFeatureId },
            { hover: true }
          );
        }
      });
      
      map.current.on('mouseleave', 'territory-fill', () => {
        map.current.getCanvas().style.cursor = '';
        
        if (hoveredFeatureId !== null) {
          map.current.setFeatureState(
            { source: 'territories', id: hoveredFeatureId },
            { hover: false }
          );
        }
        hoveredFeatureId = null;
      });
      
      // Click handler
      if (onTerritoryClick) {
        map.current.on('click', 'territory-fill', (e) => {
          if (e.features.length > 0) {
            const clickedTerritory = e.features[0];
            const territoryId = clickedTerritory.properties.id;
            const userId = clickedTerritory.properties.userId;
            
            // Set selected territory for focus mode
            setSelectedTerritoryId(territoryId);
            
            // Update opacity for all territories by the same user
            const data = map.current.getSource('territories')?._data;
            if (data && data.features) {
              // Reduce opacity for other territories by same user
              data.features.forEach(feature => {
                const featureId = feature.id || feature.properties.id;
                if (feature.properties.userId === userId && featureId !== territoryId) {
                  try {
                    map.current.setFeatureState(
                      { source: 'territories', id: featureId },
                      { dimmed: true }
                    );
                  } catch (e) {
                    // Silently ignore if feature doesn't exist in map
                  }
                } else {
                  try {
                    map.current.setFeatureState(
                      { source: 'territories', id: featureId },
                      { dimmed: false }
                    );
                  } catch (e) {
                    // Silently ignore if feature doesn't exist in map
                  }
                }
              });
              
              // Show start/end markers for selected territory
              addStartEndMarkers(data, territoryId);
            }
            
            onTerritoryClick(clickedTerritory.properties);
          }
        });
        
        // Click on map (not territory) to clear selection
        map.current.on('click', (e) => {
          // Check if click was on a territory
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ['territory-fill']
          });
          
          if (features.length === 0) {
            // Clear selection
            setSelectedTerritoryId(null);
            
            // Clear all dimmed states
            const data = map.current.getSource('territories')?._data;
            if (data && data.features) {
              data.features.forEach(feature => {
                const featureId = feature.id || feature.properties.id;
                try {
                  map.current.setFeatureState(
                    { source: 'territories', id: featureId },
                    { dimmed: false }
                  );
                } catch (e) {
                  // Silently ignore if feature doesn't exist in map
                }
              });
            }
            
            // Clear start/end markers
            startEndMarkersRef.current.forEach(m => m.remove());
            startEndMarkersRef.current.length = 0;
          }
        });
      }
      
      // Load territories when map moves/zooms
      const updateTerritories = async () => {
        if (!map.current || !map.current.getSource) return;
        
        // Don't update territories if we're showing a specific activity
        // The activity territory should stay focused and not be replaced
        if (activityId) return;
        
        setDataLoading(true);
        setLoadingState('Loading territories');
        
        const bounds = map.current.getBounds();
        const zoom = Math.round(map.current.getZoom());
        
        try {
          let url = `/api/tiles?` +
            `minLng=${bounds.getWest()}&` +
            `minLat=${bounds.getSouth()}&` +
            `maxLng=${bounds.getEast()}&` +
            `maxLat=${bounds.getNorth()}&` +
            `zoom=${zoom}`;
          
          const response = await fetch(url);
          
          const data = await response.json();
          
          if (map.current && map.current.getSource) {
            const territoriesSource = map.current.getSource('territories');
            if (territoriesSource) {
              territoriesSource.setData(data);
              
              // Update overview markers
              addOverviewMarkers(data);
              // Update start/end markers only if there's a selected territory
              if (selectedTerritoryId) {
                addStartEndMarkers(data, selectedTerritoryId);
              }
            }
          }
          setDataLoading(false);
        } catch (error) {
          console.error('Failed to load territories:', error);
          setDataLoading(false);
        }
      };
      
      map.current.on('moveend', updateTerritories);
      map.current.on('zoomend', () => {
        // Update markers visibility on zoom
        const data = map.current.getSource('territories')?._data;
        if (data) {
          addOverviewMarkers(data);
          // Only update start/end markers if there's a selected territory
          if (selectedTerritoryId) {
            addStartEndMarkers(data, selectedTerritoryId);
          }
        }
      });
      // Wait a tick for territories source to be fully initialized
      setTimeout(updateTerritories, 100);
      
      // Auto-zoom to user territories after initial load
      if (session && !hasAutoZoomed.current) {
        setTimeout(async () => {
          setLoadingState('Finding your territories');
          try {
            // Fetch territories and profile
            const [territoriesRes, profileRes] = await Promise.all([
              fetch('/api/territories'),
              fetch('/api/user/profile')
            ]);
            
            const territories = await territoriesRes.json();
            const profile = await profileRes.json();
            
            // Try to fetch history (may fail if table doesn't exist)
            let history = [];
            try {
              const historyRes = await fetch('/api/territories/history');
              if (historyRes.ok) {
                history = await historyRes.json();
              }
            } catch (e) {
              console.log('Territory history not available yet');
            }
            
            if (territories && territories.length > 0) {
              // Calculate bounds from all user territories
              const bounds = new maplibregl.LngLatBounds();
              
              territories.forEach(territory => {
                if (territory.geometry && territory.geometry.coordinates) {
                  const coords = territory.geometry.coordinates[0];
                  coords.forEach(coord => {
                    bounds.extend(coord);
                  });
                }
              });
              
              // Fly to bounds with smooth animation
              setLoadingState('Zooming to your empire');
              map.current.fitBounds(bounds, {
                padding: { top: 100, bottom: 100, left: 100, right: 100 },
                maxZoom: 14,
                duration: 2000,
                essential: true
              });
              
              hasAutoZoomed.current = true;
              
              // Calculate comprehensive stats
              const totalArea = territories.reduce((sum, t) => sum + (t.area_sqm || 0), 0);
              const captureHistory = Array.isArray(history) ? history : [];
              const captured = captureHistory.filter(h => h.to_user_id === session.user.id && h.action === 'captured').length;
              const lost = captureHistory.filter(h => h.from_user_id === session.user.id && h.action === 'captured').length;
              const recentActivity = captureHistory.slice(0, 5);
              
              // Get lost territories (captured by others)
              const lostTerritories = captureHistory
                .filter(h => h.from_user_id === session.user.id && h.action === 'captured')
                .map(h => ({
                  id: h.id,
                  name: h.territory_name,
                  area: (h.area_change / 1000000).toFixed(2),
                  capturedBy: h.to_user_name,
                  capturedByColor: h.to_user_color,
                  capturedAt: h.created_at
                }));
              
              setStats({
                territories: territories.length,
                area: totalArea / 1000000, // Convert to km²
                rank: profile?.rank || null,
                captured,
                lost,
                recentActivity,
                territoryList: territories.map(t => ({
                  id: t.id,
                  name: t.name,
                  area: (t.area_sqm / 1000000).toFixed(2),
                  center: t.geometry?.coordinates?.[0]?.[0] || [0, 0],
                  status: 'active'
                })),
                lostTerritories
              });
              
              // Trigger stats fade-in after zoom completes
              setTimeout(() => setShowStats(true), 2500);
            }
          } catch (error) {
            console.error('Failed to auto-zoom to territories:', error);
          }
        }, 500);
      }
      
      setLoaded(true);
    });
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Handle external territory selection (from battle feed, territory lists, etc.)
  useEffect(() => {
    if (!externalSelectedTerritory || !loaded || !map.current) return;
    
    const selectExternalTerritory = async () => {
      try {
        // Get the territory ID
        const territoryId = externalSelectedTerritory.id;
        
        // Avoid infinite loop: don't process if already selected
        if (selectedTerritoryId === territoryId) return;
        
        // Set as selected territory to show start/end markers
        setSelectedTerritoryId(territoryId);
        
        // Get current territories data
        const data = map.current.getSource('territories')?._data;
        if (data) {
          // Clear previous dimmed states - only for features that exist in the map
          if (map.current.getSource('territories')) {
            data.features.forEach((feature) => {
              const featureId = feature.id || feature.properties.id;
              try {
                map.current.removeFeatureState({
                  source: 'territories',
                  id: featureId
                });
              } catch (e) {
                // Silently ignore if feature state doesn't exist
              }
            });
          }
          
          // Find the selected territory feature
          const selectedFeature = data.features.find(f => 
            f.id === territoryId || f.properties.id === territoryId
          );
          
          if (selectedFeature) {
            const selectedUserId = selectedFeature.properties.userId;
            
            // Dim other territories by the same user
            data.features.forEach((feature) => {
              const featureId = feature.id || feature.properties.id;
              if (feature.properties.userId === selectedUserId && featureId !== territoryId) {
                try {
                  map.current.setFeatureState(
                    { source: 'territories', id: featureId },
                    { dimmed: true }
                  );
                } catch (e) {
                  // Silently ignore if feature doesn't exist in map
                }
              }
            });
            
            // Show start/end markers for selected territory using ref
            if (addStartEndMarkersRef.current) {
              addStartEndMarkersRef.current(data, territoryId);
            }
            
            // Only update parent with complete data if external data is incomplete
            // Check if the external data has all required fields
            const hasCompleteData = externalSelectedTerritory.areaSqm && 
                                   externalSelectedTerritory.strength !== undefined && 
                                   externalSelectedTerritory.daysHeld !== undefined;
            
            // Always provide complete data to parent
            if (onTerritoryClick && !hasCompleteData) {
              const completeData = {
                id: selectedFeature.id || selectedFeature.properties.id,
                name: selectedFeature.properties.name,
                userName: selectedFeature.properties.userName,
                userColor: selectedFeature.properties.userColor,
                userId: selectedFeature.properties.userId,
                areaSqm: selectedFeature.properties.areaSqm,
                strength: selectedFeature.properties.strength,
                daysHeld: selectedFeature.properties.daysHeld,
                capturedAt: selectedFeature.properties.capturedAt,
                activityId: selectedFeature.properties.activityId,
                activityType: selectedFeature.properties.activityType,
                territoryType: selectedFeature.properties.territoryType
              };
              onTerritoryClick(completeData);
            }
          }
        }
      } catch (error) {
        console.error('Error selecting external territory:', error);
      }
    };
    
    selectExternalTerritory();
  }, [externalSelectedTerritory, loaded, onTerritoryClick, selectedTerritoryId]);
  
  // Handle activity ID parameter - fetch and zoom to the activity territory
  useEffect(() => {
    if (!activityId || !loaded || !map.current) return;
    
    const selectActivityTerritory = async () => {
      try {
        setLoadingState(`Loading territory...`);
        
        // Fetch the activity territory directly from the API
        const response = await fetch(`/api/territories/by-activity/${activityId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.warn('Activity territory not found - showing normal map:', errorData);
          setLoadingState('Initializing map');
          return; // Silently fail and show normal map
        }
        
        const territory = await response.json();
        
        if (!territory || !territory.geometry) {
          console.log('Activity territory not found:', activityId);
          return;
        }
        
        // Set as selected territory
        setSelectedTerritoryId(territory.id);
        
        // Update map source with this territory
        if (map.current.getSource('territories')) {
          map.current.getSource('territories').setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              id: territory.id,
              properties: {
                id: territory.id,
                userId: territory.user_id,
                userName: territory.users?.name,
                userColor: territory.users?.color,
                name: territory.name,
                areaSqm: territory.area_sqm,
                strength: territory.strength,
                capturedAt: territory.captured_at,
                activityId: territory.activity_id,
                activityType: territory.activity?.type || 'Run',
                territoryType: territory.territory_type || 'polygon'
              },
              geometry: territory.geometry
            }]
          });
        }
        
        // Calculate bounds for this territory and zoom to it
        const coords = territory.geometry.coordinates[0];
        if (coords && coords.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          coords.forEach(coord => {
            bounds.extend(coord);
          });
          
          map.current.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: 15,
            duration: 1500,
            essential: true
          });
        }
        
        // Show the territory card with complete data
        if (onTerritoryClick) {
          onTerritoryClick({
            id: territory.id,
            name: territory.name,
            userName: territory.users?.name,
            userColor: territory.users?.color,
            userId: territory.user_id,
            areaSqm: territory.area_sqm,
            strength: territory.strength,
            capturedAt: territory.captured_at,
            activityId: territory.activity_id,
            activityType: territory.activity?.type || 'Run',
            territoryType: territory.territory_type || 'polygon'
          });
        }
        
        setLoadingState('Initializing map');
      } catch (error) {
        console.error('Error selecting activity territory:', error);
        setLoadingState('Initializing map');
      }
    };
    
    selectActivityTerritory();
  }, [activityId, loaded, onTerritoryClick]);
  
  // Update user location marker
  useEffect(() => {
    if (!loaded || !userLocation) return;
    
    if (!map.current.getSource('user-location')) {
      map.current.addSource('user-location', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: userLocation
          }
        }
      });
      
      map.current.addLayer({
        id: 'user-location',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 8,
          'circle-color': '#3A86FF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    } else {
      map.current.getSource('user-location').setData({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: userLocation
        }
      });
    }
  }, [userLocation, loaded]);
  
  // Fly to a specific territory
  const flyToTerritory = (coords) => {
    if (map.current && coords) {
      map.current.flyTo({
        center: coords,
        zoom: 14,
        duration: 1500
      });
      setShowTerritoryList(false);
    }
  };
  
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      
      {/* Compact mobile-first stats */}
      {loaded && session && stats.territories > 0 && (
        <>
          <div 
            className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-sm z-10 transition-all duration-700 ease-out"
            style={{
              opacity: showStats ? 1 : 0,
              transform: showStats ? 'translateY(0)' : 'translateY(20px)'
            }}
          >
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-xl p-3 md:p-4 shadow-2xl hover:shadow-3xl transition-shadow duration-300">
              {/* Compact grid layout */}
              <div className="grid grid-cols-4 gap-2 md:gap-3 text-center">
                {/* Rank */}
                <div>
                  <div className="text-xl md:text-2xl font-semibold text-white">
                    {stats.rank ? `#${stats.rank}` : '-'}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Rank</div>
                </div>
                
                {/* Active Territories - clickable */}
                <div 
                  onClick={() => {
                    setTerritoryFilter('active');
                    setShowTerritoryList(!showTerritoryList);
                    // Close battle feed and territory card when opening territory list
                    if (typeof window !== 'undefined') {
                      if (window.setBattleFeedVisible) window.setBattleFeedVisible(false);
                      if (window.closeTerritoryCard) window.closeTerritoryCard();
                    }
                  }}
                  className="cursor-pointer hover:bg-zinc-800/50 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95 -m-2 p-2"
                >
                  <div className="text-xl md:text-2xl font-semibold text-emerald-400 transition-colors duration-200">{stats.territories}</div>
                  <div className="text-xs text-zinc-500 mt-1">Active</div>
                </div>
                
                {/* Lost Territories - clickable with warning color */}
                <div 
                  onClick={() => {
                    setTerritoryFilter('lost');
                    setShowTerritoryList(true);
                    // Close battle feed and territory card when opening territory list
                    if (typeof window !== 'undefined') {
                      if (window.setBattleFeedVisible) window.setBattleFeedVisible(false);
                      if (window.closeTerritoryCard) window.closeTerritoryCard();
                    }
                  }}
                  className={`cursor-pointer hover:bg-zinc-800/50 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95 -m-2 p-2 ${stats.lost > 0 ? 'animate-pulse-slow' : ''}`}
                >
                  <div className={`text-xl md:text-2xl font-semibold transition-colors duration-200 ${stats.lost > 0 ? 'text-red-400' : 'text-zinc-600'}`}>{stats.lost}</div>
                  <div className="text-xs text-zinc-500 mt-1">Lost</div>
                  {stats.lost > 0 && (
                    <div className="text-xs text-red-400 mt-0.5">View ↗</div>
                  )}
                </div>
                
                {/* Area */}
                <div>
                  <div className="text-xl md:text-2xl font-semibold text-white">{stats.area.toFixed(1)}</div>
                  <div className="text-xs text-zinc-500 mt-1">km²</div>
                </div>
              </div>
              
              {/* Combat stats row - only show if there's activity */}
              {(stats.captured > 0 || stats.lost > 0) && (
                <>
                  <div className="border-t border-zinc-800 my-2 md:my-3" />
                  <div className="flex items-center justify-center gap-3 md:gap-4 text-xs md:text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="font-medium text-white">{stats.captured}</span>
                    </div>
                    <span className="text-zinc-600">:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="font-medium text-white">{stats.lost}</span>
                    </div>
                    {stats.captured + stats.lost > 0 && (
                      <>
                        <span className="text-zinc-700">|</span>
                        <span className="text-zinc-400 text-xs">
                          {((stats.captured / (stats.captured + stats.lost)) * 100).toFixed(0)}% win
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Territory List Drawer */}
          {showTerritoryList && (
            <div 
              className="absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-96 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-3 md:p-4 shadow-2xl z-20 max-h-[60vh] md:max-h-[500px] overflow-y-auto animate-slideDown"
              style={{
                animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div className="flex justify-between items-center mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs md:text-sm font-semibold text-white">
                    {territoryFilter === 'active' ? 'Active Territories' : 'Lost Territories'}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${territoryFilter === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {territoryFilter === 'active' ? stats.territories : stats.lost}
                  </span>
                </div>
                <button 
                  onClick={() => setShowTerritoryList(false)}
                  className="text-zinc-400 hover:text-white text-xl leading-none transition-all duration-200 hover:rotate-90 hover:scale-110"
                >
                  ×
                </button>
              </div>
              
              {/* Filter Tabs */}
              <div className="flex gap-1.5 md:gap-2 mb-2 md:mb-3">
                <button
                  onClick={() => setTerritoryFilter('active')}
                  className={`flex-1 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs font-medium transition-all ${
                    territoryFilter === 'active' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  Active ({stats.territories})
                </button>
                <button
                  onClick={() => setTerritoryFilter('lost')}
                  className={`flex-1 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs font-medium transition-all ${
                    territoryFilter === 'lost' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  Lost ({stats.lost})
                </button>
              </div>
              
              <div className="space-y-2">
                {territoryFilter === 'active' ? (
                  stats.territoryList.length > 0 ? (
                    stats.territoryList.map((territory, i) => (
                      <button
                        key={territory.id}
                        onClick={() => {
                          // Pass just the ID - let the external selection handler get complete data
                          if (onTerritoryClick) {
                            onTerritoryClick({
                              id: territory.id,
                              name: territory.name
                            });
                          }
                          // Also fly to the territory
                          flyToTerritory(territory.center);
                        }}
                        className="w-full text-left p-2.5 md:p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-500/50 transition-all duration-200 hover:translate-x-1 hover:shadow-lg active:scale-98"
                      >
                        <div className="flex items-start gap-2.5 md:gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-sm font-medium text-white mb-1">
                              {territory.name || `Territory ${i + 1}`}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {territory.area} km²
                            </div>
                          </div>
                          <div className="text-zinc-500 text-xs flex-shrink-0">
                            →
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-6 md:py-8 text-zinc-500 text-xs md:text-sm">
                      <div className="text-xl md:text-2xl mb-2">🏃</div>
                      No active territories yet.<br/>Run a closed loop to claim your first territory!
                    </div>
                  )
                ) : (
                  stats.lostTerritories.length > 0 ? (
                    stats.lostTerritories.map((territory, i) => (
                      <button
                        key={`lost-${territory.id}-${i}`}
                        onClick={async () => {
                          // Fetch the territory data from the map to get current state
                          try {
                            const res = await fetch(`/api/tiles?minLng=-180&minLat=-90&maxLng=180&maxLat=90&zoom=1`);
                            const data = await res.json();
                            const currentTerritory = data.features?.find(f => f.properties.name === territory.name);
                            
                            if (currentTerritory) {
                              // Calculate centroid
                              const coords = currentTerritory.geometry.coordinates[0];
                              const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
                              const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
                              const center = [sumLng / coords.length, sumLat / coords.length];
                              
                              const territoryData = {
                                ...currentTerritory.properties,
                                geometry: currentTerritory.geometry,
                                center
                              };
                              
                              // Trigger territory selection (shows markers and card)
                              if (onTerritoryClick) {
                                onTerritoryClick(territoryData);
                              }
                              
                              // Fly to the territory
                              flyToTerritory(center);
                            }
                          } catch (error) {
                            console.error('Failed to load lost territory:', error);
                          }
                        }}
                        className="w-full text-left p-2.5 md:p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 border-l-2 border-l-red-500 hover:border-red-500/50 transition-all duration-200 hover:translate-x-1 hover:shadow-lg active:scale-98 cursor-pointer"
                      >
                        <div className="flex items-start gap-2.5 md:gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-sm font-medium text-white mb-1">
                              {territory.name}
                            </div>
                            <div className="text-xs text-zinc-400 mb-1">
                              {territory.area} km²
                            </div>
                            <div className="text-xs flex items-center gap-1">
                              <span className="text-zinc-500">Captured by</span>
                              <span className="font-medium" style={{ color: territory.capturedByColor }}>
                                {territory.capturedBy}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-600 mt-1">
                              {new Date(territory.capturedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-6 md:py-8 text-zinc-500 text-xs md:text-sm">
                      <div className="text-xl md:text-2xl mb-2">🛡️</div>
                      No territories lost yet.<br/>Keep defending your domain!
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Minimal Loading Screen */}
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
          {/* Simple spinner */}
          <div className="relative w-12 h-12 mb-8">
            <div className="absolute inset-0 border-2 border-zinc-800 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
          </div>
          
          {/* Clean text */}
          <p className="text-zinc-400 text-sm font-medium tracking-wide">
            {loadingState}
          </p>
        </div>
      )}
      
      {/* Data loading indicator (top right) */}
      {loaded && dataLoading && (
        <div className="absolute top-4 right-4 z-30 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full px-4 py-2 shadow-lg animate-slide-in-right">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-300">Updating</span>
          </div>
        </div>
      )}
    </div>
  );
}
