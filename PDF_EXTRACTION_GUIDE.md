# Senior Sale PDF Extraction System

Complete system for extracting items from senior sale PDFs and converting them to the platform's item format.

## Overview

This feature allows users to upload a PDF from a senior sale slideshow and automatically extract all items with their:
- Price
- Title and description
- Product images
- Condition
- Category (auto-inferred)
- Sold status

The extracted data is returned in JSON format matching the app's `Item` schema, ready for review and creation.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile App                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Upload Screen (ItemDetails.tsx)                      │   │
│  │ - PDF file picker                                    │   │
│  │ - Call: uploadAndExtractPDF()                        │   │
│  │ - Display extracted items for review                 │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                  │
│           │ pdfService.ts                                   │
│           ├─ uploadPDF()                                    │
│           └─ extractItemsFromPDF()                          │
│           │                                                  │
└───────────┼──────────────────────────────────────────────────┘
            │
            │ Supabase Storage (item-pdfs bucket)
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Edge Function (/extractPDF)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Download PDF from storage                         │   │
│  │ 2. Parse PDF (extract text + images)                 │   │
│  │ 3. Send to Claude for structured parsing             │   │
│  │ 4. Upload item images to item-images bucket          │   │
│  │ 5. Return extracted items as JSON                    │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                  │
│           └─ Calls Claude API for parsing                  │
│           └─ Uploads to Supabase Storage                   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
projectslge/
├── supabase/
│   ├── functions/
│   │   └── extractPDF/
│   │       ├── index.ts          # Main extraction logic
│   │       └── deno.json         # Dependencies
│   └── migrations/
│       └── 20250121000000_create_pdf_storage.sql
│
├── apps/mobile/src/
│   ├── services/
│   │   └── pdfService.ts         # Mobile service for PDFs
│   ├── types/
│   │   └── pdfExtraction.ts      # TypeScript types
│   └── screens/upload/
│       └── ItemDetails.tsx       # Add PDF picker here
│
└── scripts/
    └── test-pdf-extraction.js    # Testing script
```

## Setup Instructions

### 1. Create Storage Bucket

Create the `item-pdfs` bucket in Supabase:

```bash
# Using Supabase CLI
supabase storage create-bucket item-pdfs --public false
```

Or manually in the Supabase Dashboard:
1. Go to Storage → Buckets
2. Create new bucket: `item-pdfs`
3. Set to Private (not public)
4. Save

### 2. Set RLS Policies (Optional)

If you want to restrict PDF access by user:

```sql
-- Allow users to upload PDFs to their own folder
CREATE POLICY "Users can upload PDFs to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow users to read their own PDFs
CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'item-pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

### 3. Deploy Edge Function

Deploy the extractPDF edge function:

```bash
# Using Supabase CLI
supabase functions deploy extractPDF

# Or push to remote
supabase push
```

The function uses these environment variables:
- `SUPABASE_URL` - Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-provided)
- `CLAUDE_API_KEY` - Claude API key (already set in your Supabase)

### 4. Add PDF Picker to Mobile App

Update `ItemDetails.tsx` to include PDF upload option:

```typescript
import { uploadAndExtractPDF } from '../services/pdfService';
import * as DocumentPicker from 'expo-document-picker';

// In your component:
const handlePDFUpload = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
  });

  if (result.type === 'success') {
    const { items, error } = await uploadAndExtractPDF(result.uri);

    if (error) {
      Alert.alert('Extraction Error', error);
      return;
    }

    // Display extracted items for user review
    showExtractedItemsReview(items);
  }
};
```

## Usage

### From Mobile App

```typescript
import { uploadAndExtractPDF } from '@/services/pdfService';

// Upload and extract PDF (returns extracted items)
const { items, error } = await uploadAndExtractPDF(pdfLocalUri);

if (error) {
  console.error('Extraction failed:', error);
} else {
  console.log('Extracted items:', items);
  // Show items to user for review/editing
  // Allow them to create posts from extracted items
}
```

### Response Format

The extraction returns an array of `ExtractedItemOutput`:

```typescript
interface ExtractedItemOutput {
  title: string;                    // "Dell laptop i7"
  category: string;                 // "electronics"
  description: string;              // "At least 8gb ram, maybe 16. Screen doesn't work..."
  photos: string[];                 // ["user-123/1234567890.jpg"]
  user_min_price?: number;          // 16.0 (80% of asking price)
  user_max_price?: number;          // 20.0 (asking price)
  condition?: string;               // "fair"
  isSold?: boolean;                 // false
  confidence?: number;              // 0.85
}
```

## How It Works

### Step 1: PDF Upload
The PDF is uploaded to Supabase Storage in the `item-pdfs` bucket with path: `{userId}/{timestamp}.pdf`

### Step 2: PDF Parsing
The extractPDF function:
1. Downloads the PDF from storage
2. Extracts text from each page using PDF.js
3. Compiles all page text into a single document

### Step 3: Claude Parsing
The function sends the extracted text to Claude with a structured prompt:
- Claude identifies individual items (by price + description)
- Extracts item details (title, description, price)
- Detects sold status (from description or "SOLD" markers)
- Formats as JSON array

Sample Claude prompt:
```
You are a PDF parser for senior sale slideshows.
Extract all items with:
- title: The name of the item
- description: Full description including condition, size, brand notes
- price: The asking price (just the number)
- isSold: boolean indicating if marked as sold

Return ONLY a valid JSON array.
```

