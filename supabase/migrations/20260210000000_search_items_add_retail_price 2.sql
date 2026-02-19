-- Update search_items RPC to also return retail_price
-- Must DROP first because return type is changing (adding retail_price column)
DROP FUNCTION IF EXISTS search_items(TEXT, UUID, INTEGER, TIMESTAMPTZ, UUID);

CREATE FUNCTION search_items(
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
  retail_price NUMERIC,
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
    i.retail_price,
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

-- Re-grant permissions after recreating function
GRANT EXECUTE ON FUNCTION search_items TO authenticated;
GRANT EXECUTE ON FUNCTION search_items TO service_role;
