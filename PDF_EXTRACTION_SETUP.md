# PDF Extraction Setup & Deployment Checklist

Step-by-step guide to set up and deploy the PDF extraction system.

## Phase 1: Environment Setup (5 minutes)

### 1.1 Supabase Storage Bucket

Create the PDF storage bucket:

**Option A: Using Supabase CLI**
```bash
cd projectslge
supabase storage create-bucket item-pdfs --public false
```

**Option B: Using Supabase Dashboard**
1. Go to Storage → Buckets
2. Click "Create bucket"
3. Name: `item-pdfs`
4. Public: OFF (keep private)
5. Save

**Verify:**
```bash
supabase storage list
# Should show: item-pdfs  (private)
```

### 1.2 Verify Claude API Key

Your `CLAUDE_API_KEY` is already set up in Supabase. This is used by the extractPDF function.

**Verify the key is set:**
```bash
supabase secrets list
# Should show: CLAUDE_API_KEY with a value
```

If not set, add it in Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add environment variable:
   ```
   CLAUDE_API_KEY = your_key
   ```

## Phase 2: Deploy Edge Function (5-10 minutes)

### 2.1 Deploy extractPDF Function

```bash
# From project root
supabase functions deploy extractPDF
```

**Expected output:**
```
Deploying function 'extractPDF'...
Deployed function 'extractPDF' at
https://[project-id].functions.supabase.co/extractPDF
✓ Function deployed successfully
```

### 2.2 Verify Deployment

Test the function:

```bash
# Get your project URL and anon key from Supabase dashboard
curl -X POST https://wnerxlpanzosudbipvom.functions.supabase.co/extractPDF \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your-anon-key]" \
  -d '{
    "pdfPath": "test/sample.pdf",
    "userId": "test-user"
  }'
```

Or use the Supabase Dashboard:
1. Go to Functions → extractPDF
2. Click "Test"
3. Send a request (it will fail without a real PDF, but verifies the function runs)

**Common Issues:**
- Function not found: Wait 5-10 seconds, then refresh
- API key error: Verify CLAUDE_API_KEY is set in Supabase
- Timeout: PDF might be too large or Claude API rate limited

## Phase 3: Mobile App Integration (20-30 minutes)

### 3.1 Install Dependencies

```bash
cd apps/mobile
npx expo install expo-document-picker
npm install  # if needed
```

### 3.2 Add PDF Picker to Upload Screen

Edit `apps/mobile/src/screens/upload/ItemDetails.tsx`:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import { uploadAndExtractPDF } from '@/services/pdfService';

// In your component (replace placeholder UI):
const handlePDFUpload = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });

    if (result.type === 'success') {
      setIsLoading(true);
      const { items, error } = await uploadAndExtractPDF(result.uri);

      if (error) {
        Alert.alert('Extraction Error', error);
      } else {
        // Navigate to review screen
        navigation.navigate('ReviewExtractedItems', { items });
      }
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to select PDF');
  } finally {
    setIsLoading(false);
  }
};

// Add button to UI
<TouchableOpacity onPress={handlePDFUpload} disabled={isLoading}>
  <Text>{isLoading ? 'Extracting...' : 'Upload Senior Sale PDF'}</Text>
</TouchableOpacity>
```

### 3.3 Create Review Screen

Create `apps/mobile/src/screens/upload/ReviewExtractedItems.tsx`:

Use the code from `PDF_EXTRACTION_INTEGRATION.md` - Step 2

### 3.4 Add Navigation Route

Update your navigation config:

```typescript
// In your navigation setup
import ReviewExtractedItems from '@/screens/upload/ReviewExtractedItems';

<Stack.Screen
  name="ReviewExtractedItems"
  component={ReviewExtractedItems}
  options={{ title: 'Review Extracted Items' }}
/>
```

### 3.5 Update Item Service (if needed)

If you don't have batch creation, add to `apps/mobile/src/services/itemsService.ts`:

```typescript
export async function createBulkItems(items: Item[]): Promise<void> {
  const { error } = await supabase
    .from('items')
    .insert(items);

  if (error) {
    throw new Error(`Failed to create items: ${error.message}`);
  }
}
```

## Phase 4: Testing (10 minutes)

### 4.1 Automated Verification

Run the test script:

```bash
cd projectslge
node scripts/test-pdf-extraction.js
```

Should show:
- ✓ Environment variables configured
- ✓ Sample PDF found
- ✓ Expected extraction results (14 items)

### 4.2 Manual Testing - Web

If you have access to Supabase dashboard:

1. Upload `sample_senior_sale.pdf` to `item-pdfs` bucket
2. Call function via dashboard Functions page
3. Verify response has items array

### 4.3 Manual Testing - Mobile

1. Build and run the mobile app
2. Navigate to upload screen
3. Click "Upload Senior Sale PDF"
4. Select `sample_senior_sale.pdf`
5. Wait for extraction (shows "Extracting...")
6. Review screen should show ~14 items
7. Edit one item to verify functionality
8. Click "Create All Items"
9. Items should appear in your item list

**Expected results:**
- 14 items extracted
- All have titles, descriptions, prices
- ~12 have images
- Categories auto-detected
- Can create successfully

## Phase 5: Deployment to Production

### 5.1 Pre-Production Checklist

- [ ] Storage bucket created (`item-pdfs`)
- [ ] Edge function deployed
- [ ] API keys configured
- [ ] Mobile app code integrated
- [ ] Review screen created
- [ ] Navigation updated
- [ ] Dependencies installed
- [ ] Manual test passed

### 5.2 Deploy Mobile App

```bash
cd apps/mobile

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Or submit to stores
eas submit --platform ios
eas submit --platform android
```

### 5.3 Monitoring

Monitor in production:

1. **Supabase Dashboard**
   - Functions → extractPDF → Logs
   - Storage → item-pdfs (usage)
   - API Keys (quotas)

2. **Mobile Analytics**
   - Track PDF uploads
   - Monitor errors
   - Measure extraction success rate

## Troubleshooting Guide

### PDF Upload Fails

**Symptom:** "Failed to upload PDF" error

**Solutions:**
1. Check bucket exists: `supabase storage list`
2. Check permissions: Verify RLS policies
3. Check file size: Max 10MB by default
4. Check network: Ensure good connectivity

**Code to debug:**
```typescript
const { data, error } = await supabase.storage
  .from('item-pdfs')
  .list();
