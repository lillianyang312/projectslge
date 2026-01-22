# Claude API Setup for analyzeImage Function

This guide explains how to configure the Claude Opus 4.5 API key for the image analysis edge function.

## Overview

The `analyzeImage` edge function now uses Claude Opus 4.5 (via Claude API) to analyze images and identify items. The function:
1. Takes an image URL as input
2. Converts it to base64 and sends it to Claude Opus 4.5
3. Claude analyzes the image and returns structured item data
4. Returns either an identified item (high confidence) or clarification options (medium/low confidence)

## Setup Steps

### 1. Set the Environment Variable in Supabase

The Claude API key must be stored as a Supabase secret for the edge function to access it:

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Settings** → **Edge Functions** (or **Configuration** → **Secrets** depending on your Supabase version)
3. Create a new secret:
   - **Name:** `CLAUDE_API_KEY`
   - **Value:** Your Claude API key (starts with `sk-ant-api03-...`)
4. Click **Save**

### 2. Deploy the Updated Function

Once the secret is set, deploy the updated `analyzeImage` function:

```bash
supabase functions deploy analyzeImage
```

Or if using Supabase CLI with a linked project:

```bash
supabase functions deploy --project-id <your-project-id> analyzeImage
```

## API Integration Details

### Request Format

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "imagePath": "user-123/1234567890.jpg"
}
```

### Response Format

The function returns a `ClarificationResponse` which is one of two types:

**High Confidence (≥0.85):**
```json
{
  "type": "identified",
  "item": {
    "title": "Office Chair",
    "category": "Furniture",
    "description": "Ergonomic office chair with adjustable features",
    "condition": "Good",
    "tags": ["chair", "office", "furniture"]
  },
  "confidence": 0.92
}
```

**Medium/Low Confidence (<0.85):**
```json
{
  "type": "needs_clarification",
  "question": "Which item matches your photo?",
  "options": [
    {
      "id": "option-1",
      "label": "Furniture",
      "descriptor": "A furniture item that matches your photo"
    }
  ],
  "confidence": 0.72
}
```

## Claude Opus 4.5 Specifications

- **Model ID:** `claude-opus-4-5-20251101`
- **Vision Capabilities:** Yes (image/jpeg, image/png, image/gif, image/webp)
- **Max Input Tokens:** 200,000
- **Max Output Tokens:** 4,096

## Testing the Function

### Using cURL

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/analyzeImage \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/chair.jpg",
    "imagePath": "test/chair.jpg"
  }'
```

### Using Node.js/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('analyzeImage', {
  body: {
    imageUrl: 'https://example.com/chair.jpg',
    imagePath: 'test/chair.jpg'
  }
});

if (error) {
  console.error('Analysis failed:', error);
} else {
  console.log('Analysis result:', data);
}
```

## Troubleshooting

### "Claude API key not configured"
- Check that `CLAUDE_API_KEY` secret is set in Supabase Settings → Secrets
- Verify you deployed the function after setting the secret
- Redeploy the function: `supabase functions deploy analyzeImage`

### "Failed to fetch image"
- Ensure the image URL is accessible and returns a 200 status
- Check that the image format is supported (JPEG, PNG, GIF, WebP)
- Verify the image is not too large (should be <20MB)

### "Failed to parse Claude's JSON response"
- Claude may be returning unexpected format
- Check Supabase function logs: `supabase functions get-logs analyzeImage`
- Verify Claude API key is valid and has quota

### Image takes too long to analyze
- Claude's vision analysis can take 2-5 seconds depending on image complexity
- Ensure your client-side timeout is at least 10 seconds
- Check Supabase function logs for bottlenecks

## Implementation Details

The `analyzeImage` function:
1. **Validates** the request (imageUrl and imagePath required)
2. **Fetches** the image from the URL and converts to base64
3. **Calls Claude Opus 4.5** with vision-specific prompt
4. **Parses** the JSON response from Claude
5. **Validates** the response structure against schema
6. **Converts** Claude's result to `ClarificationResponse` format
7. **Returns** the validated response or error details

See [supabase/functions/shared/claudeClient.ts](functions/shared/claudeClient.ts) for implementation.

## Cost Considerations

Claude Opus 4.5 API calls are charged based on input/output tokens:
- **Input tokens:** ~$0.003 per 1K tokens
- **Output tokens:** ~$0.015 per 1K tokens
- Image analysis typically uses 500-1500 input tokens + 200-500 output tokens per request

Monitor usage in your Claude API dashboard: https://console.anthropic.com

## Next Steps

- Test the function with various image types
- Monitor performance and costs
- Consider caching results if analyzing the same image multiple times
- Adjust Claude's system prompt if needed for domain-specific improvements
