# Claude Image Analysis - Deployment Checklist

## Pre-Deployment

- [ ] Read [QUICK_START_CLAUDE.md](QUICK_START_CLAUDE.md) (5 min read)
- [ ] Read [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for overview
- [ ] Verify you have Supabase CLI installed: `supabase --version`
- [ ] Verify you have project access: `supabase projects list`

## Step 1: Configure API Key (5 minutes)

- [ ] Go to: https://supabase.com/dashboard
- [ ] Select your project from the list
- [ ] Click: **Settings** (left sidebar) → **Secrets**
- [ ] Click: **New Secret**
- [ ] Set **Name:** `CLAUDE_API_KEY`
- [ ] Set **Value:** `[your-claude-api-key]` (get from https://console.anthropic.com)
- [ ] Click: **Save**
- [ ] Verify secret appears in the secrets list

## Step 2: Deploy Function (3 minutes)

Open terminal and run:

```bash
# Navigate to project root
cd /Users/gianfrancorandazzo/Library/CloudStorage/OneDrive-Personal/Desktop/Harvard/Ceqnce/app-mvp/projectslge

# Verify Supabase is linked to your project
supabase status

# Deploy the updated analyzeImage function
supabase functions deploy analyzeImage

# Wait for "✅ Function deployed successfully" message
```

**Expected Output:**
```
✅ Function deployed successfully: analyzeImage
   Endpoint: https://xxx-yyy-zzz.supabase.co/functions/v1/analyzeImage
```

- [ ] Function deployment completed without errors
- [ ] Note the endpoint URL (you'll need it for testing)

## Step 3: Verify Deployment (2 minutes)

Run in terminal:

```bash
# Check function logs (should show recent deployment)
supabase functions get-logs analyzeImage

# You should see: "Function deployed" message in logs
```

- [ ] Logs show recent deployment
- [ ] No error messages in logs

## Step 4: Test with cURL (5 minutes)

Replace placeholders and run:

```bash
# Get your values:
# PROJECT_URL: Settings → API (copy Project URL)
# ANON_KEY: Settings → API (copy anon key)

curl -X POST https://<PROJECT_URL>/functions/v1/analyzeImage \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    "imagePath": "test/chair.jpg"
  }'
```

**Expected Response (one of these):**

High confidence:
```json
{
  "type": "identified",
  "confidence": 0.9,
  "item": {
    "title": "Office Chair",
    "category": "Furniture",
    ...
  }
}
```

Medium confidence:
```json
{
  "type": "needs_clarification",
  "confidence": 0.72,
  "question": "Which item matches your photo?",
  "options": [...]
}
```

- [ ] Received valid JSON response
- [ ] Response has `type`, `confidence`, and either `item` or `question`
- [ ] No error messages

## Step 5: Test from Mobile App (5 minutes)

In your mobile app code:

```typescript
const { data, error } = await supabase.functions.invoke('analyzeImage', {
  body: {
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    imagePath: 'test/chair.jpg'
  }
});

console.log('Result:', data);
if (error) console.error('Error:', error);
```

- [ ] Function call completes without errors
- [ ] Response data is received
- [ ] Response matches expected format
- [ ] App handles both `identified` and `needs_clarification` responses

## Step 6: Monitoring (Ongoing)

After deployment, monitor:

```bash
# View recent logs (auto-updates)
supabase functions get-logs analyzeImage --tail

# Check for errors, timeouts, or API issues
```

- [ ] Logs show successful requests
- [ ] No recurring error patterns
- [ ] Response times are reasonable (2-5 seconds normal)

## Post-Deployment

### Monitor Claude API Usage
- [ ] Log in to: https://console.anthropic.com
- [ ] Check **Usage** tab for token consumption
- [ ] Estimate monthly costs

### Document in Your Notes
- [ ] Project URL: _________________
- [ ] Anon Key: _________________
- [ ] Deployment Date: _________________
- [ ] First test image: _________________

### Optional: Set Up Analytics
- [ ] Log each analysis result to database
- [ ] Track confidence distribution
- [ ] Monitor cost per image

## Troubleshooting

If deployment fails at any step:

### "Secret not found" error
1. Verify secret was saved: Settings → Secrets
2. Confirm name is exactly `CLAUDE_API_KEY`
3. Redeploy function

### "CLAUDE_API_KEY is required" error
1. Check secret exists in Supabase
2. Wait 1-2 minutes for secret to propagate
3. Redeploy function with: `supabase functions deploy --no-verify analyzeImage`

### Timeout errors
1. Verify image URL is accessible
2. Try with smaller image
3. Check Claude API quota: https://console.anthropic.com

### "Failed to parse response" errors
1. Check Supabase logs: `supabase functions get-logs analyzeImage`
2. Verify Claude API key is valid
3. Check if Claude API is experiencing issues

## Quick Reference

**Function Endpoint:**
- POST: `https://<PROJECT_URL>/functions/v1/analyzeImage`

**Required Headers:**
- `Authorization: Bearer <ANON_KEY>`
- `Content-Type: application/json`

**Required Fields:**
- `imageUrl` (string): URL to image
- `imagePath` (string): Storage path

**Response Types:**
- High confidence: `type: "identified"`
- Medium/low confidence: `type: "needs_clarification"`

**Documentation:**
- Quick Start: [QUICK_START_CLAUDE.md](QUICK_START_CLAUDE.md)
- Full Setup: [supabase/CLAUDE_API_SETUP.md](supabase/CLAUDE_API_SETUP.md)
- Technical: [CLAUDE_INTEGRATION_SUMMARY.md](CLAUDE_INTEGRATION_SUMMARY.md)
- Implementation: [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)

## Success Criteria

✅ You have successfully deployed when:
1. Secret `CLAUDE_API_KEY` is in Supabase Settings
2. Function deployed without errors
3. cURL test returns valid JSON response
4. Mobile app can call function and receive results
5. Logs show successful requests (no repeated errors)

**Estimated Time to Complete:** 20 minutes

---

**Need Help?**
- Check [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) Troubleshooting section
- View function logs: `supabase functions get-logs analyzeImage`
- Read the detailed setup guide: [supabase/CLAUDE_API_SETUP.md](supabase/CLAUDE_API_SETUP.md)
