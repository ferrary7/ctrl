import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/territories/by-activity/[activityId]
 * Returns a specific territory by activity ID
 */
export async function GET(request, { params }) {
  try {
    const { activityId } = params;
    
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }
    
    console.log('Fetching territory for activity:', activityId);
    
    // First, fetch the territory - use limit instead of single to avoid errors
    const { data: territories, error: territoryError } = await supabase
      .from('territories')
      .select('*')
      .eq('activity_id', activityId)
      .limit(1);

    if (territoryError) {
      console.error('Territory fetch error:', territoryError);
      return NextResponse.json(
        { error: 'Territory fetch failed', details: territoryError.message },
        { status: 500 }
      );
    }
    
    if (!territories || territories.length === 0) {
      console.log('No territory found for activity:', activityId);
      return NextResponse.json(
        { error: 'Territory not found for this activity' },
        { status: 404 }
      );
    }
    
    const territory = territories[0];
    
    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, color, strava_id, avatar_url')
      .eq('id', territory.user_id)
      .single();

    if (userError) {
      console.log('User fetch warning:', userError.message);
    }
    
    // Fetch activity data
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('id, type, name')
      .eq('id', territory.activity_id)
      .single();

    if (activityError) {
      console.log('Activity fetch warning:', activityError.message);
    }
    
    console.log('Successfully found territory:', territory.id, 'for activity:', activityId);
    
    return NextResponse.json({
      ...territory,
      users: user,
      activity: activity
    });
    
  } catch (error) {
    console.error('Error fetching territory by activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch territory', details: error.message },
      { status: 500 }
    );
  }
}
