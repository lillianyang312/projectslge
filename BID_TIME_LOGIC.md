# Bid Time Logic System

## Overview

Implements time-based logic for bids to handle the natural decay of buyer interest over time. This prevents stale bids from cluttering the seller's view and ensures active buyers get priority.

## Core Concepts

### 1. Bid Lifecycle States

```typescript
type BidState =
  | 'pending_questions'    // Waiting for seller to answer questions
  | 'active'               // Questions answered, bid is live
  | 'stale'                // Been active too long, needs refresh
  | 'expired'              // Auto-expired, no longer valid
  | 'withdrawn'            // Buyer manually withdrew
  | 'accepted'             // Seller accepted
  | 'rejected'             // Seller rejected

interface BidTimestamps {
  created_at: timestamp;              // When bid was submitted
  questions_answered_at?: timestamp;  // When seller answered questions
  activated_at?: timestamp;           // When bid became active
  last_buyer_activity?: timestamp;    // Last time buyer engaged
  expires_at: timestamp;              // Hard expiration deadline
  stale_warning_at: timestamp;        // When to warn about staleness
  withdrawn_at?: timestamp;
  accepted_at?: timestamp;
  rejected_at?: timestamp;
}
```

### 2. Time Windows

```typescript
const BID_TIME_WINDOWS = {
  // Question phase
  QUESTION_ANSWER_TIMEOUT: 48 * 60 * 60 * 1000,  // 48 hours for seller to answer

  // Active bid phase
  BID_ACTIVE_DURATION: 7 * 24 * 60 * 60 * 1000,  // 7 days active before stale
  BID_STALE_WARNING: 5 * 24 * 60 * 60 * 1000,    // 5 days - show "expiring soon"

  // Buyer engagement
  BUYER_ACTIVITY_TIMEOUT: 24 * 60 * 60 * 1000,   // 24 hours to respond to messages

  // Competitive bidding
  BIDDING_ROUND_TIMEOUT: 24 * 60 * 60 * 1000,    // 24 hours per round

  // Refresh/extension
  BID_REFRESH_EXTENSION: 3 * 24 * 60 * 60 * 1000, // 3 days extension on refresh
};
```

## Implementation Details

### 1. Automatic Bid Expiration

```typescript
async function checkAndExpireBids(): Promise<void> {
  const now = Date.now();

  // Find all bids that should expire
  const bidsToExpire = await db.query(`
    SELECT * FROM bids
    WHERE state IN ('pending_questions', 'active', 'stale')
    AND expires_at <= $1
  `, [now]);

  for (const bid of bidsToExpire) {
    await expireBid(bid.id, 'timeout');

    // Notify buyer
    await notifyBuyer(bid.buyer_id, {
      type: 'bid_expired',
      item_id: bid.item_id,
      reason: 'Your bid expired due to inactivity',
      can_resubmit: true,
    });

    // Notify seller if bid was active
    if (bid.state === 'active') {
      await notifySeller(bid.item_id, {
        type: 'bid_expired',
        buyer_count_changed: true,
      });
    }
  }

  // Re-rank remaining bids
  const affectedItems = [...new Set(bidsToExpire.map(b => b.item_id))];
  for (const itemId of affectedItems) {
    await updateBidRanking(itemId);
  }
}

// Run every hour
setInterval(checkAndExpireBids, 60 * 60 * 1000);
```

### 2. Staleness Detection & Warnings

```typescript
async function detectStaleBids(): Promise<void> {
  const now = Date.now();

  // Find bids approaching expiration
  const staleBids = await db.query(`
    SELECT * FROM bids
    WHERE state = 'active'
    AND stale_warning_at <= $1
    AND expires_at > $1
  `, [now]);

  for (const bid of staleBids) {
    // Mark as stale
    await db.query(`
      UPDATE bids
      SET state = 'stale',
          updated_at = NOW()
      WHERE id = $1
    `, [bid.id]);

    // Calculate time remaining
    const hoursRemaining = Math.floor((bid.expires_at - now) / (60 * 60 * 1000));

    // Notify buyer with refresh option
    await notifyBuyer(bid.buyer_id, {
      type: 'bid_expiring_soon',
      item_id: bid.item_id,
      hours_remaining: hoursRemaining,
      can_refresh: true,
    });

    // Update seller's view (lower priority)
    await updateBidRanking(bid.item_id);
  }
}
```

