import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/tiles
 * Returns territories within a bounding box for map rendering
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const minLng = parseFloat(searchParams.get('minLng'));
    const minLat = parseFloat(searchParams.get('minLat'));
    const maxLng = parseFloat(searchParams.get('maxLng'));
    const maxLat = parseFloat(searchParams.get('maxLat'));
    const zoom = parseInt(searchParams.get('zoom') || '12');
    const activityId = searchParams.get('activityId');
    
    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
      return NextResponse.json(
        { error: 'Invalid bounding box parameters' },
        { status: 400 }
      );
    }
    
    let query = supabase
      .from('territories')
      .select('id, user_id, users(name, color), activity_id, name, geometry, area_sqm, strength, captured_at, territory_type, activity:activities(type)')
      .not('geometry', 'is', null);
    
    // If activityId is provided, fetch that specific territory
    if (activityId) {
      console.log('Fetching territory for activity:', activityId);
      query = query.eq('activity_id', activityId);
    }
    
    const { data: territories, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({
        type: 'FeatureCollection',
        features: []
      });
    }
    
    if (!territories) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: []
      });
    }
    
    // If fetching a specific activity, return it directly without bbox filtering
    let filteredTerritories = territories;
    
    if (!activityId) {
      // When showing all territories, filter by bounding box
      filteredTerritories = territories.filter(territory => {
        if (!territory.geometry || !territory.geometry.coordinates) return false;
        
        const coords = territory.geometry.coordinates[0];
        if (!coords || coords.length === 0) return false;
        
        // Check if any point in the polygon is within bounds
        return coords.some(([lng, lat]) => 
          lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
        );
      });
    }
    
    const features = filteredTerritories.map(territory => ({
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
        territoryType: territory.territory_type || 'polygon',
        activityId: territory.activity_id,
        activityType: territory.activity?.type || 'Run'
      },
      geometry: territory.geometry
    }));
    
    if (activityId) {
      console.log('Found', features.length, 'territories for activity:', activityId);
    }
    
    return NextResponse.json({
      type: 'FeatureCollection',
      features
    });
    
  } catch (error) {
    console.error('Territory tile error:', error);
    return NextResponse.json({
      type: 'FeatureCollection',
      features: []
    });
  }
}