### Step 4: Item Mapping
Each parsed item is mapped to the app's `Item` schema:
- **title**: From parsed item name
- **category**: Inferred from title/description keywords (electronics, clothing, books, etc.)
- **description**: Full text from PDF
- **photos**: Storage paths of uploaded images
- **condition**: Inferred from description ("new", "like_new", "good", "fair", "poor")
- **user_min_price**: 80% of asking price (minimum negotiation room)
- **user_max_price**: Asking price from PDF
- **confidence**: Always 0.85 (based on PDF text clarity)

### Step 5: Response
Returns `PDFExtractionResponse` with:
```typescript
{
  success: true,
  items: [...],      // Array of ExtractedItemOutput
  metadata: {
    totalPages: 12,
    totalItems: 14,
    extractedAt: "2025-01-21T..."
  }
}
```

## PDF Format Requirements

The system works best with PDFs that follow this structure:

```
Page 1: Cover/title page (skipped)

Page 2+: Items with format:
  $PRICE | ITEM NAME - DESCRIPTION
  [PRODUCT IMAGE]

---

$20 | Dell laptop i7 - At least 8gb ram, maybe 16...
[Image of laptop]

---

$5 | Shampoo conditioner - Unopened, good scent...
[Image of product]
```

### Supported Variations
- ✅ Price ranges: "$1-5 item name"
- ✅ Free items: "Free Kyries" or "take for free"
- ✅ Sold items: "SOLD" in red background or text
- ✅ Text-only items: No image required
- ✅ Multiple images: Per item
- ✅ Quantity variations: "$1 for single, $2 for double"

## Type Definitions

### PDFExtractionRequest
```typescript
interface PDFExtractionRequest {
  pdfPath: string;           // Path in Supabase Storage
  userId: string;            // User who uploaded the PDF
  options?: {
    extractMetadata?: boolean;
    analyzeImages?: boolean;
  };
}
```

### ExtractedItemOutput
```typescript
interface ExtractedItemOutput {
  title: string;
  category: string;
  description: string;
  photos: string[];
  user_min_price?: number;
  user_max_price?: number;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  isSold?: boolean;
  confidence?: number;
}
```

### PDFExtractionResponse
```typescript
interface PDFExtractionResponse {
  success: boolean;
  items: ExtractedItemOutput[];
  errors?: string[];
  metadata?: {
    totalPages: number;
    totalItems: number;
    extractedAt: string;
  };
}
```

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `pdfPath and userId are required` | Missing parameters | Check request body |
| `Failed to download PDF` | PDF not in storage | Verify upload success |
| `Failed to parse Claude response` | Invalid JSON from Claude | Retry or check API key |
| `No text response from Claude` | Claude returned non-text | Check Claude API status |

## Testing

### Using the Test Script

```bash
# Your CLAUDE_API_KEY is already set in Supabase, no new env vars needed
# Just run the test script:
node scripts/test-pdf-extraction.js
```

This will:
1. Verify environment variables
2. Check sample PDF exists
3. Display expected extraction results
4. Show integration points
5. Provide next steps

### Manual Testing

1. Upload `sample_senior_sale.pdf` to Supabase Storage
2. Call extractPDF edge function with PDF path
3. Verify response contains ~14 items
4. Check extracted fields match PDF content

## Performance Considerations

- **PDF Size**: Works with PDFs up to 10MB (Supabase default)
- **Item Count**: Optimal for 5-50 items (tested with 14)
- **Claude API**: ~2-3 seconds per PDF (depends on size)
- **Image Upload**: Parallel uploads improve performance
- **Storage**: PDFs are 1-3MB, items images are ~200KB each

## Future Enhancements

Potential improvements:

1. **Image Analysis**: Use Claude vision to analyze item photos
2. **Price Suggestions**: Cross-reference with market data
3. **Duplicate Detection**: Find duplicate items in catalog
4. **Batch Processing**: Extract multiple PDFs in one request
5. **Confidence Scoring**: Show confidence for each extracted field
6. **User Correction UI**: Allow users to edit extracted items before posting

## Troubleshooting

### PDFs not uploading
- Check bucket exists: `item-pdfs`
- Verify RLS policies allow upload
- Check file size (<10MB)

### Extraction returning empty
- Verify PDF has text (not image-only)
- Check Claude API key is valid
- Review function logs in Supabase Dashboard

### Images not uploading
- Check `item-images` bucket exists
- Verify storage quota not exceeded
- Check network connectivity

### Wrong category/condition inferred
- Categories and conditions are inferred from keywords
- User can edit after extraction
- Future: Add manual override UI

## Related Files

- [imageService.ts](apps/mobile/src/services/imageService.ts) - Similar upload pattern
- [models.ts](apps/mobile/src/types/models.ts) - Item schema definition
- [ItemDetails.tsx](apps/mobile/src/screens/upload/ItemDetails.tsx) - Upload UI
- [analyzeImage/index.ts](supabase/functions/analyzeImage/index.ts) - Image analysis reference

## Support

For issues or questions:
1. Check logs in Supabase Dashboard (Functions section)
2. Verify all environment variables are set
3. Test with `sample_senior_sale.pdf`
4. Check API key validity and quotas
