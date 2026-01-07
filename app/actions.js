'use server';

import { db } from '@/lib/db';
import { 
  bufferRoute, 
  lineStringToWKT, 
  polygonToWKT,
  calculateTerritoryChanges,
  getRouteBounds
} from '@/lib/territory';
import { invalidateTerritoryTiles, invalidateUserCaches } from '@/lib/cache';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: Upload new activity and process territory claims
 * This is the core game mechanic - processes GPS data and updates territory ownership
 */

export async function uploadActivity(formData) {
  try {
    const userId = formData.get('userId');
    const activityData = {
      externalId: formData.get('externalId'),
      name: formData.get('name'),
      type: formData.get('type'), // 'Run' or 'Ride'
      startedAt: formData.get('startedAt'),
      polyline: formData.get('polyline'),
      distance: parseFloat(formData.get('distance')),
      duration: parseInt(formData.get('duration'))
    };
    
    // 1. Convert polyline to LineString WKT
    const lineStringWKT = lineStringToWKT(
      require('@/lib/territory').polylineToLineString(activityData.polyline)
    );
    
    // 2. Create activity in database
    const activity = await db.createActivity(userId, {
      ...activityData,
      lineStringWKT
    });
    
    if (!activity) {
      return { success: false, error: 'Activity already exists' };
    }
    
    // 3. Buffer the route to create territory polygon
    const buffered = bufferRoute(activityData.polyline, activityData.type);
    const territoryWKT = polygonToWKT(buffered.polygon);
    
    // 4. Find overlapping territories
    const bbox = getRouteBounds(activityData.polyline);
    const overlapping = await db.findOverlappingTerritories(activity.id, territoryWKT);
    
    // 5. Calculate territory changes
    const changes = calculateTerritoryChanges(
      buffered,
      overlapping,
      userId,
      new Date(activityData.startedAt)
    );
    
    // 6. Apply changes to database
    for (const deletion of changes.deletes) {
      await db.deleteTerritory(deletion);
    }
    
    for (const update of changes.updates) {
      await db.updateTerritoryGeometry(update.territoryId, update.newGeometryWKT);
    }
    
    for (const claim of changes.newClaims) {
      await db.createTerritory(userId, activity.id, claim.geometryWKT, claim.capturedAt);
    }
    
    for (const transfer of changes.transfers) {
      await db.recordTerritoryChange({
        ...transfer,
        activityId: activity.id
      });
    }
    
    // 7. Invalidate caches
    await invalidateTerritoryTiles(bbox);
    await invalidateUserCaches(userId);
    
    // Invalidate affected users' caches
    const affectedUsers = new Set(
      changes.transfers.map(t => t.previousOwnerId)
    );
    for (const affectedUserId of affectedUsers) {
      await invalidateUserCaches(affectedUserId);
    }
    
    // 8. Revalidate pages
    revalidatePath('/');
    revalidatePath(`/user/${userId}`);
    
    return {
      success: true,
      activity: {
        id: activity.id,
        name: activity.name,
        territoryChanges: {
          newClaims: changes.newClaims.length,
          stolen: changes.transfers.reduce((sum, t) => sum + t.areaSqm, 0),
          affected: affectedUsers.size
        }
      }
    };
    
  } catch (error) {
    console.error('Upload activity error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action: Get user's profile data
 */
export async function getUserProfile(userId) {
  try {
    const user = await db.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const totalArea = await db.getUserTotalArea(userId);
    const activities = await db.getUserActivities(userId, 10);
    
    return {
      success: true,
      user: {
        ...user,
        totalAreaSqm: totalArea,
        totalAreaSqKm: totalArea / 1_000_000,
        recentActivities: activities
      }
    };
  } catch (error) {
    console.error('Get user profile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action: Fetch activities from Strava
 * Called by webhook or manual refresh
 */
export async function syncStravaActivities(userId) {
  try {
    const user = await db.getUserByStravaId(userId);
    if (!user || !user.strava_access_token) {
      return { success: false, error: 'Strava not connected' };
    }
    
    // Refresh token if needed
    let accessToken = user.strava_access_token;
    if (Date.now() / 1000 > user.strava_expires_at) {
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: user.strava_refresh_token,
          grant_type: 'refresh_token'
        })
      });
      
      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      
      await db.upsertUser({
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        stravaId: user.strava_id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at
      });
    }
    
    // Fetch recent activities
    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    const activities = await response.json();
    
    // Process each activity
    const results = [];
    for (const activity of activities) {
      if (!activity.map?.summary_polyline) continue;
      if (activity.type !== 'Run' && activity.type !== 'Ride') continue;
      
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('externalId', `strava_${activity.id}`);
      formData.append('name', activity.name);
      formData.append('type', activity.type);
      formData.append('startedAt', activity.start_date);
      formData.append('polyline', activity.map.summary_polyline);
      formData.append('distance', activity.distance);
      formData.append('duration', activity.moving_time);
      
      const result = await uploadActivity(formData);
      results.push(result);
    }
    
    return {
      success: true,
      processed: results.length,
      activities: results
    };
    
  } catch (error) {
    console.error('Sync Strava error:', error);
    return { success: false, error: error.message };
  }
}
