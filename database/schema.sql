-- Enable PostGIS extension for spatial operations
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  strava_id VARCHAR(50) UNIQUE,
  strava_access_token TEXT,
  strava_refresh_token TEXT,
  strava_expires_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  type VARCHAR(50) NOT NULL CHECK (type IN ('Run', 'Ride', 'Walk')),
  started_at TIMESTAMP NOT NULL,
  polyline TEXT NOT NULL,
  distance NUMERIC NOT NULL,
  duration INTEGER NOT NULL,
  route_geometry GEOMETRY(LineString, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes on activities table
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_started ON activities(started_at DESC);
CREATE INDEX idx_activities_route_geom ON activities USING GIST(route_geometry);

-- Territories table
CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  area_sqm NUMERIC NOT NULL,
  captured_at TIMESTAMP NOT NULL,
  last_defended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes on territories table
CREATE INDEX idx_territories_user ON territories(user_id);
CREATE INDEX idx_territories_activity ON territories(activity_id);
CREATE INDEX idx_territories_captured ON territories(captured_at DESC);
CREATE INDEX idx_territories_geom ON territories USING GIST(geometry);

-- Territory history for analytics
CREATE TABLE territory_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  previous_owner_id UUID REFERENCES users(id),
  new_owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  area_transferred_sqm NUMERIC NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index on territory_changes table
CREATE INDEX idx_territory_changes_new_owner ON territory_changes(new_owner_id, changed_at DESC);

-- Leaderboard materialized view
CREATE MATERIALIZED VIEW leaderboard AS
SELECT 
  u.id,
  u.name,
  u.avatar_url,
  COUNT(DISTINCT t.id) as territory_count,
  COALESCE(SUM(t.area_sqm), 0) as total_area_sqm,
  COUNT(DISTINCT a.id) as activity_count,
  MAX(a.started_at) as last_activity_at
FROM users u
LEFT JOIN territories t ON u.id = t.user_id
LEFT JOIN activities a ON u.id = a.user_id
GROUP BY u.id, u.name, u.avatar_url;

CREATE UNIQUE INDEX idx_leaderboard_id ON leaderboard(id);

-- Function to refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;

-- RPC Functions for Supabase

-- Create activity with geometry
CREATE OR REPLACE FUNCTION create_activity(
  p_user_id UUID,
  p_external_id VARCHAR,
  p_name VARCHAR,
  p_type VARCHAR,
  p_started_at TIMESTAMP,
  p_polyline TEXT,
  p_distance NUMERIC,
  p_duration INTEGER,
  p_linestring_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  external_id VARCHAR,
  name VARCHAR,
  type VARCHAR,
  started_at TIMESTAMP,
  polyline TEXT,
  distance NUMERIC,
  duration INTEGER,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO activities (
    user_id, external_id, name, type, started_at,
    polyline, distance, duration, route_geometry
  )
  VALUES (
    p_user_id, p_external_id, p_name, p_type, p_started_at,
    p_polyline, p_distance, p_duration, ST_GeomFromText(p_linestring_wkt, 4326)
  )
  ON CONFLICT (external_id) DO NOTHING
  RETURNING id, user_id, external_id, name, type, started_at, polyline, distance, duration, created_at;
END;
$$ LANGUAGE plpgsql;

-- Get territories in bounding box
CREATE OR REPLACE FUNCTION get_territories_in_bounds(
  p_min_lng NUMERIC,
  p_min_lat NUMERIC,
  p_max_lng NUMERIC,
  p_max_lat NUMERIC
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  owner_name VARCHAR,
  owner_avatar TEXT,
  geometry TEXT,
  area_sqm NUMERIC,
  captured_at TIMESTAMP,
  age_seconds NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    u.name as owner_name,
    u.avatar_url as owner_avatar,
    ST_AsGeoJSON(t.geometry) as geometry,
    t.area_sqm,
    t.captured_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.captured_at)) as age_seconds
  FROM territories t
  JOIN users u ON t.user_id = u.id
  WHERE t.geometry && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  ORDER BY t.captured_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Find overlapping territories
CREATE OR REPLACE FUNCTION find_overlapping_territories(
  p_activity_id UUID,
  p_buffer_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_id UUID,
  geometry TEXT,
  intersection TEXT,
  overlap_area_sqm NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.activity_id,
    ST_AsGeoJSON(t.geometry) as geometry,
    ST_AsGeoJSON(ST_Intersection(t.geometry, ST_GeomFromText(p_buffer_wkt, 4326))) as intersection,
    ST_Area(ST_Intersection(t.geometry, ST_GeomFromText(p_buffer_wkt, 4326))::geography) as overlap_area_sqm
  FROM territories t
  WHERE ST_Intersects(t.geometry, ST_GeomFromText(p_buffer_wkt, 4326));
END;
$$ LANGUAGE plpgsql;

-- Create territory
CREATE OR REPLACE FUNCTION create_territory(
  p_user_id UUID,
  p_activity_id UUID,
  p_polygon_wkt TEXT,
  p_captured_at TIMESTAMP
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_id UUID,
  area_sqm NUMERIC,
  captured_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO territories (user_id, activity_id, geometry, area_sqm, captured_at)
  VALUES (
    p_user_id,
    p_activity_id,
    ST_GeomFromText(p_polygon_wkt, 4326),
    ST_Area(ST_GeomFromText(p_polygon_wkt, 4326)::geography),
    p_captured_at
  )
  RETURNING id, user_id, activity_id, area_sqm, captured_at;
END;
$$ LANGUAGE plpgsql;

-- Update territory geometry
CREATE OR REPLACE FUNCTION update_territory_geometry(
  p_territory_id UUID,
  p_polygon_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  area_sqm NUMERIC,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  UPDATE territories
  SET 
    geometry = ST_GeomFromText(p_polygon_wkt, 4326),
    area_sqm = ST_Area(ST_GeomFromText(p_polygon_wkt, 4326)::geography),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_territory_id
  RETURNING id, area_sqm, updated_at;
END;
$$ LANGUAGE plpgsql;

-- Get user total area
CREATE OR REPLACE FUNCTION get_user_total_area(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(area_sqm), 0) INTO total
  FROM territories
  WHERE user_id = p_user_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Get user activities
CREATE OR REPLACE FUNCTION get_user_activities(
  p_user_id UUID,
  p_limit INTEGER
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  type VARCHAR,
  started_at TIMESTAMP,
  distance NUMERIC,
  duration INTEGER,
  polyline TEXT,
  route_geometry TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.type,
    a.started_at,
    a.distance,
    a.duration,
    a.polyline,
    ST_AsGeoJSON(a.route_geometry) as route_geometry
  FROM activities a
  WHERE a.user_id = p_user_id
  ORDER BY a.started_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
