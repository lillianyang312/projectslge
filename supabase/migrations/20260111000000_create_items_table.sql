-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  image_url TEXT,
  label TEXT NOT NULL DEFAULT '',
  confidence NUMERIC,
  category TEXT,
  description TEXT,
  notes TEXT,
  phase TEXT DEFAULT 'original',
  intent TEXT DEFAULT 'owned',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on owner_id for faster queries
CREATE INDEX IF NOT EXISTS items_owner_id_idx ON items(owner_id);
CREATE INDEX IF NOT EXISTS items_phase_idx ON items(phase);
CREATE INDEX IF NOT EXISTS items_created_at_idx ON items(created_at DESC);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own items
CREATE POLICY "Users can view their own items"
  ON items FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own items"
  ON items FOR DELETE
  USING (auth.uid() = owner_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