### 3. Buyer Activity Tracking

```typescript
async function trackBuyerActivity(
  bidId: string,
  activityType: 'message' | 'bid_update' | 'view_item'
): Promise<void> {
  const now = Date.now();

  await db.query(`
    UPDATE bids
    SET last_buyer_activity = $1,
        updated_at = NOW()
    WHERE id = $2
  `, [now, bidId]);

  // Reset staleness if bid was stale but buyer is active
  const bid = await getBidById(bidId);
  if (bid.state === 'stale') {
    await refreshBid(bidId);
  }
}

async function checkBuyerResponsiveness(bidId: string): Promise<boolean> {
  const bid = await getBidById(bidId);
  const timeSinceActivity = Date.now() - bid.last_buyer_activity;

  // If buyer hasn't responded in 24 hours during negotiation
  if (bid.pending_seller_response && timeSinceActivity > BID_TIME_WINDOWS.BUYER_ACTIVITY_TIMEOUT) {
    await markBuyerUnresponsive(bidId);
    return false;
  }

  return true;
}
```

### 4. Bid Refresh Mechanism

```typescript
async function refreshBid(bidId: string): Promise<void> {
  const bid = await getBidById(bidId);
  const now = Date.now();

  // Extend expiration by 3 days
  const newExpiresAt = now + BID_TIME_WINDOWS.BID_REFRESH_EXTENSION;
  const newStaleWarningAt = now + BID_TIME_WINDOWS.BID_STALE_WARNING;

  await db.query(`
    UPDATE bids
    SET state = 'active',
        expires_at = $1,
        stale_warning_at = $2,
        last_buyer_activity = $3,
        updated_at = NOW()
    WHERE id = $4
  `, [newExpiresAt, newStaleWarningAt, now, bidId]);

  // Notify seller of renewed interest
  await notifySeller(bid.item_id, {
    type: 'bid_refreshed',
    bid_id: bidId,
    message: 'A buyer renewed their interest in your item',
  });

  // Re-rank (fresh bids get priority boost)
  await updateBidRanking(bid.item_id);
}

// Buyer-initiated refresh
async function handleBuyerRefreshRequest(
  bidId: string,
  buyerId: string
): Promise<void> {
  const bid = await getBidById(bidId);

  // Verify ownership
  if (bid.buyer_id !== buyerId) {
    throw new Error('Unauthorized');
  }

  // Check if bid can be refreshed
  if (!['active', 'stale'].includes(bid.state)) {
    throw new Error('Bid cannot be refreshed');
  }

  await refreshBid(bidId);

  // Notify buyer of success
  await notifyBuyer(buyerId, {
    type: 'bid_refreshed_success',
    item_id: bid.item_id,
    new_expiration: bid.expires_at,
  });
}
```

### 5. Time-Based Scoring Adjustments

```typescript
function calculateTimeBasedScore(bid: Bid): number {
  const now = Date.now();
  const bidAge = now - bid.activated_at;
  const timeSinceActivity = now - bid.last_buyer_activity;

  // Recency score: newer bids get higher scores
  const recencyScore = Math.max(0, 100 - (bidAge / (24 * 60 * 60 * 1000)) * 5);

  // Activity score: recent buyer activity boosts score
  const activityScore = timeSinceActivity < 60 * 60 * 1000 ? 100 : // Active in last hour
                       timeSinceActivity < 24 * 60 * 60 * 1000 ? 75 : // Active today
                       timeSinceActivity < 3 * 24 * 60 * 60 * 1000 ? 50 : // Active this week
                       25; // Inactive

  // Staleness penalty
  const stalenessPenalty = bid.state === 'stale' ? -30 : 0;

  // Time remaining score: expiring soon gets lower priority
  const timeRemaining = bid.expires_at - now;
  const timeRemainingScore = Math.min(100, (timeRemaining / (24 * 60 * 60 * 1000)) * 20);

  return (
    recencyScore * 0.3 +
    activityScore * 0.4 +
    timeRemainingScore * 0.3 +
    stalenessPenalty
  );
}

// Update the main scoring function
function calculateBidScore(
  bid: BuyerInterest,
  seller: Item,
  buyer: BuyerProfile
): BidScore {
  // ... existing price, quality, convenience, urgency scores ...

  const timeScore = calculateTimeBasedScore(bid);

  // Composite score with time factor
  const score = (
    priceScore * 0.40 +           // Price (40%)
    buyerQualityScore * 0.20 +    // Buyer quality (20%)
    convenienceScore * 0.15 +     // Convenience (15%)
    urgencyScore * 0.10 +         // Urgency (10%)
    timeScore * 0.15              // Time/freshness (15%)
  );

  return { ...existingScores, time_score: timeScore, score };
}
```

