-- Add full-text search support for items table
-- Uses PostgreSQL tsvector and GIN indexes for fast search

-- Add search_vector column (computed tsvector combining title, description, and category)
ALTER TABLE items ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_items_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS update_items_search_vector ON items;
CREATE TRIGGER update_items_search_vector
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_items_search_vector();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS items_search_vector_idx ON items USING GIN (search_vector);

-- Update existing rows to populate search_vector
UPDATE items SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C')
WHERE search_vector IS NULL;

-- Create RPC function for full-text search with pagination
CREATE OR REPLACE FUNCTION search_items(
  search_text TEXT,
  exclude_user_id UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 10,
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  description TEXT,
  condition TEXT,
  photos TEXT[],
  estimated_value_min NUMERIC,
  estimated_value_max NUMERIC,
  owner_id UUID,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.title,
    i.category,
    i.description,
    i.condition,
    i.photos,
    i.estimated_value_min,
    i.estimated_value_max,
    i.owner_id,
    i.created_at,
    ts_rank(i.search_vector, plainto_tsquery('english', search_text))::REAL as rank
  FROM items i
  WHERE 
    i.search_vector @@ plainto_tsquery('english', search_text)
    AND (exclude_user_id IS NULL OR i.owner_id != exclude_user_id)
    AND (
      cursor_created_at IS NULL OR
      cursor_id IS NULL OR
      i.created_at < cursor_created_at OR
      (i.created_at = cursor_created_at AND i.id < cursor_id)
    )
    AND i.is_active = true
  ORDER BY 
    rank DESC,
    i.created_at DESC,
    i.id DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION search_items TO authenticated;
GRANT EXECUTE ON FUNCTION search_items TO service_role;

