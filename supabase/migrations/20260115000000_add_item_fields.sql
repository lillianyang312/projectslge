-- Add missing fields to items table for the upload flow

-- Title field (currently using 'label' but we need 'title')
ALTER TABLE items ADD COLUMN IF NOT EXISTS title TEXT;

-- Photos array (to store multiple image paths)
ALTER TABLE items ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- Estimated value fields (aliasing to the existing market_value fields for clarity)
-- Using new column names to match the app code
ALTER TABLE items ADD COLUMN IF NOT EXISTS estimated_value_min NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS estimated_value_max NUMERIC;

-- Minimum price the seller will accept
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_price NUMERIC;

-- Update RLS policy to allow users to view all items (for browsing)
DROP POLICY IF EXISTS "Users can view all items for browsing" ON items;
CREATE POLICY "Users can view all items for browsing"
  ON items FOR SELECT
  USING (is_active = true OR auth.uid() = owner_id);
