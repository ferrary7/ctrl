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
 * GET /api/territories/history
 * Fetch territory capture/loss history for the authenticated user
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Fetch territory history with user and territory details
    const { data: history, error } = await supabase
      .from('territory_history')
      .select(`
        *,
        territories!territory_history_territory_id_fkey(name),
        from_users:from_user_id(name, color),
        to_users:to_user_id(name, color)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching territory history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format the response
    const formatted = (history || []).map(h => ({
      id: h.id,
      action: h.action,
      from_user_id: h.from_user_id,
      from_user_name: h.from_users?.name || 'Unknown',
      from_user_color: h.from_users?.color || '#666666',
      to_user_id: h.to_user_id,
      to_user_name: h.to_users?.name || 'Unknown',
      to_user_color: h.to_users?.color || '#666666',
      territory_name: h.territories?.name || 'Unknown Territory',
      area_change: h.area_change,
      created_at: h.created_at
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Territory history fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