### 6. Question Answer Timeout

```typescript
async function checkQuestionTimeouts(): Promise<void> {
  const now = Date.now();

  const expiredQuestions = await db.query(`
    SELECT * FROM bids
    WHERE state = 'pending_questions'
    AND created_at + $1 <= $2
  `, [BID_TIME_WINDOWS.QUESTION_ANSWER_TIMEOUT, now]);

  for (const bid of expiredQuestions) {
    await expireBid(bid.id, 'question_timeout');

    // Notify buyer
    await notifyBuyer(bid.buyer_id, {
      type: 'questions_expired',
      item_id: bid.item_id,
      message: 'Seller did not respond to your questions within 48 hours',
      can_resubmit: true,
    });

    // Don't penalize seller, just clean up
  }
}
```

### 7. Competitive Bidding Round Timeouts

```typescript
async function monitorBiddingRoundWithTimeout(
  round: BiddingRound
): Promise<void> {
  const responses = new Map<string, BidResponse>();

  // Set timeout for this round
  const roundDeadline = Date.now() + BID_TIME_WINDOWS.BIDDING_ROUND_TIMEOUT;

  // Wait for responses with timeout
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(resolve, BID_TIME_WINDOWS.BIDDING_ROUND_TIMEOUT)
  );

  // Collect responses until timeout
  await Promise.race([
    collectBiddingResponses(round, responses),
    timeoutPromise,
  ]);

  // Process responses
  const activeResponses = Array.from(responses.values()).filter(r => !r.dropped_out);

  if (activeResponses.length === 0) {
    // All buyers dropped out or timed out - no winner
    await cancelBiddingRound(round.id, 'no_active_bidders');
    return;
  }

  if (activeResponses.length === 1) {
    // Only one buyer remains - they win at current price
    await declareBiddingWinner(round.id, activeResponses[0].buyer_id);
    return;
  }

  // Multiple buyers still active - check for ties
  const highestBid = Math.max(...activeResponses.map(r => r.new_bid));
  const topBidders = activeResponses.filter(r => r.new_bid === highestBid);

  if (topBidders.length === 1) {
    await declareBiddingWinner(round.id, topBidders[0].buyer_id);
  } else {
    // Still tied - start next round
    await startNextBiddingRound(round, topBidders);
  }
}
```

## UI Implementation

### Seller's View - Bid Cards with Time Indicators

```typescript
interface BidCardProps {
  bid: Bid;
  onRefreshRequest?: () => void;
}

function BidCard({ bid }: BidCardProps) {
  const timeRemaining = bid.expires_at - Date.now();
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  const getTimeIndicator = () => {
    if (bid.state === 'stale') {
      return {
        text: `Expires in ${hoursRemaining}h`,
        color: 'warning',
        badge: 'Expiring soon',
      };
    }

    if (daysRemaining < 2) {
      return {
        text: `${hoursRemaining}h left`,
        color: 'warning',
        badge: null,
      };
    }

    return {
      text: `${daysRemaining}d left`,
      color: 'secondary',
      badge: null,
    };
  };

  const indicator = getTimeIndicator();

  return (
    <View style={[styles.bidCard, bid.state === 'stale' && styles.bidCardStale]}>
      <View style={styles.bidHeader}>
        <Text variant="heading" size="heading2" color="success">
          ${bid.current_bid}
        </Text>
        {indicator.badge && (
          <Badge variant="warning">{indicator.badge}</Badge>
        )}
      </View>

      {/* Time indicator */}
      <View style={styles.timeIndicator}>
        <Text variant="body" size="xs" color={indicator.color}>
          ⏰ {indicator.text}
        </Text>
      </View>

      {/* Buyer info... */}

      {/* Actions */}
      <View style={styles.bidActions}>
        <Button variant="primary" onPress={() => handleAccept(bid.id)}>
          Sell for ${bid.current_bid}
        </Button>
        <Button variant="secondary" onPress={() => handleChat(bid.buyer_id)}>
          Chat with {bid.buyer_name}
        </Button>
      </View>
    </View>
  );
}
```

