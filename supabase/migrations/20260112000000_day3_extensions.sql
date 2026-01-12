-- Day 3: Intelligence & Market Behavior Extensions

-- Add Day 3 fields to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS condition TEXT; -- 'new', 'like_new', 'good', 'fair', 'poor'
ALTER TABLE items ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'flexible'; -- 'urgent', 'moderate', 'flexible'
ALTER TABLE items ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'either'; -- 'pickup', 'shipping', 'either'
ALTER TABLE items ADD COLUMN IF NOT EXISTS market_value_min NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS market_value_max NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS market_value_confidence NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS user_min_price NUMERIC; -- User's minimum acceptable price
ALTER TABLE items ADD COLUMN IF NOT EXISTS user_max_price NUMERIC; -- User's maximum willing to pay (for wants)

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  want_id UUID REFERENCES items(id) ON DELETE SET NULL, -- Optional: if matched from a want
  match_score NUMERIC NOT NULL DEFAULT 0, -- 0-100 compatibility score
  status TEXT DEFAULT 'active', -- 'active', 'deal', 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(buyer_id, seller_id, item_id)
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'negotiating', -- 'negotiating', 'agreed', 'logistics', 'completed', 'cancelled'
  current_offer NUMERIC,
  last_offer_by UUID REFERENCES auth.users(id),
  agreed_price NUMERIC,
  delivery_method TEXT, -- 'pickup', 'shipping'
  pickup_location TEXT,
  pickup_date TIMESTAMPTZ,
  shipping_address TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create messages table for chat
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for agent messages
  is_agent BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'offer', 'counter', 'quick_action', 'system'
  metadata JSONB, -- For storing offer amounts, quick action types, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create swipe_actions table to track user swipes
CREATE TABLE IF NOT EXISTS swipe_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'good_deal', 'skip', 'save', 'accept', 'decline'
  context TEXT, -- 'buy' or 'sell' to track which swipe mode
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id, context)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS matches_buyer_id_idx ON matches(buyer_id);
CREATE INDEX IF NOT EXISTS matches_seller_id_idx ON matches(seller_id);
CREATE INDEX IF NOT EXISTS matches_item_id_idx ON matches(item_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

CREATE INDEX IF NOT EXISTS deals_match_id_idx ON deals(match_id);
CREATE INDEX IF NOT EXISTS deals_buyer_id_idx ON deals(buyer_id);
CREATE INDEX IF NOT EXISTS deals_seller_id_idx ON deals(seller_id);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals(status);

CREATE INDEX IF NOT EXISTS messages_deal_id_idx ON messages(deal_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

CREATE INDEX IF NOT EXISTS swipe_actions_user_id_idx ON swipe_actions(user_id);
CREATE INDEX IF NOT EXISTS swipe_actions_item_id_idx ON swipe_actions(item_id);

-- Enable Row Level Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matches
CREATE POLICY "Users can view their own matches"
  ON matches FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can insert matches they're part of"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update their own matches"
  ON matches FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for deals
CREATE POLICY "Users can view their own deals"
  ON deals FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can insert deals they're part of"
  ON deals FOR INSERT
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update their own deals"
  ON deals FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their deals"
  ON messages FOR SELECT
  USING (
    deal_id IN (
      SELECT id FROM deals WHERE auth.uid() = buyer_id OR auth.uid() = seller_id
    )
  );

CREATE POLICY "Users can send messages in their deals"
  ON messages FOR INSERT
  WITH CHECK (
    deal_id IN (
      SELECT id FROM deals WHERE auth.uid() = buyer_id OR auth.uid() = seller_id
    )
  );

-- RLS Policies for swipe_actions
CREATE POLICY "Users can view their own swipe actions"
  ON swipe_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own swipe actions"
  ON swipe_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own swipe actions"
  ON swipe_actions FOR UPDATE
  USING (auth.uid() = user_id);

-- Update triggers
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
