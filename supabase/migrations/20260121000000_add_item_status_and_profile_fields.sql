-- Add item status for tracking sold/removed items
ALTER TABLE items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- Status values: 'active', 'sold', 'removed'

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);

-- Add separate first/last name and payment preferences to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_preference TEXT; -- 'cash', 'zelle', 'venmo', or comma-separated like 'cash,zelle'
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS dorm_location TEXT; -- Full dorm location string for easy sharing

-- Update existing profiles to split full_name into first/last
-- This is a one-time data migration
UPDATE user_profiles
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND full_name IS NOT NULL;
