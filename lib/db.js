import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false }
  }
);

/**
 * Database utility functions for CTRL
 * Handles all PostGIS spatial queries and territory operations
 */

export const db = {
  /**
   * Get user by ID
   */
  async getUser(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, created_at')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get user by Strava ID
   */
  async getUserByStravaId(stravaId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('strava_id', stravaId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Create or update user from Strava OAuth
   */
  async upsertUser(stravaData) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        email: stravaData.email,
        name: stravaData.name,
        avatar_url: stravaData.avatarUrl,
        strava_id: stravaData.stravaId,
        strava_access_token: stravaData.accessToken,
        strava_refresh_token: stravaData.refreshToken,
        strava_expires_at: stravaData.expiresAt
      }, {
        onConflict: 'strava_id',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create activity and its route geometry from polyline
   */
  async createActivity(userId, activityData) {
    const { data, error } = await supabase.rpc('create_activity', {
      p_user_id: userId,
      p_external_id: activityData.externalId,
      p_name: activityData.name,
      p_type: activityData.type,
      p_started_at: activityData.startedAt,
      p_polyline: activityData.polyline,
      p_distance: activityData.distance,
      p_duration: activityData.duration,
      p_linestring_wkt: activityData.lineStringWKT
    });
    
    if (error && error.code !== '23505') throw error;
    return data;
  },

  /**
   * Get territories within bounding box with owner info
   * Used for map tile rendering
   */
  async getTerritoriesInBounds(bbox) {
    const { minLng, minLat, maxLng, maxLat } = bbox;
    
    const { data, error } = await supabase.rpc('get_territories_in_bounds', {
      p_min_lng: minLng,
      p_min_lat: minLat,
      p_max_lng: maxLng,
      p_max_lat: maxLat
    });
    
    if (error) throw error;
    
    return data.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));
  },

  /**
   * Find territories that intersect with a new route buffer
   * Returns territories that will be stolen/overlapped
   */
  async findOverlappingTerritories(activityId, bufferWKT) {
    const { data, error } = await supabase.rpc('find_overlapping_territories', {
      p_activity_id: activityId,
      p_buffer_wkt: bufferWKT
    });
    
    if (error) throw error;
    
    return data.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry),
      intersection: JSON.parse(row.intersection)
    }));
  },

  /**
   * Create new territory from buffered route
   */
  async createTerritory(userId, activityId, polygonWKT, capturedAt) {
    const { data, error } = await supabase.rpc('create_territory', {
      p_user_id: userId,
      p_activity_id: activityId,
      p_polygon_wkt: polygonWKT,
      p_captured_at: capturedAt
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Update territory geometry after overlap
   */
  async updateTerritoryGeometry(territoryId, newPolygonWKT) {
    const { data, error } = await supabase.rpc('update_territory_geometry', {
      p_territory_id: territoryId,
      p_polygon_wkt: newPolygonWKT
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Delete territory (when completely overtaken)
   */
  async deleteTerritory(territoryId) {
    const { error } = await supabase
      .from('territories')
      .delete()
      .eq('id', territoryId);
    
    if (error) throw error;
  },

  /**
   * Record territory change for history/analytics
   */
  async recordTerritoryChange(data) {
    const { error } = await supabase
      .from('territory_changes')
      .insert({
        territory_id: data.territoryId,
        previous_owner_id: data.previousOwnerId,
        new_owner_id: data.newOwnerId,
        activity_id: data.activityId,
        area_transferred_sqm: data.areaSqm
      });
    
    if (error) throw error;
  },

  /**
   * Get user's total claimed area
   */
  async getUserTotalArea(userId) {
    const { data, error } = await supabase.rpc('get_user_total_area', {
      p_user_id: userId
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Get top users by territory area
   */
  async getLeaderboard(limit = 100) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_area_sqm', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  },

  /**
   * Get user's recent activities
   */
  async getUserActivities(userId, limit = 20) {
    const { data, error } = await supabase.rpc('get_user_activities', {
      p_user_id: userId,
      p_limit: limit
    });
    
    if (error) throw error;
    
    return data.map(row => ({
      ...row,
      route_geometry: JSON.parse(row.route_geometry)
    }));
  }
};
