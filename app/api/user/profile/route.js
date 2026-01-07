import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (error) {
      console.error('Database error:', error);
      return Response.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    // Get user's rank from leaderboard
    const { data: leaderboard } = await supabase
      .rpc('get_leaderboard', { limit_count: 1000 });
    
    const userRank = leaderboard?.find(entry => entry.user_id === user.id)?.rank || null;
    
    return Response.json({
      ...user,
      rank: userRank
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { color } = body;

    // Validate color format (hex color)
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return Response.json({ error: 'Invalid color format' }, { status: 400 });
    }

    // Update user color
    const { data, error } = await supabase
      .from('users')
      .update({ color })
      .eq('email', session.user.email)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return Response.json({ error: 'Failed to update color' }, { status: 500 });
    }

    return Response.json({ success: true, user: data });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
