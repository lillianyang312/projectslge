# LGE Lead Capture Backend

Minimal Next.js backend for capturing leads from your Framer Waitlister landing page. Saves to Google Sheets and notifies Slack.

---

## Quick Start

### 1. Deploy to Vercel

```bash
# Clone or upload this folder to a GitHub repo, then:
vercel --prod
```

Or use the Vercel dashboard: Import → Select your repo → Deploy

### 2. Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Full service account JSON (one line) |
| `GOOGLE_SHEET_ID` | ✅ | ID from your Sheet URL |
| `GOOGLE_SHEET_TAB` | ❌ | Tab name (default: "Leads") |
| `SLACK_WEBHOOK_URL` | ❌ | Slack incoming webhook URL |

### 3. Test the Endpoint

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "moving_in_30_days": "yes",
    "apartment_size": "1br",
    "preferred_marketplaces": ["Facebook", "eBay"],
    "notes": "Test submission"
  }'
```

Expected response: `{"ok":true}`

---

## Google Sheets Setup

### Step 1: Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**:
   - APIs & Services → Library → Search "Google Sheets API" → Enable
4. Create a Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Give it a name like "lge-leads-writer"
   - No roles needed (we'll share the sheet directly)
   - Click Done
5. Create a key:
   - Click on the service account → Keys → Add Key → Create new key → JSON
   - Download the JSON file

### Step 2: Prepare the JSON for Vercel

The JSON contains newlines in the `private_key` field. You need to either:

**Option A: Use the JSON as-is** (Vercel handles multi-line)
- Copy the entire JSON content
- Paste it as the `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable

**Option B: Escape newlines** (if Option A fails)
```bash
cat your-key.json | jq -c .
```
This outputs the JSON on a single line.

### Step 3: Create and Share Your Sheet

1. Create a new Google Sheet
2. Name the first tab "Leads" (or whatever you set in `GOOGLE_SHEET_TAB`)
3. Add headers in Row 1:
   | A | B | C | D | E | F | G |
   |---|---|---|---|---|---|---|
   | timestamp | email | moving_in_30_days | apartment_size | marketplaces | notes | source |
4. Share the sheet with your service account email:
   - Click Share → Add the `client_email` from your JSON (e.g., `lge-leads-writer@project.iam.gserviceaccount.com`)
   - Give it **Editor** access
5. Copy the Sheet ID from the URL:
   - `https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_ID`**`/edit`

---

## Slack Setup (Optional)

1. Go to [Slack API](https://api.slack.com/apps) → Create New App → From scratch
2. App name: "LGE Leads", select your workspace
3. Features → Incoming Webhooks → Activate
4. Click "Add New Webhook to Workspace"
5. Select the channel for notifications
6. Copy the Webhook URL (starts with `https://hooks.slack.com/services/...`)
7. Add it as `SLACK_WEBHOOK_URL` in Vercel

---

## Framer Setup

### Step 1: Get the Waitlister Template

Purchase/clone the [Waitlister template](https://waitlister.framer.media/?via=hxmzaehsan)

### Step 2: Update the Hero Copy

In Framer, edit the text layers:

**Headline:**
> We help you sell things you don't want.

**Subtext:**
> We inventory your apartment in minutes and list items for you.

**Optional small text:**
> SF pilots this week.

### Step 3: Add the Code Component

1. In Framer, go to **Assets Panel** (left sidebar) → **Code** → **New Code Component**
2. Name it `LeadCaptureForm`
3. Delete the default code and paste the entire contents of `framer-component/LeadCaptureForm.tsx`
4. **Important:** Update the `API_ENDPOINT` constant at the top:
   ```typescript
   const API_ENDPOINT = "https://YOUR-PROJECT.vercel.app/api/lead"
   ```
5. Save the component

### Step 4: Replace the Email Input

1. Find the existing email input + button in the hero
2. Delete it (or hide it)
3. Drag your new `LeadCaptureForm` component into its place
4. In the right sidebar, you can customize:
   - API Endpoint
   - Button Text
   - Success Message
   - Error Message

### Step 5: Test

1. Preview the site
2. Enter only an email and click "Get started"
3. The details section should expand with validation errors
4. Fill in all fields and submit
5. Check your Google Sheet and Slack channel

---

## API Reference

### POST `/api/lead`

**Request Body:**
```json
{
  "email": "user@example.com",
  "moving_in_30_days": "yes",
  "apartment_size": "1br",
  "preferred_marketplaces": ["Facebook", "eBay"],
  "notes": "Optional notes here"
}
```

**Field Validation:**
| Field | Type | Required | Valid Values |
|-------|------|----------|--------------|
| email | string | ✅ | Valid email format |
| moving_in_30_days | string | ✅ | `"yes"` or `"no"` |
| apartment_size | string | ✅ | `"studio"`, `"1br"`, `"2br"`, `"3br+"` |
| preferred_marketplaces | string[] | ✅ | At least 1 of: `"Facebook"`, `"eBay"`, `"Mercari"`, `"Don't care"` |
| notes | string | ❌ | Max 1000 chars |

**Success Response:**
```json
{ "ok": true }
```

**Error Response:**
```json
{ "ok": false, "error": "Error message here" }
```

---

## Troubleshooting

### "Failed to save lead" error

- Check that `GOOGLE_SERVICE_ACCOUNT_JSON` is valid JSON
- Verify the service account has Editor access to the sheet
- Confirm `GOOGLE_SHEET_ID` is correct
- Check Vercel function logs for detailed errors

### Slack notifications not working

- Verify `SLACK_WEBHOOK_URL` is set correctly
- Check if the webhook URL is still active in Slack
- Note: Slack failures won't cause the API to return an error (best-effort)

### CORS errors in Framer

- The API includes CORS headers for all origins
- Make sure you're using `https://` not `http://`

### Form not appearing in Framer

- Check the Framer console for component errors
- Ensure the component code is valid TypeScript
- Try refreshing the Framer editor

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your .env.local values
npm run dev
```

Test locally:
```bash
curl -X POST http://localhost:3000/api/lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "moving_in_30_days": "yes",
    "apartment_size": "1br",
    "preferred_marketplaces": ["Facebook"],
    "notes": ""
  }'
```

---

## File Structure

```
lge-leads-backend/
├── app/
│   ├── api/
│   │   └── lead/
│   │       └── route.ts    # Main API endpoint
│   ├── layout.tsx          # Minimal layout
│   └── page.tsx            # Placeholder page
├── framer-component/
│   └── LeadCaptureForm.tsx # Copy this to Framer
├── .env.example            # Environment template
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## Test cURL Command

```bash
# Full test with all fields
curl -X POST https://YOUR-PROJECT.vercel.app/api/lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead@test.com",
    "moving_in_30_days": "yes",
    "apartment_size": "2br",
    "preferred_marketplaces": ["Facebook", "Mercari"],
    "notes": "Interested in selling furniture"
  }'

# Validation error test (missing fields)
curl -X POST https://YOUR-PROJECT.vercel.app/api/lead \
  -H "Content-Type: application/json" \
  -d '{"email": "bad-email"}'
```
