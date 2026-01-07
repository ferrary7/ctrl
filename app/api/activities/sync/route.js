import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import polyline from '@mapbox/polyline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get selected activity IDs from request body
    const body = await request.json().catch(() => ({}));
    const { activityIds } = body;

    if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
      return Response.json({ 
        error: 'Please select activities to sync' 
      }, { status: 400 });
    }

    let syncedCount = 0;
    const territoriesClaimed = [];
    let totalDistance = 0;

    // Fetch and process each selected activity
    for (const activityId of activityIds) {
      try {
        // Fetch individual activity details from Strava
        const stravaResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`
            }
          }
        );

        if (!stravaResponse.ok) {
          console.error(`Failed to fetch activity ${activityId}`);
          continue;
        }

        const activity = await stravaResponse.json();
        totalDistance += activity.distance || 0;
        
        // Skip if no route data
        if (!activity.map?.summary_polyline) {
          continue;
        }

        // Decode polyline to coordinates
        const coords = polyline.decode(activity.map.summary_polyline);
        
        // Convert to WKT LineString for PostGIS
        const wktCoords = coords.map(([lat, lng]) => `${lng} ${lat}`).join(',');
        const wktLineString = `LINESTRING(${wktCoords})`;

        // Insert or update activity in database
        const { data: activityData, error } = await supabase
          .from('activities')
          .upsert({
            external_id: activity.id.toString(),
            user_id: session.user.id,
            name: activity.name,
            type: activity.type,
            distance: activity.distance,
            duration: activity.moving_time,
            started_at: activity.start_date,
            polyline: activity.map.summary_polyline,
            route_geometry: wktLineString
          }, {
            onConflict: 'external_id'
          })
          .select()
          .single();

        if (!error && activityData) {
          syncedCount++;
          
          console.log(`\n=== Processing ${activity.name} ===`);
          console.log(`Activity ID: ${activityData.id}`);
          console.log(`User ID: ${session.user.id}`);
          console.log(`Route points: ${coords.length}`);
          
          // AUTOMATICALLY claim territory if it forms a loop
          console.log(`Calling create_territory_from_activity RPC...`);
          const rpcResult = await supabase.rpc(
            'create_territory_from_activity',
            {
              p_activity_id: activityData.id,
              p_user_id: session.user.id
            }
          );
          
          console.log('RPC Result:', JSON.stringify(rpcResult, null, 2));
          
          const { data: territoryId, error: territoryError } = rpcResult;
          
          if (territoryError) {
            console.error(`❌ Territory creation error for ${activity.name}:`, territoryError);
            console.error('Error code:', territoryError.code);
            console.error('Error message:', territoryError.message);
            console.error('Error details:', territoryError.details);
            console.error('Error hint:', territoryError.hint);
          }
          
          if (territoryId) {
            console.log(`✓ Territory created for ${activity.name}: ${territoryId}`);
            territoriesClaimed.push({
              activityName: activity.name,
              territoryId: territoryId
            });
          } else if (!territoryError) {
            console.log(`⚠ No territory created for ${activity.name} (function returned NULL)`);
          }
        } else if (error) {
          console.error(`Failed to insert activity ${activity.name}:`, error);
        }
      } catch (activityError) {
        console.error(`Error processing activity ${activityId}:`, activityError);
      }
    }

    // Update user's total distance
    await supabase
      .from('users')
      .update({ total_distance: totalDistance })
      .eq('id', session.user.id);

    return Response.json({ 
      success: true, 
      count: syncedCount,
      total: activityIds.length,
      territoriesClaimed: territoriesClaimed.length,
      message: `Synced ${syncedCount} of ${activityIds.length} selected activities. ${territoriesClaimed.length} territories automatically claimed.`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      error: 'Failed to sync activities',
      details: error.message 
    }, { status: 500 });
  }
}
