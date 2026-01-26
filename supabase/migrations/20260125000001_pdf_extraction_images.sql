-- Create table for extracted images
CREATE TABLE pdf_extraction_images (
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
  ADD COLUMN image_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Create index
CREATE INDEX idx_pdf_images_job_page ON pdf_extraction_images(job_id, page_number);

-- Enable RLS
ALTER TABLE pdf_extraction_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view images for their jobs"
  ON pdf_extraction_images FOR SELECT
  USING (job_id IN (SELECT id FROM pdf_extraction_jobs WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage extraction images"
  ON pdf_extraction_images FOR ALL
  USING (auth.role() = 'service_role');

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-extraction-images', 'pdf-extraction-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view images from their jobs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdf-extraction-images' AND
         (storage.foldername(name))[1] IN (
           SELECT id::text FROM pdf_extraction_jobs WHERE user_id = auth.uid()
         ));

CREATE POLICY "Service role can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pdf-extraction-images' AND auth.role() = 'service_role');
