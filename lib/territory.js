import polyline from '@mapbox/polyline';
import * as turf from '@turf/turf';

/**
 * Territory calculation engine
 * Handles GPS route processing, buffering, and overlap detection
 */

/**
 * Decode polyline to coordinates array
 */
export function decodePolyline(encodedPolyline) {
  const decoded = polyline.decode(encodedPolyline);
  return decoded.map(([lat, lng]) => [lng, lat]); // GeoJSON format [lng, lat]
}

/**
 * Create LineString from polyline
 */
export function polylineToLineString(encodedPolyline) {
  const coordinates = decodePolyline(encodedPolyline);
  return turf.lineString(coordinates);
}

/**
 * Convert LineString to WKT for PostGIS
 */
export function lineStringToWKT(lineString) {
  const coords = lineString.geometry.coordinates
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(', ');
  return `LINESTRING(${coords})`;
}

/**
 * Buffer a GPS route to create claimable territory
 * 
 * @param {string} encodedPolyline - Encoded polyline from Strava/GPS
 * @param {number} bufferMeters - Buffer distance (default 50m for runs, 100m for rides)
 * @returns {Object} Buffered polygon and metadata
 */
export function bufferRoute(encodedPolyline, activityType = 'Run') {
  // Different buffer sizes based on activity type
  const bufferMeters = activityType === 'Ride' ? 100 : 50;
  
  const lineString = polylineToLineString(encodedPolyline);
  
  // Buffer in meters (Turf uses kilometers)
  const buffered = turf.buffer(lineString, bufferMeters / 1000, {
    units: 'kilometers',
    steps: 8 // Smooth curves
  });
  
  // Simplify to reduce vertex count
  const simplified = turf.simplify(buffered, {
    tolerance: 0.0001,
    highQuality: true
  });
  
  return {
    polygon: simplified,
    lineString,
    bufferMeters,
    area: turf.area(simplified)
  };
}

/**
 * Convert Turf polygon to WKT for PostGIS
 */
export function polygonToWKT(polygon) {
  const coords = polygon.geometry.coordinates[0]
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(', ');
  return `POLYGON((${coords}))`;
}

/**
 * Calculate territory overlaps and determine ownership changes
 * 
 * @param {Object} newTerritory - New buffered territory from activity
 * @param {Array} existingTerritories - Array of existing territories in area
 * @param {Date} activityTimestamp - When the activity occurred
 * @returns {Object} Changes to apply to database
 */
export function calculateTerritoryChanges(newTerritory, existingTerritories, userId, activityTimestamp) {
  const changes = {
    newClaims: [],
    updates: [],
    deletes: [],
    transfers: []
  };
  
  let remainingNewTerritory = newTerritory.polygon;
  
  // Process each existing territory that overlaps
  for (const existing of existingTerritories) {
    const existingPoly = turf.polygon(existing.geometry.coordinates);
    
    try {
      const intersection = turf.intersect(
        turf.featureCollection([remainingNewTerritory, existingPoly])
      );
      
      if (!intersection) continue;
      
      const overlapArea = turf.area(intersection);
      
      // If owned by same user, extend their territory
      if (existing.user_id === userId) {
        const union = turf.union(
          turf.featureCollection([remainingNewTerritory, existingPoly])
        );
        
        changes.updates.push({
          territoryId: existing.id,
          newGeometry: union,
          newGeometryWKT: polygonToWKT(union)
        });
        
        // Territory merged, nothing left to claim
        return changes;
      }
      
      // Territory is stolen - calculate what remains for previous owner
      const difference = turf.difference(
        turf.featureCollection([existingPoly, intersection])
      );
      
      if (!difference || turf.area(difference) < 100) {
        // Entire territory overtaken
        changes.deletes.push(existing.id);
      } else {
        // Partial overlap - update existing territory
        changes.updates.push({
          territoryId: existing.id,
          newGeometry: difference,
          newGeometryWKT: polygonToWKT(difference)
        });
      }
      
      // Record the transfer
      changes.transfers.push({
        previousOwnerId: existing.user_id,
        newOwnerId: userId,
        areaSqm: overlapArea,
        territoryId: existing.id
      });
      
      // Remove stolen area from new territory claim
      const newRemaining = turf.difference(
        turf.featureCollection([remainingNewTerritory, intersection])
      );
      
      if (newRemaining) {
        remainingNewTerritory = newRemaining;
      } else {
        // Entire new territory overlaps existing owned territory
        return changes;
      }
      
    } catch (error) {
      console.error('Territory calculation error:', error);
      continue;
    }
  }
  
  // Create new territory for remaining area
  if (remainingNewTerritory && turf.area(remainingNewTerritory) > 100) {
    changes.newClaims.push({
      geometry: remainingNewTerritory,
      geometryWKT: polygonToWKT(remainingNewTerritory),
      capturedAt: activityTimestamp
    });
  }
  
  return changes;
}

/**
 * Simplify territories for map rendering at different zoom levels
 */
export function simplifyTerritoriesForZoom(territories, zoom) {
  // More aggressive simplification at lower zoom levels
  const tolerance = zoom > 14 ? 0.00001 : zoom > 12 ? 0.0001 : 0.0005;
  
  return territories.map(territory => {
    const poly = turf.polygon(territory.geometry.coordinates);
    const simplified = turf.simplify(poly, {
      tolerance,
      highQuality: false
    });
    
    return {
      ...territory,
      geometry: simplified.geometry
    };
  });
}

/**
 * Apply time-based territory decay
 * Territories lose a small percentage of area over time if not defended
 */
export function applyTerritoryDecay(territory, decayRatePerDay = 0.01) {
  const daysSinceDefended = (Date.now() - new Date(territory.last_defended_at)) / (1000 * 60 * 60 * 24);
  
  if (daysSinceDefended < 7) {
    return territory; // No decay for first week
  }
  
  const decayFactor = 1 - (decayRatePerDay * (daysSinceDefended - 7));
  
  if (decayFactor <= 0.5) {
    // Territory decayed too much - delete it
    return null;
  }
  
  // Shrink territory geometry using buffer
  const poly = turf.polygon(territory.geometry.coordinates);
  const area = turf.area(poly);
  const targetArea = area * decayFactor;
  
  // Negative buffer to shrink
  const shrinkMeters = Math.sqrt(area - targetArea) / 2;
  const shrunk = turf.buffer(poly, -shrinkMeters / 1000, { units: 'kilometers' });
  
  return {
    ...territory,
    geometry: shrunk.geometry,
    area_sqm: targetArea
  };
}

/**
 * Calculate bounding box for an activity route
 */
export function getRouteBounds(encodedPolyline) {
  const lineString = polylineToLineString(encodedPolyline);
  const bbox = turf.bbox(lineString);
  
  return {
    minLng: bbox[0],
    minLat: bbox[1],
    maxLng: bbox[2],
    maxLat: bbox[3]
  };
}

/**
 * Check if a point is within claimed territory
 * Used for activity validation
 */
export function isPointInTerritory(point, territories) {
  const pt = turf.point(point);
  
  for (const territory of territories) {
    const poly = turf.polygon(territory.geometry.coordinates);
    if (turf.booleanPointInPolygon(pt, poly)) {
      return {
        inTerritory: true,
        owner: territory.user_id,
        territoryId: territory.id
      };
    }
  }
  
  return { inTerritory: false };
}
