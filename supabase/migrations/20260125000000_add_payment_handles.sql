-- Add Zelle and Venmo handle columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zelle_handle TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS venmo_handle TEXT;

COMMENT ON COLUMN user_profiles.zelle_handle IS 'User Zelle handle (phone or email)';
COMMENT ON COLUMN user_profiles.venmo_handle IS 'User Venmo handle (@username)';
