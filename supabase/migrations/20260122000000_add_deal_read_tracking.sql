-- Add read tracking to deals table
-- Tracks when each party last read the conversation

ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_last_read_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ;

-- Comment explaining the fields
COMMENT ON COLUMN deals.buyer_last_read_at IS 'When the buyer last read messages in this deal';
COMMENT ON COLUMN deals.seller_last_read_at IS 'When the seller last read messages in this deal';