### Buyer's View - Refresh Prompt

```typescript
function BidStatusCard({ bid }: { bid: Bid }) {
  const [refreshing, setRefreshing] = useState(false);

  if (bid.state !== 'stale') return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBid(bid.id);
    setRefreshing(false);
  };

  return (
    <View style={styles.expiringWarning}>
      <Text variant="bodyMedium" size="md">
        ⏰ Your bid is expiring soon
      </Text>
      <Text variant="body" size="sm" color="secondary">
        Refresh to show you're still interested
      </Text>
      <Button
        variant="primary"
        onPress={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing...' : 'Refresh My Bid'}
      </Button>
    </View>
  );
}
```

## Database Schema Updates

```sql
-- Add time-related fields to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'pending_questions';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE bids ADD COLUMN IF NOT EXISTS questions_answered_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS last_buyer_activity TIMESTAMP DEFAULT NOW();
ALTER TABLE bids ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS stale_warning_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

-- Trigger to set expiration on insert
CREATE OR REPLACE FUNCTION set_bid_expiration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NEW.created_at + INTERVAL '7 days';
  NEW.stale_warning_at := NEW.created_at + INTERVAL '5 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bid_expiration_trigger
  BEFORE INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION set_bid_expiration();

-- Trigger to set activated_at when questions answered
CREATE OR REPLACE FUNCTION activate_bid_on_answer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.questions_answered AND OLD.questions_answered IS FALSE THEN
    NEW.state := 'active';
    NEW.activated_at := NOW();
    NEW.questions_answered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bid_activation_trigger
  BEFORE UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION activate_bid_on_answer();

-- Index for efficient time-based queries
CREATE INDEX idx_bids_expiration ON bids(expires_at) WHERE state IN ('pending_questions', 'active', 'stale');
CREATE INDEX idx_bids_stale_warning ON bids(stale_warning_at) WHERE state = 'active';
CREATE INDEX idx_bids_state_time ON bids(state, expires_at);
```

## Agent Messages for Time Events

### Bid Expiring Soon (to Buyer)
```
Agent: Your bid on [Herman Miller Aeron] expires in 12 hours.

Tap 'Refresh' to show you're still interested and extend your bid by 3 days.

[Refresh My Bid]  [Let it Expire]
```

### Bid Expired (to Buyer)
```
Agent: Your bid on [Herman Miller Aeron] has expired.

You can submit a new bid if you're still interested!

[View Item]
```

### Bid Expired (to Seller)
```
Agent: One buyer's bid expired. You now have 2 active bids.

The top bid is now $480 from Mike T.
```

### Refresh Confirmation (to Buyer)
```
Agent: ✓ Bid refreshed successfully!

Your bid is now active for another 3 days (expires Jan 21).
```

### Question Timeout (to Buyer)
```
Agent: The seller hasn't responded to your questions within 48 hours.

Your bid has been automatically withdrawn. You can submit a new bid anytime!

[View Other Items]
```

## Summary

The time logic system ensures:

1. **Bids expire after 7 days** - prevents stale listings
2. **Early warnings at 5 days** - gives buyers chance to refresh
3. **Question timeout at 48 hours** - sellers must respond promptly
4. **Activity tracking** - engaged buyers get priority
5. **Refresh mechanism** - buyers can extend bids easily
6. **Automatic cleanup** - expired bids auto-removed
7. **Time-based scoring** - fresh, active bids ranked higher
8. **Round timeouts** - competitive bidding has deadlines

This creates urgency for both buyers and sellers, while maintaining fairness and preventing abandonment.
