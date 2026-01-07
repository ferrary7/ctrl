-- Complete Territory System Schema
-- Run this in Supabase SQL Editor

-- Drop existing functions first (if they reference old schema)
DROP FUNCTION IF EXISTS create_territory_from_activity(UUID, UUID);
DROP FUNCTION IF EXISTS get_territories_in_bounds(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS get_territories_in_bounds(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS get_leaderboard(INT);
DROP FUNCTION IF EXISTS calculate_territory_strength(TIMESTAMPTZ, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS is_valid_territory_loop(GEOMETRY);
DROP FUNCTION IF EXISTS update_territory_strengths();

-- 1. Add color and stats to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#' || lpad(to_hex((random() * 16777215)::int), 6, '0'),
ADD COLUMN IF NOT EXISTS total_distance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_territories INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_area_sqm DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS rank INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- 2. Create territories table (if not exists, or alter existing)
DO $$ 
BEGIN
  -- Add missing columns to existing territories table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'territories') THEN
    ALTER TABLE territories 
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS strength INT DEFAULT 100,
    ADD COLUMN IF NOT EXISTS capture_count INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS territory_type VARCHAR(20) DEFAULT 'polygon' CHECK (territory_type IN ('polygon', 'corridor', 'loop')),
    ADD COLUMN IF NOT EXISTS last_defended_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Ensure captured_at has a default value
    ALTER TABLE territories ALTER COLUMN captured_at SET DEFAULT NOW();
  ELSE
    -- Create new table if it doesn't exist
    CREATE TABLE territories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      name VARCHAR(255),
      geometry GEOMETRY(POLYGON, 4326) NOT NULL,
      area_sqm DOUBLE PRECISION NOT NULL,
      strength INT DEFAULT 100,
      captured_at TIMESTAMPTZ DEFAULT NOW(),
      last_defended_at TIMESTAMPTZ DEFAULT NOW(),
      capture_count INT DEFAULT 1,
      territory_type VARCHAR(20) DEFAULT 'polygon' CHECK (territory_type IN ('polygon', 'corridor', 'loop')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      CONSTRAINT valid_polygon CHECK (ST_IsValid(geometry))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_territories_user ON territories(user_id);
CREATE INDEX IF NOT EXISTS idx_territories_geometry ON territories USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_territories_captured ON territories(captured_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_territories_activity_unique ON territories(activity_id);

-- 3. Create territory history for captures/defenses
CREATE TABLE IF NOT EXISTS territory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- 'claimed', 'captured', 'defended', 'lost'
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  area_change DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_territory ON territory_history(territory_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON territory_history(to_user_id, created_at DESC);

-- 4. Create user achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id, earned_at DESC);

-- 5. Function to calculate territory strength based on age and activity
CREATE OR REPLACE FUNCTION calculate_territory_strength(
  captured_date TIMESTAMPTZ,
  last_defended TIMESTAMPTZ,
  capture_count INT
)
RETURNS INT AS $$
DECLARE
  days_since_capture INT;
  days_since_defense INT;
  base_strength INT := 100;
  strength INT;
BEGIN
  days_since_capture := EXTRACT(DAY FROM NOW() - captured_date)::INT;
  days_since_defense := EXTRACT(DAY FROM NOW() - last_defended)::INT;
  
  -- Strength decays over time
  strength := base_strength - (days_since_defense * 2);
  
  -- Bonus for multiple successful defenses
  strength := strength + (capture_count * 5);
  
  -- Clamp between 10 and 150
  strength := GREATEST(10, LEAST(150, strength));
  
  RETURN strength;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Function to check if activity creates a valid territory loop
CREATE OR REPLACE FUNCTION is_valid_territory_loop(
  route_geom GEOMETRY
)
RETURNS BOOLEAN AS $$
DECLARE
  start_point GEOMETRY;
  end_point GEOMETRY;
  distance_meters DOUBLE PRECISION;
BEGIN
  -- Get start and end points
  start_point := ST_StartPoint(route_geom);
  end_point := ST_EndPoint(route_geom);
  
  -- Check if they're within 100 meters (close enough to form a loop)
  distance_meters := ST_Distance(start_point::geography, end_point::geography);
  
  RETURN distance_meters <= 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Function to create territory from activity (AREA-BASED CAPTURE with SMART LOOP DETECTION)
CREATE OR REPLACE FUNCTION create_territory_from_activity(
  p_activity_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_territory_id UUID;
  v_route_geom GEOMETRY;
  v_territory_geom GEOMETRY;
  v_area_sqm DOUBLE PRECISION;
  v_activity_name VARCHAR;
  v_captured_territories UUID[];
  v_is_simple BOOLEAN;
  v_is_closed_loop BOOLEAN;
  v_start_point GEOMETRY;
  v_end_point GEOMETRY;
  v_distance_meters DOUBLE PRECISION;
  v_corridor_width DOUBLE PRECISION := 50; -- 50 meters on each side = 100m total width
  v_territory_type VARCHAR(20);
BEGIN
  -- Get activity details
  SELECT route_geometry, name 
  INTO v_route_geom, v_activity_name
  FROM activities 
  WHERE id = p_activity_id AND user_id = p_user_id;
  
  IF v_route_geom IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;
  
  -- Check if start and end are close (traditional loop)
  v_start_point := ST_StartPoint(v_route_geom);
  v_end_point := ST_EndPoint(v_route_geom);
  v_distance_meters := ST_Distance(v_start_point::geography, v_end_point::geography);
  v_is_closed_loop := v_distance_meters <= 100;
  
  -- Check if route is simple (no self-intersections) or complex
  v_is_simple := ST_IsSimple(v_route_geom);
  
  -- CASE 1: Traditional closed loop (start/end match, no self-intersections)
  IF v_is_closed_loop AND v_is_simple THEN
    v_territory_type := 'polygon';
    
    -- Create polygon from route
    IF ST_IsClosed(v_route_geom) THEN
      v_territory_geom := ST_MakePolygon(v_route_geom);
    ELSE
      -- Close the loop by connecting end to start
      v_territory_geom := ST_MakePolygon(
        ST_AddPoint(v_route_geom, v_start_point)
      );
    END IF;
    
  -- CASE 2: Complex route with self-intersections (loops within route)
  ELSIF NOT v_is_simple THEN
    -- For self-intersecting routes, we need to:
    -- 1. Get all self-intersection points
    -- 2. Split the line at those points to create a network
    -- 3. Use ST_Polygonize on the network to extract closed loops
    
    WITH 
    -- Split the linestring at self-intersection points
    split_line AS (
      SELECT ST_Node(v_route_geom) as geom
    ),
    -- Polygonize the noded geometry to extract all loops
    polygons AS (
      SELECT (ST_Dump(ST_Polygonize(geom))).geom as poly
      FROM split_line
    ),
    -- Get the largest valid polygon
    largest_polygon AS (
      SELECT poly, ST_Area(poly::geography) as area
      FROM polygons
      WHERE ST_Area(poly::geography) > 1000 -- Minimum 1000 sqm to be valid
      ORDER BY area DESC
      LIMIT 1
    )
    SELECT poly INTO v_territory_geom FROM largest_polygon;
    
    -- If we found a loop, use it; otherwise fall back to corridor
    IF v_territory_geom IS NULL THEN
      v_territory_type := 'corridor';
      v_territory_geom := ST_Buffer(v_route_geom::geography, v_corridor_width)::geometry;
    ELSE
      v_territory_type := 'loop';
    END IF;
    
  -- CASE 3: Linear route (no loop) - create corridor
  ELSE
    v_territory_type := 'corridor';
    
    -- Create a buffer/corridor around the route
    -- Using geography for accurate meter-based buffer
    v_territory_geom := ST_Buffer(v_route_geom::geography, v_corridor_width)::geometry;
    
  END IF;
  
  -- Validate territory geometry
  IF v_territory_geom IS NULL OR NOT ST_IsValid(v_territory_geom) THEN
    v_territory_geom := ST_MakeValid(v_territory_geom);
    
    IF v_territory_geom IS NULL THEN
      RAISE EXCEPTION 'Could not create valid territory geometry';
    END IF;
  END IF;
  
  -- Calculate area
  v_area_sqm := ST_Area(v_territory_geom::geography);
  
  -- AREA-BASED CAPTURE: Transfer ownership of smaller overlapping territories
  -- Rule: Bigger area wins!
  WITH captured_territories AS (
    SELECT id, user_id, name, area_sqm
    FROM territories
    WHERE user_id != p_user_id
      AND ST_Intersects(geometry, v_territory_geom)
      AND area_sqm < v_area_sqm
  ),
  logged_captures AS (
    INSERT INTO territory_history (territory_id, action, from_user_id, to_user_id, activity_id, created_at)
    SELECT 
      id,
      'captured',
      user_id,
      p_user_id,
      p_activity_id,
      NOW()
    FROM captured_territories
    RETURNING territory_id, from_user_id
  ),
  transferred_territories AS (
    UPDATE territories t
    SET 
      user_id = p_user_id,
      captured_at = NOW()
    FROM captured_territories ct
    WHERE t.id = ct.id
    RETURNING t.id
  )
  SELECT array_agg(territory_id) INTO v_captured_territories FROM logged_captures;
  
  -- Create new territory
  INSERT INTO territories (
    user_id,
    activity_id,
    name,
    geometry,
    area_sqm,
    strength,
    territory_type
  )
  VALUES (
    p_user_id,
    p_activity_id,
    COALESCE(v_activity_name, 'Unnamed Territory'),
    v_territory_geom,
    v_area_sqm,
    100,
    v_territory_type
  )
  RETURNING id INTO v_territory_id;
  
  -- Log the claim
  INSERT INTO territory_history (
    territory_id,
    action,
    to_user_id,
    activity_id,
    area_change,
    created_at
  )
  VALUES (
    v_territory_id,
    'claimed',
    p_user_id,
    p_activity_id,
    v_area_sqm,
    NOW()
  );
  
  -- Update user stats
  UPDATE users
  SET 
    total_territories = total_territories + 1,
    total_area_sqm = total_area_sqm + v_area_sqm,
    last_activity_at = NOW()
  WHERE id = p_user_id;
  
  RETURN v_territory_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to get territories in viewport with owner info
CREATE OR REPLACE FUNCTION get_territories_in_bounds(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name VARCHAR,
  user_color VARCHAR,
  name VARCHAR,
  territory_geometry GEOMETRY,
  territory_type VARCHAR,
  area_sqm DOUBLE PRECISION,
  strength INT,
  captured_at TIMESTAMPTZ,
  days_held INT,
  activity_id UUID,
  activity_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    u.name as user_name,
    u.color as user_color,
    t.name,
    t.geometry as territory_geometry,
    COALESCE(t.territory_type, 'polygon') as territory_type,
    t.area_sqm::DOUBLE PRECISION as area_sqm,
    calculate_territory_strength(t.captured_at, t.last_defended_at, t.capture_count) as strength,
    t.captured_at::TIMESTAMPTZ as captured_at,
    EXTRACT(DAY FROM NOW() - t.captured_at)::INT as days_held,
    t.activity_id,
    a.type as activity_type
  FROM territories t
  JOIN users u ON t.user_id = u.id
  LEFT JOIN activities a ON t.activity_id = a.id
  WHERE ST_Intersects(
    t.geometry,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  )
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Function to get leaderboard
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

-- 10. Function to update all territory strengths (run periodically)
CREATE OR REPLACE FUNCTION update_territory_strengths()
RETURNS void AS $$
BEGIN
  UPDATE territories
  SET 
    strength = calculate_territory_strength(captured_at, last_defended_at, capture_count),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_area ON users(total_area_sqm DESC);
CREATE INDEX IF NOT EXISTS idx_users_territories ON users(total_territories DESC);
CREATE INDEX IF NOT EXISTS idx_territories_strength ON territories(strength DESC);
