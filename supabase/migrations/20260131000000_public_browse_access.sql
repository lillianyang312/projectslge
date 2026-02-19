-- Allow anonymous (website) users to browse active items
-- The existing policy "Users can view all items for browsing" uses:
--   USING (is_active = true OR auth.uid() = owner_id)
-- This already works for anon since is_active = true passes regardless of auth.uid()
-- But we need to ensure the anon role has usage on the schema

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON items TO anon;

-- Make item-images bucket public so images can be loaded on the website
-- without requiring authentication for signed URLs
UPDATE storage.buckets
SET public = true
WHERE id = 'item-images';
