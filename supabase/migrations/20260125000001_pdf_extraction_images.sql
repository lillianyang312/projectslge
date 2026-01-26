-- Create table for extracted images
CREATE TABLE IF NOT EXISTS pdf_extraction_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES pdf_extraction_jobs(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  image_index INT NOT NULL,
  storage_path TEXT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, page_number, image_index)
);

-- Add image_ids to items table
ALTER TABLE pdf_extraction_items
  ADD COLUMN IF NOT EXISTS image_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Create index
CREATE INDEX IF NOT EXISTS idx_pdf_images_job_page ON pdf_extraction_images(job_id, page_number);

-- Enable RLS
ALTER TABLE pdf_extraction_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view images for their jobs" ON pdf_extraction_images;
CREATE POLICY "Users can view images for their jobs"
  ON pdf_extraction_images FOR SELECT
  USING (job_id IN (SELECT id FROM pdf_extraction_jobs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can manage extraction images" ON pdf_extraction_images;
CREATE POLICY "Service role can manage extraction images"
  ON pdf_extraction_images FOR ALL
  USING (auth.role() = 'service_role');

-- Create storage bucket if it doesn't exist
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
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('pdf-extraction-images', 'pdf-extraction-images', true)
    ON CONFLICT (id) DO NOTHING;

    -- Storage policies
    DROP POLICY IF EXISTS "Users can view images from their jobs" ON storage.objects;
    CREATE POLICY "Users can view images from their jobs"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'pdf-extraction-images' AND
             (storage.foldername(name))[1] IN (
               SELECT id::text FROM pdf_extraction_jobs WHERE user_id = auth.uid()
             ));

    DROP POLICY IF EXISTS "Service role can upload images" ON storage.objects;
    CREATE POLICY "Service role can upload images"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'pdf-extraction-images' AND auth.role() = 'service_role');
  ELSE
    RAISE NOTICE 'Storage schema not available, skipping PDF extraction images storage setup. This is normal for local development.';
  END IF;
END $$;
