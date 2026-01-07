import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/territories/claim
 * Claim a territory from an activity
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activityId } = await request.json();

    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID required' },
        { status: 400 }
      );
    }

    console.log('Claiming territory for activity:', activityId, 'user:', session.user.id);

    // Call the database function to create territory
    const { data, error } = await supabase
      .rpc('create_territory_from_activity', {
        p_activity_id: activityId,
        p_user_id: session.user.id
      });

    console.log('RPC result:', { data, error });

    if (error) {
      console.error('Territory claim error:', error);
      return NextResponse.json(
        { error: error.message || 'Database error', details: error },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Activity does not form a closed loop. Run in a loop to claim territory!' 
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      territoryId: data,
      message: 'Territory claimed successfully!'
    });

  } catch (error) {
    console.error('Territory claim error:', error);
    return NextResponse.json(
      { error: 'Failed to claim territory' },
      { status: 500 }
    );
  }
}
