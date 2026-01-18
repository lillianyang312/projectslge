-- Migration: Add expiration tracking and question flag to deals
-- This supports:
-- 1. Hard expiration of offers based on buyer's "interested for" duration
-- 2. Distinguishing between question-only deals and bid deals

-- Add expiration tracking columns
ALTER TABLE deals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS interested_for TEXT;

-- Add question flag to identify question-only deals (no bid)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_question BOOLEAN DEFAULT false;

-- Add index for querying expired deals
CREATE INDEX IF NOT EXISTS idx_deals_expires_at ON deals(expires_at) WHERE expires_at IS NOT NULL;

-- Add index for querying question-only deals
CREATE INDEX IF NOT EXISTS idx_deals_is_question ON deals(is_question) WHERE is_question = true;

-- Comment explaining the columns
COMMENT ON COLUMN deals.expires_at IS 'When this offer/interest expires. Null means no expiration.';
COMMENT ON COLUMN deals.interested_for IS 'Duration string: 1 week, 2 weeks, 1 month, or Flexible';
COMMENT ON COLUMN deals.is_question IS 'True if this deal was created via Ask Question (no bid), false for regular bids';
