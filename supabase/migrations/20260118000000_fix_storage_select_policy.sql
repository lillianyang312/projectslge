-- Fix storage SELECT policy to allow all authenticated users to view item images
-- The original policy only allowed users to view their own files, but users need
-- to view other users' item images when browsing

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;

-- Create a new policy allowing all authenticated users to view item images
CREATE POLICY "Authenticated users can view item images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'item-images' AND
    auth.role() = 'authenticated'
  );
