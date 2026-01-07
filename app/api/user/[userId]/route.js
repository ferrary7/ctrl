import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
  try {
    const { userId } = params;

    // Determine if userId is a Strava ID (numeric) or UUID
    const isNumeric = /^\d+$/.test(userId);
    
    let userData;
    let userError;

    if (isNumeric) {
      // Query by strava_id (numeric)
      const result = await supabase
        .from('users')
        .select('id, name, avatar_url, strava_id, color, created_at')
        .eq('strava_id', parseInt(userId))
        .single();
      userData = result.data;
      userError = result.error;
    } else {
      // Query by internal id (UUID)
      const result = await supabase
        .from('users')
        .select('id, name, avatar_url, strava_id, color, created_at')
        .eq('id', userId)
        .single();
      userData = result.data;
      userError = result.error;
    }

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user stats from leaderboard function - use internal id
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .rpc('get_leaderboard', { limit_count: 1000 });

    const statsData = leaderboardData?.find(entry => entry.user_id === userData.id);

    // Ensure stats always has default values
    const stats = {
      rank: statsData?.rank || null,
      totalTerritories: statsData?.total_territories || 0,
      totalArea: (statsData?.total_area_km2 || 0), // Already in km² from function
      totalDistance: statsData?.total_distance || 0,
    };

    // Get user's territories - use internal id
    const { data: territories } = await supabase
      .from('territories')
      .select('id, activity_id, area_sqm, captured_at')
      .eq('user_id', userData.id)
      .order('captured_at', { ascending: false })
      .limit(50);

    // Get user's recent activities - with error handling
    let activities = [];
    try {
      activities = await db.getUserActivities(userData.id, 50);
    } catch (activityError) {
      console.warn('Could not fetch user activities:', activityError.message);
      // Continue without activities instead of failing
    }

    return NextResponse.json({
      user: {
        id: userData.strava_id,
        name: userData.name,
        avatar: userData.avatar_url,
        color: userData.color,
        stravaId: userData.strava_id,
        joinedAt: userData.created_at,
      },
      stats: stats,
      territories: territories || [],
      activities: activities || [],
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile', details: error.message },
      { status: 500 }
    );
  }
}
