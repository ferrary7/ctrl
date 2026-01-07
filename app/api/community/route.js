import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/community - Get all active players
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users with their stats
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        strava_id,
        name,
        avatar_url,
        color,
        total_territories,
        total_area_sqm,
        last_activity_at,
        created_at
      `)
      .not('strava_id', 'is', null)
      .order('total_area_sqm', { ascending: false });

    if (error) {
      console.error('Error fetching community:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format response
    const formatted = (users || []).map(u => ({
      id: u.id,
      strava_id: u.strava_id,
      name: u.name,
      avatarUrl: u.avatar_url,
      color: u.color,
      territories: u.total_territories || 0,
      area: (u.total_area_sqm || 0) / 1000000, // Convert to km²
      lastActive: u.last_activity_at,
      joinedAt: u.created_at,
      isYou: u.id === session.user.id
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Community fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
