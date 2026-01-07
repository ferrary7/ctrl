-- Advanced Territory System with Loop Detection and Corridor Support
-- Run this in Supabase SQL Editor AFTER running territories_system.sql

-- Add territory_type column to territories table
ALTER TABLE territories 
ADD COLUMN IF NOT EXISTS territory_type VARCHAR(20) DEFAULT 'polygon' CHECK (territory_type IN ('polygon', 'corridor', 'loop'));

-- Drop and recreate the territory creation function with smart loop detection
DROP FUNCTION IF EXISTS create_territory_from_activity(UUID, UUID);

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
    RAISE NOTICE 'Creating polygon territory from closed loop';
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
    RAISE NOTICE 'Detecting loops within complex route';
    
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
      RAISE NOTICE 'No valid loops found, creating corridor territory';
      v_territory_type := 'corridor';
      v_territory_geom := ST_Buffer(v_route_geom::geography, v_corridor_width)::geometry;
    ELSE
      RAISE NOTICE 'Loop detected with area: % sqm', ST_Area(v_territory_geom::geography);
      v_territory_type := 'loop';
    END IF;
    
  -- CASE 3: Linear route (no loop) - create corridor
  ELSE
    RAISE NOTICE 'Creating corridor territory from linear route';
    v_territory_type := 'corridor';
    
    -- Create a buffer/corridor around the route
    -- Using geography for accurate meter-based buffer
    v_territory_geom := ST_Buffer(v_route_geom::geography, v_corridor_width)::geometry;
    
  END IF;
  
  -- Validate territory geometry
  IF v_territory_geom IS NULL OR NOT ST_IsValid(v_territory_geom) THEN
    RAISE NOTICE 'Invalid territory geometry, attempting to fix';
    v_territory_geom := ST_MakeValid(v_territory_geom);
    
    IF v_territory_geom IS NULL THEN
      RAISE EXCEPTION 'Could not create valid territory geometry';
    END IF;
  END IF;
  
  -- Calculate area
  v_area_sqm := ST_Area(v_territory_geom::geography);
  
  -- AREA-BASED CAPTURE: Transfer ownership of smaller overlapping territories
  -- Rule: Bigger area wins! But we KEEP the territory (just change owner)
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
  
  IF v_captured_territories IS NOT NULL AND array_length(v_captured_territories, 1) > 0 THEN
    RAISE NOTICE 'Captured and transferred ownership of % territories', array_length(v_captured_territories, 1);
  END IF;
  
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
  
  RAISE NOTICE 'Created territory % with area % sqm', v_territory_id, v_area_sqm;
  
  RETURN v_territory_id;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION create_territory_from_activity IS 
'Smart territory creation supporting three cases:
1. Closed loops (start/end within 100m) → Full polygon
2. Self-intersecting routes (marathon with loop) → Extract largest loop polygon  
3. Linear routes → 50m corridor buffer
Always uses area-based capture (larger area wins)';
