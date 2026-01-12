# Supabase Setup Guide (Manual UI Steps)

This guide walks you through creating and configuring a Supabase project for the Passive Shopping MVP.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `Passive Shopping MVP` (or similar)
   - **Database Password:** Create a strong password (store securely)
   - **Region:** Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan:** Free tier is fine for MVP
4. Click **"Create new project"** and wait for provisioning (~2 min)

Once created, you'll be redirected to the project dashboard.

## Step 2: Get API Keys

1. In the left sidebar, click **"Settings"** → **"API"**
2. Copy these values and save them (you'll need them for `.env` files):
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon key** (public, safe for client)
   - **service_role key** (secret, backend-only)

3. Fill in the checklist at the end of [DAY1_BACKEND_NOTES.md](../DAY1_BACKEND_NOTES.md)

## Step 3: Enable Email/Password Auth

1. In the left sidebar, click **"Authentication"** → **"Providers"**
2. Find **"Email"** provider
3. Click to expand and ensure **"Enable Email Provider"** is ON (toggle should be green)
4. **For MVP (optional but recommended):** Disable email confirmations to make testing easier:
   - Click **"Email"** provider
   - Toggle **"Confirm email"** to OFF
   - Click **"Save"**

Your users can now sign up with email/password.

## Step 4: Configure Redirect URLs

1. In **"Authentication"** → **"Providers"** (stay on this page)
2. Scroll down to **"Redirect URLs"** section
3. Add the following URLs (one per line):
   ```
   exp://localhost:19000
   exp://127.0.0.1:19000
   http://localhost:19006
   http://localhost:3000
   ```
   - These are for Expo development and local web testing
   - Add more if you have additional dev/staging environments

4. Click **"Save"**

## Step 5: Create Storage Bucket

1. In the left sidebar, click **"Storage"** → **"Buckets"**
2. Click **"New Bucket"**
3. Name it: `item-images`
4. Choose bucket access:
   - **For MVP, use Public:** Easier for testing; images are publicly readable
   - **Alternatively, use Private + Signed URLs:** More secure but more complex
   - **Decision:** We're using **Public** for MVP simplicity
5. Click **"Create Bucket"**

Once created:
- Files in this bucket can be accessed via:
  ```
  https://your-project.supabase.co/storage/v1/object/public/item-images/filename
  ```

## Step 6: Apply Database Schema

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"**
3. Open [supabase/schema.sql](schema.sql) from this repo
4. Copy the entire contents
5. Paste into the SQL editor
6. Click **"Run"** (or Cmd+Enter)
7. Wait for all statements to complete (you should see green checkmarks)

This creates:
- Tables: `profiles`, `items`, `wants`, `swipes`, `matches`, `offers`, `deals`, `messages`
- Row-Level Security (RLS) policies on all tables
- Indexes for common queries

## Step 7: Verify Schema

To verify everything was created:

1. Click **"Table Editor"** in the left sidebar
2. You should see all these tables listed:
   - ✅ `profiles`
   - ✅ `items`
   - ✅ `wants`
   - ✅ `swipes`
   - ✅ `matches`
   - ✅ `offers`
   - ✅ `deals`
   - ✅ `messages`

3. Click each table to verify columns are present

## Step 8: Deploy Edge Function (analyzeImage)

The Edge Function uses Deno runtime with modern `Deno.serve` API (no external imports needed).

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project (replace `your-project-ref` with your actual project reference):
   ```bash
   supabase link --project-ref your-project-ref
   ```
   - You can find your project ref in the Supabase dashboard URL: `https://supabase.com/dashboard/project/your-project-ref`
   - Or in Settings → API → Project URL (the part after `https://` and before `.supabase.co`)

### Deno Configuration

The Edge Function is configured in `supabase/functions/analyzeImage/`:

- **`index.ts`**: Uses `Deno.serve()` (built-in Deno API, no imports needed)
- **`deno.json`**: Configures imports and TypeScript compiler options
  - Uses `@supabase/supabase-js@2.39.0` from esm.sh
  - Includes `deno.window` and `deno.ns` in compiler libs for proper type support

**Important:** The function uses `Deno.serve()` instead of the old `std/http` import pattern. This is the recommended approach for Supabase Edge Functions.

### Deploy the Function

From the project root:

```bash
supabase functions deploy analyzeImage
```

You should see output like:
```
Deploying function analyzeImage...
Function analyzeImage deployed successfully
```

### Verify Deployment

1. In Supabase Dashboard, go to **"Edge Functions"** in the left sidebar
2. You should see `analyzeImage` listed
3. Click on it to see logs and invocation details

### Test the Function (Optional)

You can test it using curl or the Supabase dashboard:

```bash
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/analyzeImage \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/image.jpg","imagePath":"test/123.jpg"}'
```

Or use the Supabase Dashboard:
1. Go to **"Edge Functions"** → **"analyzeImage"**
2. Click **"Invoke"** tab
3. Enter test payload:
   ```json
   {
     "imageUrl": "https://example.com/image.jpg",
     "imagePath": "test/123.jpg"
   }
   ```
4. Click **"Invoke Function"**

## Step 9: Test Auth & RLS (Optional but Recommended)

In the SQL editor, try this test:

```sql
-- Create a test user (this will work even with unconfirmed emails)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now()
)
RETURNING id, email;
```

Then create a profile for that user (replace `user-id` with the UUID from above):

```sql
INSERT INTO profiles (id, display_name)
VALUES ('user-id-here', 'Test User');
```

Then verify RLS works by running this as that user (you'd need to use a client library for real testing).

The smoke test script (see [DAY1_BACKEND_NOTES.md](../DAY1_BACKEND_NOTES.md)) will handle this more thoroughly.

## Step 10: Share Credentials

Once complete, post this checklist in the team Slack channel:

```
✅ Passive Shopping MVP Supabase Setup Complete

Supabase Project URL: https://your-project.supabase.co
Anon Key: [paste-here]
Service Role Key: [paste-here-backend-only]
Storage Bucket: item-images
Auth Provider: Email/Password ✅
Redirect URLs: exp://localhost:19000, exp://127.0.0.1:19000, http://localhost:19006, http://localhost:3000 ✅
Schema Applied: ✅
Edge Function Deployed: analyzeImage ✅
```

**IMPORTANT:** Only share the **Anon Key** and **Service Role Key** via secure channels (1Password, private Slack thread, etc.). Never commit them to the repo.

## Troubleshooting

### "Email provider not showing"

- Refresh the page
- Ensure you're logged into Supabase

### "Redirect URL not being accepted"

- Make sure there are no trailing spaces
- Each URL should be on its own line or separated by commas (depending on UI)

### "SQL script failed to run"

- Check the error message at the bottom
- Most likely causes: duplicate extensions or tables already existing
- Try running smaller chunks of SQL at a time

### "Storage bucket creation failed"

- You may have hit a rate limit; wait a few minutes and try again
- Ensure bucket name has no spaces or special characters

### "Edge Function deployment failed"

- Ensure Supabase CLI is installed: `npm install -g supabase`
- Verify you're logged in: `supabase login`
- Check that you've linked to the correct project: `supabase link --project-ref your-project-ref`
- Verify `deno.json` exists in `supabase/functions/analyzeImage/` with correct imports
- Check function logs in Supabase Dashboard → Edge Functions → analyzeImage → Logs

### "Deno.serve is not defined" or TypeScript errors

- The function uses `Deno.serve()` which is built into Deno runtime
- If you see TypeScript errors in your IDE, this is normal - the Deno types are available at runtime
- The function includes a type declaration for `Deno` to satisfy the TypeScript linter
- At runtime in Supabase, `Deno.serve` will work correctly

---

## Next Steps

1. ✅ Fill in env files:
   - `apps/mobile/.env` (with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
   - `apps/mobile/.env.local` (with `SUPABASE_URL` and `SUPABASE_ANON_KEY` for smoke test)

2. ✅ Deploy Edge Function (if not done in Step 8):
   ```bash
   supabase functions deploy analyzeImage
   ```

3. ✅ Run the smoke test:
   ```bash
   npm install @supabase/supabase-js
   npx tsx scripts/supabase_smoke_test.ts
   ```

3. ✅ Commit progress (no secrets!)

See [DAY1_BACKEND_NOTES.md](../DAY1_BACKEND_NOTES.md) for more details.
