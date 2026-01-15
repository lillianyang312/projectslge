# Competitive Bidding System Design

## Overview

The competitive bidding system allows multiple buyers to bid on the same item, with an intelligent agent automatically ranking and surfacing the best price + buyer combination to the seller. This creates a dynamic marketplace where sellers get maximum value and buyers compete fairly.

## Key Principles

1. **Privacy-First**: Buyers don't see each other's bids (sealed bid auction)
2. **Agent-Mediated**: The agent manages bid ranking and presentation
3. **Max Bid Discovery**: Buyers specify a max price, agent finds optimal match
4. **Questions First**: Bids unlock only after sellers answer buyer questions
5. **Dynamic Ranking**: Best bid rises to the top automatically

## How It Works

### Step 1: Buyer Submits Interest

When a buyer expresses interest in an item (from Browse/Swipe):

```typescript
interface BuyerInterest {
  item_id: string;
  buyer_id: string;
  max_bid: number;           // Maximum they're willing to pay
  current_bid: number;        // Starting bid (may be lower than max)
  delivery_preference: 'local_pickup' | 'shipping_ok';
  payment_method: string;
  availability: string;
  questions: string[];        // Questions for seller
  created_at: timestamp;
}
```

- **Max Bid**: The true maximum price the buyer is willing to pay (private)
- **Current Bid**: The initial offer shown to seller (can be incremented)
- Questions are mandatory and must be answered before bid details are revealed

### Step 2: Questions Appear in Seller's Inbox

- Buyer questions go directly to the Inbox (not shown in ItemDetail)
- Each question appears as a conversation thread
- Badge shows "Question" with warning variant
- Seller must respond to unlock bid details

### Step 3: Agent Evaluates and Ranks Bids

Once questions are answered, the agent evaluates all bids using this scoring algorithm:

```typescript
interface BidScore {
  bid_id: string;
  buyer_id: string;
  score: number;              // Composite score (0-100)
  price_score: number;        // How close to max (0-100)
  buyer_quality_score: number; // Reputation, history (0-100)
  convenience_score: number;  // Location, delivery match (0-100)
  urgency_score: number;      // Buyer availability (0-100)
}

function calculateBidScore(
  bid: BuyerInterest,
  seller: Item,
  buyer: BuyerProfile
): BidScore {
  // Price score: Weighted by item's market value
  const priceScore = (bid.current_bid / seller.estimated_value) * 100;

  // Buyer quality: Reputation, completed deals, rating
  const buyerQualityScore = (
    (buyer.completed_deals * 2) +
    (buyer.rating * 20) +
    (buyer.is_verified ? 10 : 0)
  );

  // Convenience: Location distance, delivery preference match
  const conveniethat the agent ranks bids automatically and pulls the best bid to the top.nceScore = (
    (100 - Math.min(buyer.distance_mi * 10, 50)) +
    (bid.delivery_preference === seller.delivery_pref ? 25 : 0)
  );

  // Urgency: How quickly can deal close
  const urgencyScore = buyer.availability === 'flexible' ? 80 : 60;

  // Composite score (weighted average)
  const score = (
    priceScore * 0.5 +           // Price is most important (50%)
    buyerQualityScore * 0.25 +   // Buyer quality (25%)
    conveniences core * 0.15 +    // Convenience (15%)
    urgencyScore * 0.1           // Urgency (10%)
  );

  return {
    bid_id: bid.id,
    buyer_id: bid.buyer_id,
    score,
    price_score: priceScore,
    buyer_quality_score: buyerQualityScore,
    convenience_score: convenienceScore,
    urgency_score: urgencyScore,
  };
}
```

### Step 4: Competitive Bidding (Same Price Scenario)

**When multiple buyers bid the same price**, the agent initiates incremental bidding:

