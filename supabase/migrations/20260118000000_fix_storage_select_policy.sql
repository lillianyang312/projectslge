-- Fix storage SELECT policy to allow all authenticated users to view item images
-- The original policy only allowed users to view their own files, but users need
-- to view other users' item images when browsing
-- Only run if storage schema exists (available in production, may not be in local dev)

DO $$
BEGIN
  -- Check if storage.objects table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'storage' 
    AND table_name = 'objects'
  ) THEN
    -- Drop the old restrictive policy
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;

    -- Create a new policy allowing all authenticated users to view item images
    DROP POLICY IF EXISTS "Authenticated users can view item images" ON storage.objects;
    CREATE POLICY "Authenticated users can view item images"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'item-images' AND
        auth.role() = 'authenticated'
      );
  ELSE
    RAISE NOTICE 'Storage schema not available, skipping storage policy update. This is normal for local development.';
  END IF;
END $$;
