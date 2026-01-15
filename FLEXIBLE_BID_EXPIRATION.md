# Flexible Bid Expiration System

## Overview

Instead of fixed 7-day expiration for all bids, the system now uses **buyer-specified interest duration** to determine bid expiration. This respects buyer intent while still maintaining marketplace freshness.

## Key Principle

**Buyers declare how long they're interested** → System honors that timeline → Seller can always see max bid regardless of expiration

## Buyer Interest Duration Options

When expressing interest, buyers select one of:

```typescript
type InterestDuration =
  | '1 week'      // Expires in 7 days
  | '2 weeks'     // Expires in 14 days (default)
  | '1 month'     // Expires in 30 days
  | 'Flexible';   // Never expires (buyer will refresh manually)
```

### Duration Mapping

```typescript
const INTEREST_DURATION_MAP = {
  '1 week': 7 * 24 * 60 * 60 * 1000,      // 7 days
  '2 weeks': 14 * 24 * 60 * 60 * 1000,    // 14 days
  '1 month': 30 * 24 * 60 * 60 * 1000,    // 30 days
  'Flexible': null,                        // Never expires
};

function calculateBidExpiration(interestedFor: InterestDuration): timestamp | null {
  const duration = INTEREST_DURATION_MAP[interestedFor];

  if (duration === null) {
    // Flexible = no expiration
    return null;
  }

  return Date.now() + duration;
}
```

## Updated Bid Schema

```typescript
interface Bid {
  id: string;
  item_id: string;
  buyer_id: string;

  // Pricing
  max_bid: number;              // Private - only seller can see when ready
  current_bid: number;          // Initial offer

  // NEW: Interest duration
  interested_for: InterestDuration;
  expires_at: timestamp | null;  // null = flexible (never expires)

  // Staleness warnings (only if expires_at is set)
  stale_warning_at: timestamp | null;

  // ... rest of bid fields
}
```

## Database Updates

