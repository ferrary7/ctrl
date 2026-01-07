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
 * GET /api/territories
 * Fetch all territories for the authenticated user
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's territories with geometry
    const { data: territories, error } = await supabase
      .from('territories')
      .select('id, name, area_sqm, strength, captured_at, activity_id, territory_type, geometry')
      .eq('user_id', session.user.id)
      .order('captured_at', { ascending: false });

    if (error) {
      console.error('Error fetching territories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(territories || []);
  } catch (error) {
    console.error('Territories fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
