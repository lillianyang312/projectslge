-- Deals system overhaul: track buyer's offer separately from current_offer
-- current_offer gets overwritten by both buyer offers AND seller counter-offers
-- buyer_offer only tracks what the buyer has actually offered

ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_offer NUMERIC;

-- Backfill: for deals where the buyer made the last offer, copy current_offer to buyer_offer
UPDATE deals
SET buyer_offer = current_offer
WHERE last_offer_by = buyer_id AND current_offer IS NOT NULL;

-- Index for efficient top-bid queries (used by getTopBidsForItems)
CREATE INDEX IF NOT EXISTS deals_item_id_buyer_offer_idx ON deals(item_id, buyer_offer);