console.log('Buckets:', data, error);
```

### Extraction Returns Empty

**Symptom:** 0 items extracted from valid PDF

**Solutions:**
1. Verify API key is set:
   ```bash
   supabase secrets list
   ```
2. Check Claude API status
3. Verify PDF has text (not image-only)
4. Check function logs:
   - Supabase Dashboard → Functions → extractPDF → Logs

**Code to debug:**
```typescript
// Call edge function directly
const response = await supabase.functions.invoke('extractPDF', {
  body: { pdfPath: 'test/sample.pdf', userId: 'test' }
});
console.log('Response:', response);
```

### Images Not Uploading

**Symptom:** Items extracted but no images

**Solutions:**
1. Check `item-images` bucket exists
2. Check storage quota
3. Verify network connectivity
4. Check function logs for upload errors

**Verify bucket:**
```bash
supabase storage list
# Should show both: item-pdfs, item-images
```

### Wrong Categories/Conditions

**Symptom:** Items have incorrect category or condition

**This is expected** - Categories are inferred from keywords in the description. Users can edit items in the review screen before creating.

**To improve:**
1. Review → Edit the field
2. Save with correct value
3. (Future: Add Claude vision analysis)

### Function Timeout

**Symptom:** "Request timeout" after 60 seconds

**Solutions:**
1. PDF too large: Try smaller PDFs
2. Claude API slow: Retry the request
3. Check Claude quota/limits
4. Check function logs for bottlenecks

## Performance Expectations

| Operation | Time |
|-----------|------|
| PDF upload (10MB) | 5-15 sec |
| PDF parsing | 2-3 sec |
| Claude processing | 2-5 sec |
| Image uploads | 1-10 sec |
| **Total** | **10-30 sec** |

## Scaling Considerations

For production use:

1. **PDF Size Limits**
   - Current: Works up to 10MB
   - Increase: Configure Supabase bucket limits

2. **Item Count**
   - Optimal: 5-50 items per PDF
   - Large PDFs: May timeout (increase function timeout)

3. **Concurrent Uploads**
   - Mobile: One per user (queued)
   - Backend: Rate limiting via Claude API

4. **Storage**
   - PDFs: ~1-3MB each
   - Item images: ~200KB each
   - Database: Minimal (just metadata)

## Monitoring & Analytics

Track in production:

```typescript
// Add to pdfService.ts
const trackEvent = (eventName: string, data: any) => {
  // Send to analytics service
  console.log(`[PDF] ${eventName}`, data);
};

// Usage
trackEvent('pdf_upload_started', { fileSize });
trackEvent('extraction_completed', { itemCount });
trackEvent('extraction_error', { error });
```

## Rollback Plan

If issues in production:

1. **Disable PDF Feature**
   - Hide PDF picker button
   - Or keep old image upload flow

2. **Fix Edge Function**
   - Update `supabase/functions/extractPDF/index.ts`
   - Redeploy: `supabase functions deploy extractPDF`

3. **Revert Mobile**
   - Remove PDF picker code
   - Rebuild and redeploy

## Success Criteria

✅ System is working if:

- [ ] PDF uploads without errors
- [ ] Edge function processes PDF
- [ ] Items extracted with 80%+ accuracy
- [ ] Images uploaded correctly
- [ ] Review screen displays items
- [ ] Users can edit items
- [ ] Items create successfully
- [ ] Items visible in app
- [ ] No critical errors in logs

## Next Steps After Deploy

1. **Monitor** first week of production
2. **Collect feedback** from users
3. **Track metrics** (upload count, extraction accuracy)
4. **Plan improvements** (image analysis, better categorization)
5. **Scale** if needed (increase limits, optimize)

## Quick Reference Commands

```bash
# List storage buckets
supabase storage list

# Deploy function
supabase functions deploy extractPDF

# View function logs
# (Use Supabase Dashboard → Functions → extractPDF → Logs)

# Test function
curl -X POST https://[project].functions.supabase.co/extractPDF \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [key]" \
  -d '{"pdfPath":"test/sample.pdf","userId":"test"}'

# Check environment variables
supabase secrets list

# Deploy all functions
supabase push --dry-run  # Preview
supabase push             # Deploy
```

## Support Resources

- **Docs**: PDF_EXTRACTION_GUIDE.md
- **Integration**: PDF_EXTRACTION_INTEGRATION.md
- **Summary**: PDF_EXTRACTION_SUMMARY.md
- **Sample PDF**: sample_senior_sale.pdf
- **Test Script**: scripts/test-pdf-extraction.js

## Estimated Timeline

- Setup: 5 min
- Deploy: 5-10 min
- Integration: 20-30 min
- Testing: 10 min
- **Total: ~50-60 minutes**

---

**Ready to proceed? Start with Phase 1!**
