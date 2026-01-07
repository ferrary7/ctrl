'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSession } from 'next-auth/react';

/**
 * Enhanced Territory Map with:
 * 1. Better territory highlighting with distinct borders
 * 2. Start/End point markers for each territory
 * 3. Overview pins visible at all zoom levels
 */

export default function TerritoryMapEnhanced({ 
  initialCenter = [78.9629, 20.5937],
  initialZoom = 5,
  onTerritoryClick
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = useSession();
  const hasAutoZoomed = useRef(false);
  const markers = useRef([]);
  const [stats, setStats] = useState({ 
    territories: 0, 
    area: 0, 
    rank: null,
    captured: 0,
    lost: 0,
    territoryList: []
  });
  const [showStats, setShowStats] = useState(false);
  const [showTerritoryList, setShowTerritoryList] = useState(false);
  
  useEffect(() => {
    if (map.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: initialCenter,
      zoom: initialZoom,
      antialias: true
    });
    
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    }), 'top-right');
    
    map.current.on('load', async () => {
      // Add territories source
      map.current.addSource('territories', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        promoteId: 'id'
      });
      
      // Territory fill
      map.current.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['coalesce', ['get', 'userColor'], '#FF006E'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.6,
            ['==', ['get', 'territoryType'], 'corridor'], 0.25,
            0.4
          ]
        }
      });
      
      // Distinct borders for each territory
      map.current.addLayer({
        id: 'territory-border',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['coalesce', ['get', 'userColor'], '#FF006E'],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 2,
            10, 3,
            15, 4
          ],
          'line-opacity': 1
        }
      });
      
      // Inner line for double-border effect
      map.current.addLayer({
        id: 'territory-border-inner',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.5,
            10, 1,
            15, 1.5
          ],
          'line-opacity': 0.8,
          'line-offset': [
            'interpolate', ['linear'], ['zoom'],
            5, -1,
            10, -1.5,
            15, -2
          ]
        }
      });
      
      // Hover effects
      let hoveredId = null;
      
      map.current.on('mouseenter', 'territory-fill', (e) => {
        map.current.getCanvas().style.cursor = 'pointer';
        if (e.features.length > 0) {
          if (hoveredId !== null) {
            map.current.setFeatureState({ source: 'territories', id: hoveredId }, { hover: false });
          }
          hoveredId = e.features[0].id;
          map.current.setFeatureState({ source: 'territories', id: hoveredId }, { hover: true });
        }
      });
      
      map.current.on('mouseleave', 'territory-fill', () => {
        map.current.getCanvas().style.cursor = '';
        if (hoveredId !== null) {
          map.current.setFeatureState({ source: 'territories', id: hoveredId }, { hover: false });
        }
        hoveredId = null;
      });
      
      if (onTerritoryClick) {
        map.current.on('click', 'territory-fill', (e) => {
          if (e.features.length > 0) {
            onTerritoryClick(e.features[0].properties);
          }
        });
      }
      
      setLoaded(true);
      updateTerritories();
      
      map.current.on('moveend', updateTerritories);
    });
    
    const updateTerritories = async () => {
      if (!map.current || !map.current.getSource) return;
      
      const bounds = map.current.getBounds();
      const zoom = Math.round(map.current.getZoom());
      
      try {
        const response = await fetch(
          `/api/tiles?` +
          `minLng=${bounds.getWest()}&` +
          `minLat=${bounds.getSouth()}&` +
          `maxLng=${bounds.getEast()}&` +
          `maxLat=${bounds.getNorth()}&` +
          `zoom=${zoom}`
        );
        
        const data = await response.json();
        
        if (map.current && map.current.getSource) {
          const territoriesSource = map.current.getSource('territories');
          if (territoriesSource) {
            territoriesSource.setData(data);
            
            // Add overview markers for territories
            addOverviewMarkers(data);
          }
        }
      } catch (error) {
        console.error('Failed to load territories:', error);
      }
    };
    
    const addOverviewMarkers = (geojsonData) => {
      // Clear existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      
      const currentZoom = map.current.getZoom();
      
      // Show markers only at low zoom levels (overview)
      if (currentZoom > 8) return;
      
      geojsonData.features.forEach(feature => {
        const { geometry, properties } = feature;
        
        // Calculate centroid
        let center;
        if (geometry.type === 'Polygon') {
          const coords = geometry.coordinates[0];
          const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
          const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
          center = [sumLng / coords.length, sumLat / coords.length];
        } else {
          return;
        }
        
        // Create marker element
        const el = document.createElement('div');
        el.className = 'territory-marker';
        el.style.cssText = `
          width: 24px;
          height: 24px;
          background: ${properties.userColor || '#FF006E'};
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.2s;
        `;
        
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.3)';
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(center)
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="color: #000; padding: 4px;">
                  <strong>${properties.name || 'Territory'}</strong><br/>
                  ${(properties.areaSqm / 1000000).toFixed(2)} km²
                </div>
              `)
          )
          .addTo(map.current);
        
        markers.current.push(marker);
      });
    };
    
    // Auto-zoom to user territories
    if (session && !hasAutoZoomed.current) {
      setTimeout(async () => {
        try {
          const [territoriesRes, profileRes] = await Promise.all([
            fetch('/api/territories'),
            fetch('/api/user/profile')
          ]);
          
          const territories = await territoriesRes.json();
          const profile = await profileRes.json();
          
          if (territories && territories.length > 0) {
            const coords = [];
            territories.forEach(t => {
              if (t.geometry?.coordinates) {
                if (t.geometry.type === 'Polygon') {
                  coords.push(...t.geometry.coordinates[0]);
                }
              }
            });
            
            if (coords.length > 0) {
              const bounds = coords.reduce((bounds, coord) => {
                return bounds.extend(coord);
              }, new maplibregl.LngLatBounds(coords[0], coords[0]));
              
              map.current.fitBounds(bounds, {
                padding: { top: 100, bottom: 100, left: 100, right: 100 },
                maxZoom: 14,
                duration: 2000
              });
              
              hasAutoZoomed.current = true;
            }
          }
          
          // Update stats
          if (profile) {
            setStats({
              territories: profile.total_territories || 0,
              area: (profile.total_area_sqm / 1000000) || 0,
              rank: profile.rank || null,
              captured: profile.territories_captured || 0,
              lost: profile.territories_lost || 0,
              territoryList: territories || []
            });
          }
        } catch (error) {
          console.error('Failed to load user territories:', error);
        }
      }, 1000);
    }
    
    return () => {
      if (map.current) {
        markers.current.forEach(marker => marker.remove());
        map.current.remove();
      }
    };
  }, [session]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flyToTerritory = (territory) => {
    if (!map.current || !territory.geometry) return;
    
    const coords = territory.geometry.coordinates[0];
    const bounds = coords.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coords[0], coords[0]));
    
    map.current.fitBounds(bounds, {
      padding: 80,
      maxZoom: 15,
      duration: 1500
    });
    
    setShowTerritoryList(false);
  };
  
  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Stats Overlay */}
      <div className="absolute top-4 left-4 bg-zinc-900/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            {showStats ? '− Stats' : '+ Stats'}
          </button>
          
          {showStats && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">#{stats.rank || '—'}</div>
                <div className="text-xs text-zinc-500">Rank</div>
              </div>
              
              <button
                onClick={() => setShowTerritoryList(!showTerritoryList)}
                className="text-center hover:bg-zinc-800 rounded-lg p-2 transition-colors"
              >
                <div className="text-2xl font-bold text-blue-400">{stats.territories}</div>
                <div className="text-xs text-zinc-500">Territories</div>
              </button>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.area.toFixed(2)}</div>
                <div className="text-xs text-zinc-500">km² claimed</div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Territory List Drawer */}
      {showTerritoryList && stats.territoryList.length > 0 && (
        <div className="absolute top-24 left-4 bg-zinc-900/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-zinc-800 max-w-xs max-h-96 overflow-y-auto">
          <h3 className="text-sm font-semibold text-white mb-3">Your Territories</h3>
          <div className="space-y-2">
            {stats.territoryList.map((territory) => (
              <button
                key={territory.id}
                onClick={() => flyToTerritory(territory)}
                className="w-full text-left p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{territory.name}</div>
                    <div className="text-xs text-zinc-400">
                      {(territory.area_sqm / 1000000).toFixed(3)} km²
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-zinc-500">
                    {territory.territory_type === 'polygon' ? '🔷' : 
                     territory.territory_type === 'loop' ? '🔶' : '🛣️'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
