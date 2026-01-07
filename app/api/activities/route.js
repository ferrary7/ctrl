import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get activities from database
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', session.user.id)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return Response.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    return Response.json({ activities: activities || [] });
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
