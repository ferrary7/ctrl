import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/user/stats
 * Get current user stats
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with stats
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      throw userError;
    }

    // Get territory count
    const { count: territoryCount } = await supabase
      .from('territories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    // Get recent captures
    const { data: recentCaptures } = await supabase
      .from('territory_history')
      .select('*, territories(name, area_sqm)')
      .eq('to_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user rank
    const { data: leaderboard } = await supabase
      .rpc('get_leaderboard', { limit_count: 1000 });

    const userRank = leaderboard?.findIndex(u => u.user_id === session.user.id) + 1 || 0;

    return NextResponse.json({
      user: {
        ...user,
        total_territories: territoryCount || 0,
        rank: userRank
      },
      recentCaptures: recentCaptures || []
    });

  } catch (error) {
    console.error('User stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