```typescript
interface BiddingRound {
  item_id: string;
  round_number: number;
  competing_bids: string[];   // Buyer IDs with same price
  current_price: number;
  increment: number;          // Price increment (e.g., $10)
  deadline: timestamp;        // Time limit for next bid
}

async function handleSamePriceBids(
  itemId: string,
  bidsAtSamePrice: BuyerInterest[]
): Promise<void> {
  // Sort by secondary criteria (quality, convenience, urgency)
  const sorted = bidsAtSamePrice.sort((a, b) => {
    const scoreA = calculateBidScore(a, item, buyerA);
    const scoreB = calculateBidScore(b, item, buyerB);
    return scoreB.score - scoreA.score;
  });

  // If all secondary criteria equal, trigger competitive bidding
  if (sorted[0].score === sorted[1].score) {
    await initiateCompetitiveBidding(itemId, sorted);
  } else {
    // Best secondary criteria wins at current price
    await notifySeller(itemId, sorted[0]);
  }
}

async function initiateCompetitiveBidding(
  itemId: string,
  competitors: BuyerInterest[]
): Promise<void> {
  const round: BiddingRound = {
    item_id: itemId,
    round_number: 1,
    competing_bids: competitors.map(c => c.buyer_id),
    current_price: competitors[0].current_bid,
    increment: 10, // $10 increments
    deadline: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  // Notify competing buyers
  for (const buyer of competitors) {
    await notifyBuyerOfCompetition(buyer.buyer_id, round);
  }

  // Agent monitors responses
  await monitorBiddingRound(round);
}

async function monitorBiddingRound(round: BiddingRound): Promise<void> {
  // Buyers can:
  // 1. Increase bid (up to their max_bid)
  // 2. Drop out
  // 3. Let it expire (auto-drop)

  const responses = await waitForBuyerResponses(round);

  // Find highest bidder
  const highestBid = responses.reduce((max, r) =>
    r.new_bid > max.new_bid ? r : max
  );

  // If multiple still tied and have room to increase
  const stillTied = responses.filter(r =>
    r.new_bid === highestBid.new_bid &&
    r.max_bid > r.new_bid
  );

  if (stillTied.length > 1) {
    // Another round
    round.round_number++;
    round.current_price = highestBid.new_bid;
    await monitorBiddingRound(round);
  } else {
    // We have a winner!
    await notifySeller(round.item_id, highestBid.buyer_id);
    await updateBidRanking(round.item_id);
  }
}
```

### Step 5: Dynamic Ranking Update

The agent continuously re-ranks bids as conditions change:

```typescript
// Triggers for re-ranking:
// 1. New bid submitted
// 2. Buyer increases bid
// 3. Buyer drops out
// 4. Seller updates item details (price, delivery, urgency)
// 5. Time-based decay (older bids lose priority)

async function updateBidRanking(itemId: string): Promise<void> {
  const allBids = await getBidsForItem(itemId);
  const item = await getItemById(itemId);

  // Calculate scores for all bids
  const scored = await Promise.all(
    allBids.map(async bid => {
      const buyer = await getBuyerProfile(bid.buyer_id);
      return {
        bid,
        score: calculateBidScore(bid, item, buyer),
      };
    })
  );

  // Sort by score (highest first)
  scored.sort((a, b) => b.score.score - a.score.score);

  // Update display order in ItemDetail
  await updateBidDisplayOrder(itemId, scored.map(s => s.bid.id));

  // Notify seller if top bid changed
  if (scored[0].bid.id !== previousTopBid) {
    await notifySellerOfNewTopBid(itemId, scored[0]);
  }
}
```

## UI/UX Flow

### Seller's View (ItemDetail → Buyer Interest Tab)

1. **Summary Card**:
   ```
   Buyer interest
   3 interested buyers
   Answer their questions in your Inbox to see full bid details
   ```

2. **Agent Recommendation**:
   ```
   Agent recommendation
   Accept $550 offer
   ```

3. **Bid Cards**:

   **Answered Questions → Full Details**:
   ```
   $550                    [Recommended]

   Buyer Profile
   Name: Sarah M.
   Reputation: ⭐ Verified · 12 deals
   Rating: 4.9/5.0 (12 reviews)

   Bid Details
   Location: 1.2 mi away
   Delivery: Local pickup
   Payment: Cash on pickup

   [Sell for $550]  [Chat with Sarah]
   ```

   **Unanswered Questions → Locked**:
   ```
   $???                    [Pending questions]

   💬 Answer buyer questions in your Inbox to unlock bid details
   This buyer asked about shipping options

   [Answer in Inbox]
   ```

