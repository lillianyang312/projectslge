# Day 1 Backend Implementation Notes

## Overview

This document describes the Day 1 backend setup for the Passive Shopping MVP. The goal is to establish:

1. **Supabase project** with Auth (Email/Password) enabled
2. **Database schema** for users, items, wants, swipes, matches, offers, deals, and messages
3. **Row-Level Security (RLS)** policies to ensure data privacy
4. **Storage bucket** for item images
5. **Environment variables** properly configured locally (no secrets committed)

## Environment Variable Locations

### Mobile App (`apps/mobile/`)

Create or update `apps/mobile/.env` (this file is gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Reference template: `apps/mobile/.env.example`

**Important:** These vars are prefixed with `EXPO_PUBLIC_` so they are safe to expose in client code.

### Backend (`lge-leads-backend/`)

Create or update `lge-leads-backend/.env.local` (this file is gitignored):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Reference template: `lge-leads-backend/.env.example`

**Important:** The service role key should ONLY be used in backend code, never exposed to the client.

## Next Steps

1. **Create Supabase Project** → Follow [supabase/SETUP.md](supabase/SETUP.md)
2. **Apply Database Schema** → Run SQL from [supabase/schema.sql](supabase/schema.sql)
3. **Verify Setup** → Run the smoke test script (see below)
4. **Handoff Keys** → Share credentials via secure channel (see checklist at end)

## Smoke Test

After setting up Supabase and applying the schema, verify everything works:

```bash
cd lge-leads-backend
npm install @supabase/supabase-js
npx tsx ../scripts/supabase_smoke_test.ts
```

This script will:
- Authenticate a test user (sign up or login)
- Create a profile row
- Insert a test item
- Upload a dummy image to storage
- Verify the storage URL is accessible
- Read back the inserted data

Expected output: `✅ All smoke tests passed!`

## Architecture Summary

### Tables

- **profiles** - User profiles (extends auth.users)
- **items** - Items being sold
- **wants** - Items being wanted/searched for
- **swipes** - User swipe interactions (buy/sell mode)
- **matches** - Buyer-seller connection for an item
- **offers** - Price negotiation within a match
- **deals** - Post-accept fulfillment details
- **messages** - Chat messages in match thread

All tables use UUID primary keys and have `created_at` timestamps.

### Storage

- **item-images** bucket - Public read, authenticated write for item photos

### Authentication

- Email/Password provider enabled
- Redirect URLs configured for:
  - Expo development: `exp://localhost:19000`, `exp://127.0.0.1:19000`
  - Web: `http://localhost:3000` (if applicable)

## Security & RLS

All tables have Row-Level Security enabled:

- Users can only read/write their own profile
- Users can only see/manage their own items and wants
- Matches/offers/deals/messages are only visible to buyer and seller participants
- Policies use `auth.uid()` checks to enforce access control

## Git Safety

✅ `.env`, `.env.local`, `.env.*` are all gitignored (confirmed in both repo and mobile app)
✅ `.env.example` files are committed (safe templates only)
✅ No secrets are hardcoded in the repository

---

## Handoff Checklist

**To complete the setup, Gianfranco needs to:**

```
✅ Create Supabase project via https://supabase.com/dashboard
✅ Enable Email/Password auth provider
✅ Configure redirect URLs for Expo dev
✅ Create item-images storage bucket
✅ Apply schema.sql via Supabase SQL editor
✅ Fill in apps/mobile/.env with Supabase credentials
✅ Fill in lge-leads-backend/.env.local with Supabase credentials
✅ Run smoke test script to verify

Supabase Project URL: ________________________

Supabase Anon Key: ________________________

Supabase Service Role Key (backend only): ________________________

Storage Bucket Name: item-images

Auth Provider Status: Email/Password enabled

Redirect URLs Configured:
  - exp://localhost:19000
  - exp://127.0.0.1:19000
  - http://localhost:3000 (if applicable)

Schema Applied: Yes / No

Smoke Test Result: PASS / FAIL
```

---

## Files Created

- `apps/mobile/.env.example` - Template for mobile env vars
- `lge-leads-backend/.env.example` - Template for backend env vars
- `supabase/SETUP.md` - Step-by-step Supabase UI setup guide
- `supabase/schema.sql` - Complete database schema with RLS policies
- `scripts/supabase_smoke_test.ts` - Verification script
- `DAY1_BACKEND_NOTES.md` - This file

## Questions?

Refer to:
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
