# Testing analyzeImage with Real Images

This guide explains how to test the `analyzeImage` edge function with real images using OpenAI GPT-4 Vision.

## Prerequisites

1. **Supabase Project Setup**
   - Edge function deployed: `supabase functions deploy analyzeImage`
   - Environment variables set in `apps/mobile/.env.local`:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`

2. **OpenAI API Key**
   - Set in Supabase secrets: `supabase secrets set OPENAI_API_KEY=sk-...`
   - Or set locally for testing: `export OPENAI_API_KEY=sk-...`

## Quick Start

### Option 1: Use the Test Script (Recommended)

The test script makes it easy to test with various image sources:

```bash
# Test with a public image URL
npx tsx scripts/test_analyze_image.ts https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800

# Test with a local image (uploads to Supabase Storage first)
npx tsx scripts/test_analyze_image.ts ./static/closet_example.jpg

# Test with multiple default images
npx tsx scripts/test_analyze_image.ts
```

### Option 2: Test via Supabase Dashboard

1. Go to **Edge Functions** → **analyzeImage** → **Invoke** tab
2. Enter test payload:
   ```json
   {
     "imageUrl": "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
     "imagePath": "test/office-chair.jpg"
   }
   ```
3. Click **Invoke Function**
4. Check the response and logs

### Option 3: Test via cURL

```bash
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/analyzeImage \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
    "imagePath": "test/office-chair.jpg"
  }'
```

### Option 4: Test Locally (Before Deploying)

Test the function locally before deploying:

```bash
# Start local Supabase (if not already running)
supabase start

# Serve the function locally
supabase functions serve analyzeImage --env-file .env.local

# In another terminal, test with curl
curl -X POST \
  http://localhost:54321/functions/v1/analyzeImage \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
    "imagePath": "test/office-chair.jpg"
  }'
```

**Note:** For local testing, you'll need to set `OPENAI_API_KEY` in your `.env.local` file.

## Image Sources

### 1. Public Image URLs

Use any publicly accessible image URL:

```bash
npx tsx scripts/test_analyze_image.ts https://example.com/image.jpg
```

**Good sources:**
- Unsplash: `https://images.unsplash.com/photo-...`
- Supabase Storage public URLs
- Any public image hosting service

### 2. Supabase Storage Images

If you have images in Supabase Storage:

1. **Get Public URL** (if bucket is public):
   ```typescript
   const { data } = supabase.storage
     .from('item-images')
     .getPublicUrl('path/to/image.jpg');
   const imageUrl = data.publicUrl;
   ```

2. **Get Signed URL** (if bucket is private):
   ```typescript
   const { data } = await supabase.storage
     .from('item-images')
     .createSignedUrl('path/to/image.jpg', 3600);
   const imageUrl = data.signedUrl;
   ```

3. **Test with the URL**:
   ```bash
   npx tsx scripts/test_analyze_image.ts <signed-or-public-url>
   ```

### 3. Local Images

Upload local images to Supabase Storage first:

```bash
# The test script will upload automatically
npx tsx scripts/test_analyze_image.ts ./static/closet_example.jpg
```

Or upload manually:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Upload
const { data, error } = await supabase.storage
  .from('item-images')
  .upload('test/image.jpg', fileBlob);

// Get public URL
const { data: urlData } = supabase.storage
  .from('item-images')
  .getPublicUrl(data.path);

// Use urlData.publicUrl in analyzeImage
```

## Expected Responses

### High Confidence (≥0.85)

```json
{
  "type": "identified",
  "item": {
    "title": "Herman Miller Aeron Chair",
    "category": "Furniture",
    "description": "Ergonomic office chair with mesh back",
    "condition": "Like new",
    "tags": ["chair", "office", "ergonomic"]
  },
  "confidence": 0.92
}
```

### Medium Confidence (0.60-0.84)

```json
{
  "type": "needs_clarification",
  "question": "Which chair matches your item?",
  "options": [
    {
      "id": "option-1",
      "label": "Herman Miller Aeron Chair",
      "descriptor": "Mesh back, ergonomic office chair",
      "thumbnail": "https://example.com/aeron.jpg"
    },
    {
      "id": "option-2",
      "label": "Steelcase Leap Chair",
      "descriptor": "Ergonomic office chair with contoured back"
    }
  ],
  "confidence": 0.72
}
```

### Low Confidence (<0.60)

```json
{
  "type": "needs_clarification",
  "question": "What type of furniture is this? (e.g., chair, desk, table)",
  "options": [],
  "confidence": 0.35
}
```

## Troubleshooting

### "OPENAI_API_KEY is not set"

**Solution:** Set the API key in Supabase secrets:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

Or for local testing, add to `.env.local`:
```
OPENAI_API_KEY=sk-...
```

### "Edge function is not deployed"

**Solution:** Deploy the function:
```bash
supabase functions deploy analyzeImage
```

### "Invalid response format"

**Possible causes:**
- OpenAI API returned unexpected format
- Network error during API call
- Image URL is not accessible

**Solution:**
- Check function logs in Supabase Dashboard
- Verify image URL is publicly accessible
- Check OpenAI API status

### Rate Limiting

OpenAI API has rate limits. If you hit limits:
- Wait a few minutes between requests
- Use the test script which includes delays
- Consider upgrading your OpenAI plan

### Image URL Not Accessible

**Symptoms:** Function returns error about image access

**Solutions:**
- Ensure image URL is publicly accessible
- For Supabase Storage, use signed URLs for private buckets
- Check CORS settings if hosting images yourself

## Testing Different Scenarios

### Test High Confidence Items

Use clear, well-lit images of common items:
- Office chairs
- Laptops
- Books
- Clothing items

```bash
npx tsx scripts/test_analyze_image.ts https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800
```

### Test Medium Confidence Items

Use images where the item type is clear but specifics are ambiguous:
- Generic furniture
- Electronics without visible branding
- Clothing without clear brand labels

### Test Low Confidence Items

Use blurry, dark, or ambiguous images:
- Poor lighting
- Multiple items in frame
- Unclear angles

## Integration Testing

To test the full flow from your mobile app:

1. **Upload image** to Supabase Storage
2. **Get signed URL** for the image
3. **Call analyzeImage** with the signed URL
4. **Handle response** based on confidence level
5. **Display results** to user

Example integration test:

```typescript
// In your mobile app or test script
const imagePath = 'user-123/item-456.jpg';

// Upload image
const { data: uploadData } = await supabase.storage
  .from('item-images')
  .upload(imagePath, imageBlob);

// Get signed URL
const { data: urlData } = await supabase.storage
  .from('item-images')
  .createSignedUrl(imagePath, 3600);

// Analyze image
const { data, error } = await supabase.functions.invoke('analyzeImage', {
  body: {
    imageUrl: urlData.signedUrl,
    imagePath: imagePath,
  },
});

// Handle response
if (data.type === 'identified') {
  console.log('Item identified:', data.item.title);
} else {
  console.log('Needs clarification:', data.question);
}
```

## Cost Considerations

OpenAI GPT-4 Vision pricing:
- ~$0.01-0.03 per image (depending on resolution)
- Monitor usage in OpenAI dashboard
- Consider caching results for identical images

## Next Steps

1. ✅ Test with various image types
2. ✅ Verify confidence thresholds are working
3. ✅ Test error handling
4. ✅ Monitor API costs
5. ✅ Optimize prompt if needed
6. ✅ Add more test cases to test suite

