# Passive Marketplace MVP

A quiet, minimal web app for a "passive shopping" marketplace with agent-mediated coordination.

## Quick Start

```bash
cd passive-marketplace
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

### Core Pages

- **Home** (`/`) - Navigation hub with links to all features
- **Upload** (`/upload`) - Add items by photo with fake AI classifier
- **Swipe** (`/swipe`) - Quick browse deck with swipe actions (✅ interested, ➡️ save, ❌ reject with reasons)
- **My List** (`/list`) - Items you own with shipping preferences
- **My Wants** (`/wants`) - Items you're looking for with auto-increment bidding
- **Matches** (`/matches`) - See connections between wants and supply
- **Profile** (`/profile`) - Settings, location, demo data controls

### Key Features

**1. Offer Timing Model (NO fixed windows)**
- Interest lifetime: Persistent until buyer withdraws
- Acceptance SLA: 24-hour coordination window after acceptance
- Interest decay: Invisible scoring after 7/14/30 days

**2. Shipping Preferences**
- First-class constraint in matching
- "Local only" or "Shipping OK" per item/want
- Matches respect compatibility (seller "shipping ok" + buyer "local only" = ✅)

**3. Upload Flow**
- Fake classifier detects item type from filename/caption
- Keywords: iphone, laptop, desk, bike, book, jacket, etc.
- Add detected item to "My List" or "My Wants"

**4. Swipe UI**
- Buying mode: Browse neighborhood items
- Selling mode: See inbound interest for your items
- Reject reasons: too expensive, wrong condition, too far, shipping not ok, not what I meant
- Feedback persists in localStorage for future ranking

**5. Auto-Increment Bidding**
- Set max price and increment step (+$5/+$10/+$20) in wants
- Agent auto-escalates if outbid (future: implemented in negotiation panel)

**6. Demo Data**
- 25 neighborhood users
- 30+ items across all categories (including 2 special collectibles)
- 25 wants with varied preferences
- 4 existing offers to simulate activity
- Load via Profile page button
- Reset button clears all demo data

### Privacy & Safety

- Coarse proximity only (e.g., "within ~0.5 miles", "same campus zone")
- No exact addresses or identities revealed
- Agent-mediated coordination (stub UI)
- Spam protection: 5 broadcast pings per day limit
- Report spam functionality on offers

## Architecture

**Tech Stack**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- localStorage for persistence

**Data Model**
- Items: `shippingPreference`, `imageUrl`, optional pricing
- Wants: `shippingPreference`, `autoIncrementStep`, `lastInteractionAt`, `isStale`
- Matches: `suppressedUntil` for swipe feedback
- Offers: `acceptedAt`, `outbid` status
- Negotiations: `autoIncrementStep`, `agentSuggestion`

**Matching Logic** (`lib/matching.ts`)
- Shipping compatibility check (required)
- Substring name matching
- Category filtering
- Price compatibility (buyer max >= seller ask)
- Interest decay penalty (-10 after 7d, -20 after 14d)
- Minimum score threshold: 40

**Storage** (`lib/store.ts`)
- All data in localStorage with prefixed keys
- Interest staleness tracking
- Swipe action history
- Upload metadata
- Negotiation state

## Usage Flow

1. **Set up profile**: Go to Profile, enter name and location (campus/neighborhood/zip)
2. **Load demo data**: Click "Load demo neighborhood data" button
3. **Add items**: Go to My List, add items with shipping preference
4. **Add wants**: Go to My Wants, set max offer and auto-increment
5. **Upload items**: Use /upload to add by photo (fake AI detects type)
6. **Swipe**: Browse items in /swipe, react with ✅➡️❌
7. **View matches**: Go to Matches to see automatic connections
8. **Coordinate**: Use "Ask agent to coordinate" (stub UI shows privacy model)

## Design Principles

- Mobile-first, calm, whitespace-heavy
- Neutral palette (black/white/gray)
- Clean system font (Inter)
- 1-2 primary actions per screen
- Great empty states
- Apple Notes / Linear aesthetic
- No loud gradients or clutter

## Demo Scenarios

**Scenario 1: Upload & Match**
1. Go to /upload
2. Upload an image, caption "iPhone 12 black"
3. Classifier detects "iPhone" → Electronics
4. Add to My List
5. Demo neighborhood has 2 users wanting iPhones
6. Go to /matches to see connections

**Scenario 2: Swipe & Interest**
1. Load demo data (30+ items)
2. Go to /swipe, mode: Buying
3. Swipe through items
4. Reject with reason "too expensive"
5. Swipe action persists for future ranking

**Scenario 3: Want + Auto-Increment**
1. Add want for "Laptop"
2. Set max $650, auto-increment +$10
3. Set shipping preference "shipping ok"
4. Demo has MacBook Pro 2019 for $600
5. Match appears (shipping compatible)
6. Future: Agent auto-increments if outbid

## Future Enhancements (Not Implemented)

- Real agent AI coordination
- Actual shipping labels
- Real payment integration
- Photo uploads to cloud
- ML-based matching
- Push notifications
- Real group text via Twilio
- KYC verification
- Escrow payments
- Reviews and ratings
- Negotiation panel with live agent suggestions

## Notes

- All pricing is demo/stub (no real transactions)
- Payment methods (Venmo/cash/other) are UI only
- Group text coordination is stub copy
- Estimated values are mock heuristics
- No external APIs or services
- 100% client-side with localStorage
