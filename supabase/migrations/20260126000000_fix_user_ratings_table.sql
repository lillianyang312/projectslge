-- Fix user_ratings table - use correct table name (user_profiles instead of profiles)

-- Add missing columns to user_profiles if they don't exist
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sales_completed INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS purchases_completed INTEGER DEFAULT 0;

-- Drop the old user_ratings table if it exists with wrong foreign keys
DROP TABLE IF EXISTS user_ratings CASCADE;

-- Create ratings table with correct foreign key references
CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  rated_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deal_id, rater_id)
);

-- Enable RLS
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_ratings
CREATE POLICY "Users can view ratings for their deals"
  ON user_ratings FOR SELECT
  USING (
    rater_id = auth.uid() OR
    rated_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = user_ratings.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can create ratings for deals they're part of"
  ON user_ratings FOR INSERT
  WITH CHECK (
    rater_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())
      AND deals.status IN ('logistics', 'completed')
    )
  );

-- Function to update user rating average
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET
    rating = (SELECT AVG(rating)::DECIMAL(2,1) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id),
    rating_count = (SELECT COUNT(*) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id)
  WHERE id = NEW.rated_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update rating on new ratings
DROP TRIGGER IF EXISTS update_rating_trigger ON user_ratings;
CREATE TRIGGER update_rating_trigger
AFTER INSERT OR UPDATE ON user_ratings
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_user ON user_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_deal ON user_ratings(deal_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at);
