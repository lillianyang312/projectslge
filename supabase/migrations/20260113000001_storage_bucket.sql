-- Create storage bucket for item images
-- Only run if storage schema exists (available in production, may not be in local dev)
DO $$
BEGIN
  -- Check if storage.buckets table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'storage' 
    AND table_name = 'buckets'
  ) THEN
    -- Create bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'item-images',
      'item-images',
      false,  -- Not public, use signed URLs
      5242880,  -- 5MB limit
      ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Storage RLS Policies for item-images bucket
    -- Users can upload to their own folder
    DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
    CREATE POLICY "Users can upload to their folder"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'item-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    -- Users can view their own files
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    CREATE POLICY "Users can view their own files"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'item-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    -- Users can update their own files
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    CREATE POLICY "Users can update their own files"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'item-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'item-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    -- Users can delete their own files
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
    CREATE POLICY "Users can delete their own files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'item-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    -- Allow service role to access all files (for Edge Functions)
    DROP POLICY IF EXISTS "Service role can access all files" ON storage.objects;
    CREATE POLICY "Service role can access all files"
      ON storage.objects FOR ALL
      USING (auth.role() = 'service_role');
  ELSE
    RAISE NOTICE 'Storage schema not available, skipping storage bucket creation. This is normal for local development.';
  END IF;
END $$;
