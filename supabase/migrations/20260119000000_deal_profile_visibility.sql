-- Allow deal participants to view each other's profiles after deal is accepted
-- This enables buyers and sellers to see each other's names for coordination

-- Policy: Users can view profiles of other users they have accepted deals with
CREATE POLICY "Users can view deal counterparty profiles"
  ON user_profiles FOR SELECT
  USING (
    -- Allow if user is in an accepted deal with this profile owner
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.status IN ('agreed', 'logistics', 'completed')
      AND (
        -- Current user is buyer, profile owner is seller
        (deals.buyer_id = auth.uid() AND deals.seller_id = user_profiles.id)
        OR
        -- Current user is seller, profile owner is buyer
        (deals.seller_id = auth.uid() AND deals.buyer_id = user_profiles.id)
      )
    )
  );
