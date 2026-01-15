# Bid Time Logic - Quick Reference

## Timeline Overview

```
Buyer submits bid
│
├─► [Pending Questions] ────────────────────► 48h timeout
│                                             │
│   Seller answers ──┐                       │
│                    │                       │
│                    ▼                       ▼
│   [Active Bid] ────────────────────────► [Expired]
│        │                                   (auto-removed)
│        │
│        ├─► 5 days: Stale warning sent
│        │            Bid marked as "stale"
│        │            Priority lowered
│        │
│        ├─► 7 days: Bid expires
│        │
│        └─► Buyer can refresh anytime
│                 ↓
│            Extends by 3 days
│            Resets to "active"
│            Priority boosted
│
└─► Buyer activity tracked continuously
     Last activity shown on bid card
```

## Key Time Windows

| Event | Duration | Action |
|-------|----------|--------|
| **Question Answer Timeout** | 48 hours | Seller must answer buyer questions |
| **Bid Stale Warning** | 5 days | Buyer notified to refresh |
| **Bid Expiration** | 7 days | Bid auto-expires and removed |
| **Bid Refresh Extension** | +3 days | Buyer can extend active bid |
| **Buyer Activity Timeout** | 24 hours | During active negotiation |
| **Bidding Round Timeout** | 24 hours | Per competitive bidding round |

## Bid States

```
┌─────────────────────┐
│ pending_questions   │ ──► Waiting for seller to answer
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ active              │ ──► Questions answered, bid is live
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ stale               │ ──► Approaching expiration (5+ days old)
└─────────────────────┘
         │
         ├──► Buyer refreshes ──► Back to "active"
         │
         └──► 7 days passes ──► "expired" (removed)
```

## UI Indicators

### Seller's View

**Active Bid (Fresh)**
```
┌────────────────────────────────────┐
│ $550                  [Recommended] │
│                                     │
│ ⏰ 4d left · Active 2h ago         │
│                                     │
│ Buyer Profile: Sarah M.             │
│ ⭐ Verified · 12 deals              │
│ Rating: 4.9/5.0                     │
│                                     │
│ [Sell for $550]  [Chat with Sarah] │
└────────────────────────────────────┘
```

**Stale Bid (Expiring Soon)**
```
┌────────────────────────────────────┐
│ $480            [Expiring soon]     │
│                                     │
│ ⏰ 18h left · Last active 3d ago   │
│                                     │
│ Buyer Profile: Mike T.              │
│ ✓ Verified · 8 deals                │
│                                     │
│ [Sell for $480]  [Chat with Mike]  │
└────────────────────────────────────┘
```

**Locked Bid (Questions Unanswered)**
```
┌────────────────────────────────────┐
│ $???         [Pending questions]    │
│                                     │
│ 💬 Answer buyer questions in your  │
│    Inbox to unlock bid details      │
│                                     │
│ This buyer asked about shipping     │
│                                     │
│ [Answer in Inbox]                   │
└────────────────────────────────────┘
```

### Buyer's View

**Expiring Warning**
```
┌────────────────────────────────────┐
│ ⏰ Your bid is expiring soon        │
│                                     │
│ Refresh to show you're still        │
│ interested                          │
│                                     │
│ [Refresh My Bid]                    │
└────────────────────────────────────┘
```

## Agent Messages

### To Buyer - Expiring Soon
```
Agent: Your bid on Herman Miller Aeron expires in 12 hours.

Tap 'Refresh' to extend your bid by 3 days.

[Refresh]  [Let it Expire]
```

### To Buyer - Expired
```
Agent: Your bid on Herman Miller Aeron has expired.

You can submit a new bid if you're still interested!

[View Item]
```

### To Buyer - Refresh Success
```
Agent: ✓ Bid refreshed!

Your bid is now active for another 3 days (expires Jan 21).
```

### To Seller - Bid Expired
```
Agent: One buyer's bid expired.

You now have 2 active bids. The top bid is $480 from Mike T.
```

### To Buyer - Question Timeout
```
Agent: The seller hasn't responded to your questions within 48 hours.

Your bid has been automatically withdrawn.

[View Other Items]
```

## Scoring Impact

Time factors affect bid ranking:

| Factor | Weight | Impact |
|--------|--------|--------|
| **Price** | 40% | Higher price = higher score |
| **Buyer Quality** | 20% | Reputation, deals, rating |
| **Convenience** | 15% | Location, delivery match |
| **Urgency** | 10% | Buyer availability |
| **Time/Freshness** | 15% | **NEW** - Recent activity boosts score |

### Time Score Breakdown

- **Recency** (30%): Newer bids ranked higher
- **Activity** (40%): Recent buyer engagement
  - Active in last hour: 100
  - Active today: 75
  - Active this week: 50
  - Inactive: 25
- **Time Remaining** (30%): More time = higher score
- **Staleness Penalty**: -30 if stale

## Database Triggers

### Auto-Expiration
```sql
-- Sets expires_at on bid creation
NEW.expires_at := NEW.created_at + INTERVAL '7 days';
NEW.stale_warning_at := NEW.created_at + INTERVAL '5 days';
```

### Auto-Activation
```sql
-- Activates bid when questions answered
IF NEW.questions_answered THEN
  NEW.state := 'active';
  NEW.activated_at := NOW();
END IF;
```

## Cron Jobs

### Hourly
- Check and expire old bids
- Detect stale bids
- Send expiration warnings
- Clean up expired entries

### Daily
- Send reminder notifications
- Update bid rankings
- Check buyer responsiveness

## Benefits

1. **Urgency**: Time pressure encourages faster decisions
2. **Freshness**: Recent bids get priority
3. **Engagement**: Rewards active buyers
4. **Cleanup**: Auto-removes stale interest
5. **Fairness**: Everyone has same time windows
6. **Flexibility**: Buyers can extend if still interested

## Example Scenarios

### Scenario 1: Active Buyer
```
Day 0: Buyer submits bid → "pending_questions"
Day 1: Seller answers → "active", expires Day 8
Day 5: Warning sent → "stale" state
Day 6: Buyer refreshes → "active", expires Day 9
Day 7: Buyer accepts deal → "accepted"
```

### Scenario 2: Unresponsive Seller
```
Day 0: Buyer submits bid → "pending_questions"
Day 2: 48h passes, no answer → "expired", removed
       Buyer notified, can resubmit
```

### Scenario 3: Inactive Buyer
```
Day 0: Buyer submits bid → "pending_questions"
Day 1: Seller answers → "active", expires Day 8
Day 5: Warning sent → "stale" state
Day 7: No refresh → "expired", removed
       Seller notified, bid count updated
```

### Scenario 4: Competitive Bidding
```
Day 0: 3 buyers bid $500
       Agent starts Round 1, 24h deadline
Day 1: Buyer A: $520, Buyer B: timeout, Buyer C: $510
       Buyer A wins at $520
```

---

**Implementation Status**: ✅ Documented
**Next Steps**:
1. Implement cron jobs for expiration checks
2. Add refresh UI to buyer's bid status screen
3. Test all time-based triggers
4. Add analytics for bid lifecycle metrics
