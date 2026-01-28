-- Add retail_price field to items table
-- This stores the original retail price of the item (user-provided)

ALTER TABLE items ADD COLUMN IF NOT EXISTS retail_price NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN items.retail_price IS 'Original retail price of the item when new (user-provided)';
