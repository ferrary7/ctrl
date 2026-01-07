-- Reset all data for fresh testing
-- Run this in Supabase SQL Editor

-- Disable foreign key constraints temporarily
SET session_replication_role = 'replica';

-- Delete all data from tables (in order to respect dependencies)
TRUNCATE TABLE territory_history CASCADE;
TRUNCATE TABLE territories CASCADE;
TRUNCATE TABLE activities CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable foreign key constraints
SET session_replication_role = 'origin';

-- Verify all tables are empty
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'activities', COUNT(*) FROM activities
UNION ALL
SELECT 'territories', COUNT(*) FROM territories
UNION ALL
SELECT 'territory_history', COUNT(*) FROM territory_history;
