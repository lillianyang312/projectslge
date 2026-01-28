-- Add pickup_decided_at to track when the pickup time was decided

ALTER TABLE deals ADD COLUMN IF NOT EXISTS pickup_decided_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN deals.pickup_decided_at IS 'Timestamp when the pickup time was decided/agreed upon';
