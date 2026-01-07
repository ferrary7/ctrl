-- Function to get activities within a bounding box
CREATE OR REPLACE FUNCTION get_activities_in_bounds(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name VARCHAR,
  type VARCHAR,
  distance NUMERIC,
  route_geometry GEOMETRY,
  territory_geometry GEOMETRY,
  area_sqm DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.name,
    a.type,
    a.distance,
    a.route_geometry,
    -- Create territory by buffering route (50m radius)
    ST_Buffer(a.route_geometry::geography, 50)::geometry as territory_geometry,
    -- Calculate area in square meters
    ST_Area(ST_Buffer(a.route_geometry::geography, 50)) as area_sqm
  FROM activities a
  WHERE ST_Intersects(
    a.route_geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql STABLE;
