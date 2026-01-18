-- Delete smoke test items and related data
-- This migration cleans up test data created by smoke tests

-- First delete any deals associated with smoke test items
DELETE FROM deals WHERE item_id IN (
  SELECT id FROM items WHERE
    title LIKE '%Smoke Test%' OR
    title LIKE '%Test Item%' OR
    description LIKE '%Smoke test%' OR
    description LIKE '%smoke test%'
);

-- Delete smoke test items
DELETE FROM items WHERE
  title LIKE '%Smoke Test%' OR
  title LIKE '%Test Item%' OR
  description LIKE '%Smoke test%' OR
  description LIKE '%smoke test%';

-- Delete any test wants
DELETE FROM wants WHERE
  query LIKE '%Test Want%' OR
  query LIKE '%Smoke Test%';

-- Optional: Delete test users (be careful with this!)
-- Only uncomment if you want to remove test users too
-- DELETE FROM user_profiles WHERE
--   display_name LIKE '%Test%' OR
--   email LIKE '%test@example%';
