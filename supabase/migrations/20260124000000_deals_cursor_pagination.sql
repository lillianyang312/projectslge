-- Deals Cursor Pagination Indexes
-- Adds composite indexes for efficient cursor-based pagination on deals table

-- Index for cursor pagination: (updated_at DESC, id DESC)
-- Supports queries filtering by buyer_id/seller_id with cursor
CREATE INDEX IF NOT EXISTS idx_deals_updated_at_id_desc 
ON deals(updated_at DESC, id DESC);

-- Index for buyer_id + updated_at for buyer queries
CREATE INDEX IF NOT EXISTS idx_deals_buyer_updated_at 
ON deals(buyer_id, updated_at DESC, id DESC);

-- Index for seller_id + updated_at for seller queries  
CREATE INDEX IF NOT EXISTS idx_deals_seller_updated_at 
ON deals(seller_id, updated_at DESC, id DESC);