```sql
-- Add interest duration field
ALTER TABLE bids ADD COLUMN interested_for VARCHAR(50) DEFAULT '2 weeks';
ALTER TABLE bids ALTER COLUMN expires_at DROP NOT NULL; -- Allow null for flexible

-- Updated trigger for expiration
CREATE OR REPLACE FUNCTION set_bid_expiration()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.interested_for
    WHEN '1 week' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '7 days';
      NEW.stale_warning_at := NEW.created_at + INTERVAL '5 days';
    WHEN '2 weeks' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '14 days';
      NEW.stale_warning_at := NEW.created_at + INTERVAL '12 days';
    WHEN '1 month' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '30 days';
      NEW.stale_warning_at := NEW.created_at + INTERVAL '27 days';
    WHEN 'Flexible' THEN
      NEW.expires_at := NULL;
      NEW.stale_warning_at := NULL;
    ELSE
      -- Default to 2 weeks
      NEW.expires_at := NEW.created_at + INTERVAL '14 days';
      NEW.stale_warning_at := NEW.created_at + INTERVAL '12 days';
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Seller View: Always See Max Bid

**Key Feature**: When seller is ready to sell, they can see **all max bids from all buyers**, regardless of:
- Whether bid has expired
- Whether questions have been answered
- Time since last buyer activity

```typescript
async function getMaxBidsForSeller(itemId: string, sellerId: string): Promise<MaxBidInfo[]> {
  // Verify seller owns item
  const item = await getItemById(itemId);
  if (item.owner_id !== sellerId) {
    throw new Error('Unauthorized');
  }

  // Get ALL bids, including expired ones
  const allBids = await db.query(`
    SELECT
      b.*,
      p.name as buyer_name,
      p.reputation,
      p.completed_deals
    FROM bids b
    JOIN profiles p ON b.buyer_id = p.id
    WHERE b.item_id = $1
    ORDER BY b.max_bid DESC
  `, [itemId]);

  return allBids.map(bid => ({
    bid_id: bid.id,
    buyer_id: bid.buyer_id,
    buyer_name: bid.buyer_name,
    buyer_reputation: bid.reputation,
    max_bid: bid.max_bid,              // Show max bid!
    current_bid: bid.current_bid,
    interested_for: bid.interested_for,
    expires_at: bid.expires_at,
    is_expired: bid.expires_at ? bid.expires_at < Date.now() : false,
    is_flexible: bid.interested_for === 'Flexible',
    questions_answered: bid.questions_answered,
  }));
}
```

## UI: Seller's Max Bid View

When seller clicks "Show max bids" or "Ready to sell":

```typescript
function MaxBidsView({ itemId }: { itemId: string }) {
  const [maxBids, setMaxBids] = useState<MaxBidInfo[]>([]);

  return (
    <View>
      <Text variant="heading" size="heading2">
        All Max Bids
      </Text>
      <Text variant="body" size="sm" color="secondary">
        These are the maximum prices each buyer is willing to pay
      </Text>

      {maxBids.map(bid => (
        <Card key={bid.bid_id} style={styles.maxBidCard}>
          <View style={styles.maxBidHeader}>
            <Text variant="heading" size="heading1" color="success">
              ${bid.max_bid}
            </Text>
            {bid.is_flexible && (
              <Badge variant="success">Flexible timing</Badge>
            )}
            {bid.is_expired && (
              <Badge variant="secondary">Expired</Badge>
            )}
          </View>

          <View style={styles.maxBidDetails}>
            <Text variant="bodyMedium" size="md">
              {bid.buyer_name}
            </Text>
            <Text variant="body" size="sm" color="secondary">
              {bid.buyer_reputation} · {bid.completed_deals} deals
            </Text>
            <Text variant="body" size="sm" color="secondary">
              Interested for: {bid.interested_for}
            </Text>
            {bid.is_expired && (
              <Text variant="body" size="sm" color="warning">
                ⚠️ This bid expired, but you can still accept it if the buyer is responsive
              </Text>
            )}
          </View>

          <Button variant="primary" onPress={() => handleAcceptMaxBid(bid)}>
            Accept ${bid.max_bid}
          </Button>
        </Card>
      ))}
    </View>
  );
}
```

## Flexible Bid Behavior

Bids marked as "Flexible" have special handling:

### 1. Never Expire
```typescript
if (bid.interested_for === 'Flexible') {
  // Skip expiration checks
  return;
}
```

### 2. No Staleness Warnings
```typescript
// Flexible bids don't show "expiring soon"
if (bid.interested_for === 'Flexible') {
  return null; // No warning
}
```

### 3. Always Active in Ranking
```typescript
function calculateTimeScore(bid: Bid): number {
  if (bid.interested_for === 'Flexible') {
    // Flexible bids get neutral time score (not penalized or boosted)
    return 75;
  }

  // ... rest of time scoring logic
}
```

### 4. Buyer Can Withdraw Anytime
```typescript
// Flexible bids should have prominent "Withdraw" button
if (bid.interested_for === 'Flexible') {
  return (
    <Button variant="secondary" onPress={() => withdrawBid(bid.id)}>
      Withdraw my bid
    </Button>
  );
}
```

## Competitive Bidding with Mixed Durations

When multiple buyers bid the same price with different durations:

```typescript
function handleSamePriceBids(bids: Bid[]): Bid {
  // Sort by:
  // 1. Buyer quality
  // 2. Interest duration (longer = more serious)
  // 3. Timestamp (earlier = better)

  const sorted = bids.sort((a, b) => {
    // Quality first
    if (a.buyer_quality_score !== b.buyer_quality_score) {
      return b.buyer_quality_score - a.buyer_quality_score;
    }

    // Then duration
    const durationA = getDurationValue(a.interested_for);
    const durationB = getDurationValue(b.interested_for);
    if (durationA !== durationB) {
      return durationB - durationA; // Longer duration = better
    }

    // Finally timestamp
    return a.created_at - b.created_at;
  });

  return sorted[0];
}

