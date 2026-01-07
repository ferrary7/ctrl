import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/strava/activities
 * Fetch available activities from Strava (last 30)
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch recent activities from Strava
    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Strava API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch activities from Strava' },
        { status: response.status }
      );
    }

    const activities = await response.json();
    
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching Strava activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
