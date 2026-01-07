import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/activities/[id] - Get activity details by ID
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = params;
    
    // Fetch activity details
    const { data: activity, error } = await supabase
      .from('activities')
      .select('id, name, type, distance, duration, started_at, created_at')
      .eq('id', id)
      .single();
    
    if (error || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance,
      duration: activity.duration,
      startedAt: activity.started_at,
      createdAt: activity.created_at
    });
  } catch (error) {
    console.error('Error fetching activity details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity details' },
      { status: 500 }
    );
  }
}
