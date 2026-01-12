# AI Pipeline Documentation

## Overview

The Passive Shopping app uses a Supabase-powered backend with an Edge Function for AI-based image analysis. This document describes the architecture, implementation, and flow for the image upload and analysis pipeline.

## Architecture

```
Mobile App (React Native/Expo)
    ↓
Supabase Storage (item-images bucket)
    ↓
Edge Function (analyzeImage)
    ↓
Supabase Database (items table)
```

## Environment Setup

### Required Environment Variables

Add these to `/apps/mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://wnerxlpanzosudbipvom.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZXJ4bHBhbnpvc3VkYmlwdm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjUxNzksImV4cCI6MjA4MzYwMTE3OX0.Ph-sqGrBIB-HZIBKMNzsdAjSWneP9OPoERjrapvMHT8
```

### Storage Bucket Configuration

- **Bucket name**: `item-images`
- **Privacy**: Private (use signed URLs for access)
- **Path format**: `{userId}/{timestamp}.{ext}`

To switch to public bucket (if needed):
1. Update bucket permissions in Supabase dashboard
2. Use `getPublicUrl()` instead of `createSignedUrl()` in `imageService.ts`

## Database Schema

### Items Table

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  image_url TEXT,
  label TEXT NOT NULL DEFAULT '',
  confidence NUMERIC,
  category TEXT,
  description TEXT,
  notes TEXT,
  phase TEXT DEFAULT 'original',
  intent TEXT DEFAULT 'owned',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)

Users can only CRUD their own items where `owner_id = auth.uid()`.

## Edge Function: analyzeImage

### Location

`/supabase/functions/analyzeImage/index.ts`

### API Contract

**Request:**
```typescript
{
  imageUrl: string;    // Signed URL or public URL
  imagePath: string;   // Storage path (userId/filename.ext)
}
```

**Response (High Confidence):**
```typescript
{
  mode: "final";
  confidence: 0.92;
  label: "furniture";
}
```

**Response (Low Confidence - Needs Clarification):**
```typescript
{
  mode: "clarify";
  confidence: 0.65;
  label: "electronics";
  clarification: {
    question: "We're not quite sure what this is. Can you help us out?";
    options: [
      { id: "option-1", label: "laptop" },
      { id: "option-2", label: "tablet" },
      { id: "option-3", label: "phone" }
    ]
  }
}
```

### Configuration

- **HIGH_CONFIDENCE_THRESHOLD**: 0.80 (80%)
- If confidence ≥ 80% → mode="final"
- If confidence < 80% → mode="clarify"

### Stub AI Logic

Currently implements random confidence generation and category selection for demonstration. Replace with actual ML model or LLM integration:

```typescript
// In analyzeImageStub function:
// TODO: Replace with actual model inference
const confidence = await yourModel.predict(imageUrl);
const label = await yourModel.classify(imageUrl);
```

### Deploying the Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref wnerxlpanzosudbipvom

# Deploy the function
supabase functions deploy analyzeImage

# Set environment variables (if needed)
supabase secrets set MY_SECRET=value
```

## End-to-End Flow

### 1. User selects/takes photo

- Uses Expo ImagePicker
- Gets local URI: `file:///path/to/image.jpg`

### 2. Upload to Supabase Storage

```typescript
import { uploadImage } from '../services/imageService';

const { path, error } = await uploadImage(localUri, userId);
// path: "user-123/1234567890.jpg"
```

### 3. Get signed URL and analyze

```typescript
import { getSignedUrl, analyzeImage } from '../services/imageService';

const signedUrl = await getSignedUrl(path);
const result = await analyzeImage(signedUrl, path);
```

### 4. Handle response

**If `mode === "final"`:**
- Pre-fill category with `result.label`
- Navigate to ConfirmAddToList screen
- User reviews and submits

**If `mode === "clarify"`:**
- Navigate to Clarification screen with options
- User selects correct category
- Confidence set to 0.9 after user confirmation
- Navigate to ConfirmAddToList screen

### 5. Insert into database

```typescript
const { data, error } = await supabase
  .from('items')
  .insert({
    owner_id: userId,
    image_path: path,
    label: selectedCategory,
    confidence: finalConfidence,
    category: selectedCategory,
    description: userDescription,
    phase: 'original',
    intent: 'owned',
  });
```

## Image Display

### Private Bucket (Current Implementation)

```typescript
import { getSignedUrl } from '../services/imageService';

const imageUrl = await getSignedUrl(item.image_path);
// Use imageUrl in <Image source={{ uri: imageUrl }} />
```

Signed URLs expire after 1 hour by default. Adjust with:
```typescript
getSignedUrl(path, 7200); // 2 hours
```

### Public Bucket (Alternative)

If you switch to public bucket:

```typescript
const { data } = supabase.storage
  .from('item-images')
  .getPublicUrl(path);

const imageUrl = data.publicUrl;
```

## Testing

### Run the App

```bash
cd apps/mobile
npm install
npm start
```

Scan QR code with Expo Go app.

### Test Edge Function Locally

```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve analyzeImage

# Test with curl
curl -X POST \
  http://localhost:54321/functions/v1/analyzeImage \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/image.jpg","imagePath":"test/123.jpg"}'
```

## Database Migration

Run the migration to create the items table:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard SQL Editor
# Copy contents of /supabase/migrations/20260111000000_create_items_table.sql
```

## Future Improvements

1. **Real AI Model Integration**
   - Replace `analyzeImageStub` with actual ML model
   - Consider using OpenAI Vision API, Google Cloud Vision, or custom model

2. **Confidence Calibration**
   - Adjust `HIGH_CONFIDENCE_THRESHOLD` based on production data
   - Implement A/B testing for threshold values

3. **Image Optimization**
   - Resize images before upload to reduce storage costs
   - Generate thumbnails for list views

4. **Batch Processing**
   - Allow uploading multiple images at once
   - Queue analysis jobs for better performance

5. **Caching**
   - Cache signed URLs to reduce API calls
   - Implement client-side image caching

## Troubleshooting

### "Cannot find module 'babel-preset-expo'"
```bash
cd apps/mobile
npm install babel-preset-expo
```

### "Storage bucket not found"
Create the `item-images` bucket in Supabase Dashboard → Storage.

### "Row Level Security policy violation"
Ensure user is authenticated and RLS policies are applied correctly.

### Edge Function not working
1. Check function is deployed: `supabase functions list`
2. View logs: `supabase functions logs analyzeImage`
3. Verify anon key has correct permissions

## Contact & Support

For issues or questions:
- File an issue in the GitHub repository
- Check Supabase documentation: https://supabase.com/docs