### Buyer's View (After Competitive Bidding Starts)

Agent message in chat:
```
Agent: Multiple buyers are interested in this item at $550.

Your max bid: $650
Current high bid: $550

Would you like to increase your bid? You can bid up to $650.

[Bid $560]  [Bid $570]  [Bid $580]  [Drop out]
```

## Database Schema

```sql
-- Bids table
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Pricing
  max_bid DECIMAL(10,2) NOT NULL,        -- Private max price
  current_bid DECIMAL(10,2) NOT NULL,    -- Current offer (public to seller)

  -- Buyer details
  delivery_preference VARCHAR(50),
  payment_method VARCHAR(100),
  availability TEXT,

  -- Questions and status
  questions JSONB,                        -- Array of question strings
  questions_answered BOOLEAN DEFAULT FALSE,
  questions_answered_at TIMESTAMP,

  -- Scoring
  score DECIMAL(5,2),                    -- Composite score
  price_score DECIMAL(5,2),
  buyer_quality_score DECIMAL(5,2),
  convenience_score DECIMAL(5,2),
  urgency_score DECIMAL(5,2),

  -- Bidding rounds
  bidding_round INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  dropped_out BOOLEAN DEFAULT FALSE,
  dropped_out_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(item_id, buyer_id),
  CHECK (current_bid <= max_bid),
  CHECK (current_bid > 0),
  CHECK (max_bid > 0)
);

-- Bidding rounds table
CREATE TABLE bidding_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  increment DECIMAL(10,2) NOT NULL,
  competing_bid_ids UUID[] NOT NULL,
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, completed, expired
  winner_bid_id UUID REFERENCES bids(id),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX idx_bids_item_score ON bids(item_id, score DESC) WHERE is_active = TRUE;
CREATE INDEX idx_bids_buyer ON bids(buyer_id) WHERE is_active = TRUE;
CREATE INDEX idx_bidding_rounds_item ON bidding_rounds(item_id, status);
```

## Agent Logic Edge Cases

### 1. Buyer Drops Out Mid-Round
- Automatically exclude from future rounds
- Notify remaining buyers
- If only one left, they win at current price

### 2. All Buyers Hit Max Bid
- Winner is highest max bid
- If still tied, use secondary criteria (quality, convenience)
- If still tied, first buyer wins (timestamp)

### 3. Seller Lowers Asking Price During Bidding
- Agent notifies all buyers
- Resets bidding to new lower price
- Buyers can adjust max bids downward

### 4. Seller Changes Delivery Preference
- Triggers re-scoring (convenience score changes)
- May change bid ranking order
- Agent notifies affected buyers

### 5. Buyer Questions Timeout
- If seller doesn't answer within 48 hours, bid auto-expires
- Buyer is notified and can re-submit interest

## Success Metrics

1. **Seller Value**: Average sale price vs. market estimate
2. **Buyer Competition**: % of items with 2+ bids
3. **Question Response Rate**: % of seller questions answered
4. **Bidding Rounds**: Average rounds before winner determined
5. **Bid Conversion**: % of top bids that close deals

## Future Enhancements

1. **Auto-Increment**: Buyers set auto-bid (like eBay proxy bidding)
2. **Time-Limited Auctions**: Specific deadline for bid submission
3. **Reserve Price**: Minimum price seller will accept
4. **Buy Now Price**: Instant purchase option bypassing bidding
5. **Counter-Offers**: Seller can counter-offer back to buyer

---

## Summary

This competitive bidding system creates a fair, transparent, and efficient marketplace where:

- **Sellers** get the best price through competition
- **Buyers** compete fairly without seeing each other's bids
- **Agent** manages complexity and finds optimal matches
- **Privacy** is maintained throughout the process
- **Questions** are answered before committing to deals

The key innovation is the **max bid + incremental bidding** approach, where buyers specify their true maximum price privately, and the agent only reveals the minimum necessary to find the winner.
