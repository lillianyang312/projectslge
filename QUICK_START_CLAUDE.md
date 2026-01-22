# Quick Start: Claude Image Analysis

## 3-Step Setup

### Step 1: Add API Key to Supabase
```
Dashboard → Settings → Secrets
  Name: CLAUDE_API_KEY
  Value: sk-ant-api03-...
  Click Save
```

### Step 2: Deploy Function
```bash
supabase functions deploy analyzeImage
```

### Step 3: Test It
```bash
curl -X POST https://<project>.supabase.co/functions/v1/analyzeImage \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/chair.jpg",
    "imagePath": "test/chair.jpg"
  }'
```

## What Happens Inside

1. Fetch image from URL → Convert to base64
2. Send to Claude Opus 4.5 with vision prompt
3. Claude analyzes and returns:
   - **High confidence (≥0.85):** Specific item identified
   - **Medium confidence (0.60-0.84):** Multiple options to choose from
   - **Low confidence (<0.60):** Ask for clarification

## Response Examples

**High Confidence:**
```json
{
  "type": "identified",
  "confidence": 0.94,
  "item": {
    "title": "Office Chair",
    "category": "Furniture",
    "description": "Black ergonomic office chair...",
    "condition": "good",
    "tags": ["chair", "office"]
  }
}
```

**Needs Clarification:**
```json
{
  "type": "needs_clarification",
  "confidence": 0.71,
  "question": "Which item matches your photo?",
  "options": [
    {"id": "opt-1", "label": "Desk", "descriptor": "..."},
    {"id": "opt-2", "label": "Table", "descriptor": "..."}
  ]
}
```

## In Your App (TypeScript)

```typescript
const { data, error } = await supabase.functions.invoke('analyzeImage', {
  body: {
    imageUrl: imageUrl,
    imagePath: 'user-123/image.jpg'
  }
});

if (data?.type === 'identified') {
  console.log('Item:', data.item.title);
} else {
  console.log('Ask user:', data.question);
  console.log('Options:', data.options);
}
```

## Key Files

- **Implementation:** `supabase/functions/analyzeImage/index.ts`
- **Claude Client:** `supabase/functions/shared/claudeClient.ts`
- **Setup Guide:** `supabase/CLAUDE_API_SETUP.md`
- **Full Docs:** `CLAUDE_INTEGRATION_SUMMARY.md`

## Supported Image Formats

✅ JPEG, PNG, GIF, WebP

## Costs

~$0.05-0.10 per image (varies by complexity)

## Need Help?

See [CLAUDE_API_SETUP.md](supabase/CLAUDE_API_SETUP.md) troubleshooting section or check Supabase logs:
```bash
supabase functions get-logs analyzeImage
```