function getDurationValue(duration: InterestDuration): number {
  switch (duration) {
    case '1 week': return 1;
    case '2 weeks': return 2;
    case '1 month': return 3;
    case 'Flexible': return 4; // Highest - shows most commitment
    default: return 0;
  }
}
```

## Agent Messages

### Flexible Bid Confirmation
```
Agent: ✓ Interest sent!

You selected "Flexible" timing, so your bid won't expire.

You can withdraw anytime if you find something else.
```

### Time-Limited Bid Confirmation
```
Agent: ✓ Interest sent!

Your bid will remain active for 2 weeks.

You can refresh it anytime to extend the duration.
```

### Seller Notification (Flexible Bid)
```
Agent: New bid received! $550 from Sarah M.

This buyer is flexible on timing - they're willing to wait.
```

### Seller Notification (Time-Limited Bid)
```
Agent: New bid received! $550 from Mike T.

This buyer is interested for 1 week - respond quickly!
```

## Benefits

1. **Respects buyer intent** - Buyers control their own timeline
2. **Reduces false urgency** - No arbitrary 7-day deadline for serious buyers
3. **Seller always has options** - Can see max bids even if expired
4. **Natural market signals** - Short duration = urgent buyer, Flexible = patient buyer
5. **Less notification spam** - Flexible bids don't send expiration warnings
6. **Better matching** - Duration preference becomes part of matching algorithm

## Example Scenarios

### Scenario 1: Urgent Buyer
```
Buyer selects: "1 week"
→ Bid expires in 7 days
→ Seller sees urgency
→ Gets priority in ranking (urgency score boost)
```

### Scenario 2: Patient Buyer
```
Buyer selects: "Flexible"
→ Bid never expires
→ No staleness warnings
→ Buyer can withdraw anytime
→ Seller knows buyer is patient
```

### Scenario 3: Balanced Buyer
```
Buyer selects: "2 weeks" (default)
→ Expires in 14 days
→ Warning at 12 days
→ Can refresh to extend
```

### Scenario 4: Seller Ready to Sell
```
Seller clicks "Show max bids"
→ Sees ALL max bids:
  - $600 (Flexible) - Sarah
  - $580 (1 month) - Mike
  - $550 (Expired 2 days ago) - Alex
→ Seller can accept any of them
→ Agent contacts buyer to confirm still interested
```

## Max Bid Reveal Logic

Seller can trigger max bid reveal when:

1. **Ready to sell** button clicked
2. **Multiple active bids** at same price (competitive bidding)
3. **Seller asks agent** "What are the max bids?"

```typescript
async function revealMaxBids(itemId: string, sellerId: string): Promise<void> {
  // Verify authorization
  const item = await getItemById(itemId);
  if (item.owner_id !== sellerId) {
    throw new Error('Unauthorized');
  }

  // Mark seller as "ready to sell"
  await db.query(`
    UPDATE items
    SET ready_to_sell = true,
        ready_to_sell_at = NOW()
    WHERE id = $1
  `, [itemId]);

  // Get all max bids
  const maxBids = await getMaxBidsForSeller(itemId, sellerId);

  // Notify seller
  await notifySeller(sellerId, {
    type: 'max_bids_revealed',
    item_id: itemId,
    max_bids: maxBids,
    message: `Here are all the max bids for your ${item.title}`,
  });

  // Return for UI display
  return maxBids;
}
```

## Summary

The flexible expiration system:

- ✅ **Respects buyer timelines** - They choose their own expiration
- ✅ **Removes artificial urgency** - No forced 7-day deadline
- ✅ **Seller always wins** - Can see max bids regardless of expiration
- ✅ **Better market signals** - Duration shows buyer intent
- ✅ **Less spam** - Flexible bids don't send warnings
- ✅ **Fair for everyone** - Buyer controls their commitment level

This creates a more natural, buyer-friendly marketplace while still giving sellers full visibility when they're ready to transact.
