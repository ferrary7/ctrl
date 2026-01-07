-- Migration: Add strava_id to get_leaderboard function
-- This allows leaderboard results to include the Strava ID for public profile URLs

DROP FUNCTION IF EXISTS get_leaderboard(INT);

CREATE OR REPLACE FUNCTION get_leaderboard(
  limit_count INT DEFAULT 100
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  user_strava_id VARCHAR,
  user_name VARCHAR,
  user_avatar VARCHAR,
  user_color VARCHAR,
  total_territories BIGINT,
  total_area_sqm DOUBLE PRECISION,
  total_area_km2 DOUBLE PRECISION,
  total_distance NUMERIC,
  last_activity_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY COALESCE(u.total_area_sqm, 0) DESC) as rank,
    u.id as user_id,
    u.strava_id as user_strava_id,
    u.name as user_name,
    NULL::VARCHAR as user_avatar,
    u.color as user_color,
    COUNT(DISTINCT t.id) as total_territories,
    COALESCE(SUM(t.area_sqm), 0)::DOUBLE PRECISION as total_area_sqm,
    (COALESCE(SUM(t.area_sqm), 0) / 1000000)::DOUBLE PRECISION as total_area_km2,
    u.total_distance,
    u.last_activity_at
  FROM users u
  LEFT JOIN territories t ON u.id = t.user_id
  WHERE u.strava_id IS NOT NULL
  GROUP BY u.id
  ORDER BY total_area_sqm DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;
