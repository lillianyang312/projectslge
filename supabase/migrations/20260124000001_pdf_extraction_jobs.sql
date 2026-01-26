-- Create tables for PDF extraction job queue system

-- Track overall PDF extraction jobs
CREATE TABLE pdf_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_pages INT,
  pages_processed INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Track individual page extraction status
CREATE TABLE pdf_extraction_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES pdf_extraction_jobs(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  text_content TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, page_number)
);

-- Store extracted items before user confirms and creates them
CREATE TABLE pdf_extraction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES pdf_extraction_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  condition TEXT,
  user_min_price NUMERIC,
  user_max_price NUMERIC,
  is_sold BOOLEAN DEFAULT false,
  confidence NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_pdf_jobs_user_status ON pdf_extraction_jobs(user_id, status);
CREATE INDEX idx_pdf_jobs_created ON pdf_extraction_jobs(created_at DESC);
CREATE INDEX idx_pdf_pages_job_status ON pdf_extraction_pages(job_id, status);
CREATE INDEX idx_pdf_items_job ON pdf_extraction_items(job_id);

-- Enable RLS
ALTER TABLE pdf_extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_extraction_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_extraction_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pdf_extraction_jobs
CREATE POLICY "Users can view their own extraction jobs"
  ON pdf_extraction_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage extraction jobs"
  ON pdf_extraction_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for pdf_extraction_pages
CREATE POLICY "Users can view pages for their jobs"
  ON pdf_extraction_pages FOR SELECT
  USING (job_id IN (SELECT id FROM pdf_extraction_jobs WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage extraction pages"
  ON pdf_extraction_pages FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for pdf_extraction_items
CREATE POLICY "Users can view items for their jobs"
  ON pdf_extraction_items FOR SELECT
  USING (job_id IN (SELECT id FROM pdf_extraction_jobs WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage extraction items"
  ON pdf_extraction_items FOR ALL
  USING (auth.role() = 'service_role');
