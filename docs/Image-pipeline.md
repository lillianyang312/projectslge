# Image Identification Pipeline

## Overview

This document outlines the complete integration plan for the photo → LLM → structured output pipeline. The system uses a confidence-based approach to identify items from photos, with three distinct behaviors based on confidence thresholds defined in `clarification_rules.yaml`.

## Architecture

```
Mobile App (React Native/Expo)
    ↓ [1. Photo Selection]
    ↓ [2. Upload to Supabase Storage]
    ↓ [3. Get Signed URL]
    ↓ [4. Call analyzeImage Edge Function]
Supabase Edge Function (analyzeImage)
    ↓ [5. Multi-Modal LLM Analysis]
    ↓ [6. Compute Confidence Score]
    ↓ [7. Return ClarificationResponse]
Mobile App
    ↓ [8. Handle Response Based on Confidence]
    ├─ High (≥0.85): Pre-fill form with suggestions
    ├─ Medium (0.60-0.84): Show options for selection
    └─ Low (<0.60): Ask targeted question → Loop back to [4]
```

## Current State

### ✅ What's Already Implemented

1. **Mobile App Foundation**
   - Photo upload flow (`UploadScreen`, `ItemDetails`)
   - Image upload service (`imageService.ts`)
   - Supabase integration
   - Clarification schema types (`clarification_schema.ts`)
   - Clarification screen UI (`ClarificationScreen.tsx`)
   - Draft state management (`itemsStore.ts`)

2. **Backend Foundation**
   - Supabase Storage bucket (`item-images`)
   - Edge function skeleton (`analyzeImage/index.ts`)
   - Database schema for items

3. **Schema & Rules**
   - Confidence thresholds defined
   - TypeScript types for all response formats
   - Validation functions
   - YAML rules documentation

### ❌ What's Missing

1. **Edge Function**
   - ❌ Returns old format (`mode: 'final' | 'clarify'`) instead of `ClarificationResponse`
   - ❌ No actual LLM integration (stub implementation)
   - ❌ Doesn't follow confidence thresholds from `clarification_rules.yaml`
   - ❌ No iterative clarification loop support

2. **Mobile App Integration**
   - ❌ Uses old `AnalyzeImageResponse` type instead of `ClarificationResponse`
   - ❌ Incomplete conversion from old format to new format
   - ❌ No iterative clarification loop implementation
   - ❌ Clarification screen shows demo data, not real responses

3. **LLM Integration**
   - ❌ No multi-modal LLM configured
   - ❌ No prompt engineering for item identification
   - ❌ No confidence score computation

## Implementation Plan

### Phase 1: Update Edge Function Response Format

**Goal**: Make edge function return proper `ClarificationResponse` format

**Files to Update**:
- `supabase/functions/analyzeImage/index.ts`

**Changes**:
1. Import or define `ClarificationResponse` types matching `clarification_schema.ts`
2. Replace `AnalyzeImageResponse` with `ClarificationResponse`
3. Update response structure:
   ```typescript
   // OLD (current)
   {
     mode: 'final' | 'clarify',
     confidence: number,
     label: string,
     clarification?: ClarificationData
   }
   
   // NEW (target)
   ClarificationResponse = 
     | { type: 'identified', item: IdentifiedItem, confidence: number }
     | { type: 'needs_clarification', question: string, options: ClarificationOption[], confidence: number }
   ```
4. Use confidence thresholds from rules:
   - High: ≥0.85 → `type: 'identified'`
   - Medium: 0.60-0.84 → `type: 'needs_clarification'` with options
   - Low: <0.60 → `type: 'needs_clarification'` with empty options

**Acceptance Criteria**:
- [ ] Edge function returns `ClarificationResponse` format
- [ ] Response validated against `clarification_schema.ts` types
- [ ] Confidence thresholds match `clarification_rules.yaml`

---

### Phase 2: Integrate Multi-Modal LLM

**Goal**: Replace stub with actual LLM that analyzes images and returns structured output

**Options for LLM Integration**:

#### Option A: OpenAI GPT-4 Vision (Recommended)
- **Pros**: Excellent image understanding, structured output support, reliable API
- **Cons**: Cost per request, requires API key
- **Implementation**: Use OpenAI SDK with vision capabilities

#### Option B: Anthropic Claude 3 (with Vision)
- **Pros**: Strong reasoning, good structured output
- **Cons**: May have different API structure
- **Implementation**: Use Anthropic SDK

#### Option C: Google Gemini Vision
- **Pros**: Competitive pricing, good performance
- **Cons**: Less mature than OpenAI
- **Implementation**: Use Google AI SDK

**Recommended: OpenAI GPT-4 Vision**

**Files to Update**:
- `supabase/functions/analyzeImage/index.ts`

**Implementation Steps**:

1. **Add OpenAI SDK**:
   ```typescript
   // In deno.json or package.json for edge function
   {
     "imports": {
       "openai": "npm:openai@^4.0.0"
     }
   }
   ```

2. **Create LLM Analysis Function**:
   ```typescript
   async function analyzeImageWithLLM(imageUrl: string): Promise<ClarificationResponse> {
     const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
     
     // Load clarification rules prompt
     const prompt = await loadClarificationPrompt();
     
     const response = await openai.chat.completions.create({
       model: 'gpt-4-vision-preview', // or 'gpt-4o' when available
       messages: [
         {
           role: 'system',
           content: prompt // From clarification_rules.yaml
         },
         {
           role: 'user',
           content: [
             { type: 'text', text: 'Analyze this image and identify the item...' },
             { type: 'image_url', image_url: { url: imageUrl } }
           ]
         }
       ],
       response_format: { type: 'json_object' }, // Force JSON output
       temperature: 0.3, // Lower for more consistent results
     });
     
     // Parse and validate response
     const jsonResponse = JSON.parse(response.choices[0].message.content);
     return validateAndNormalizeResponse(jsonResponse);
   }
   ```

3. **Prompt Engineering**:
   - Load `clarification_rules.yaml` content
   - Convert to system prompt
   - Include instructions for:
     - Computing confidence scores
     - Returning proper schema format
     - Generating options for medium confidence
     - Asking targeted questions for low confidence

4. **Confidence Score Computation**:
   - LLM should return confidence as part of structured output
   - Can also compute from model logits/probabilities if available
   - Validate confidence is in [0.0, 1.0] range

5. **Environment Variables**:
   ```bash
   # Set in Supabase dashboard or via CLI
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

**Acceptance Criteria**:
- [ ] LLM successfully analyzes images
- [ ] Returns valid `ClarificationResponse` format
- [ ] Confidence scores are reasonable and match thresholds
- [ ] Structured output is consistent

---

### Phase 3: Update Mobile App to Use New Format

**Goal**: Update mobile app to consume `ClarificationResponse` directly

**Files to Update**:
- `apps/mobile/src/types/analyzeImage.ts` - Remove or deprecate
- `apps/mobile/src/services/imageService.ts` - Update return type
- `apps/mobile/src/screens/upload/ItemDetails.tsx` - Handle new format
- `apps/mobile/src/screens/ClarificationScreen.tsx` - Use real data

**Changes**:

1. **Update `imageService.ts`**:
   ```typescript
   import { ClarificationResponse } from '../schemas/clarification_schema';
   
   export async function analyzeImage(
     imageUrl: string,
     imagePath: string
   ): Promise<ClarificationResponse | null> {
     // ... existing code ...
     const { data, error } = await supabase.functions.invoke<ClarificationResponse>(
       'analyzeImage',
       { body: { imageUrl, imagePath } }
     );
     // ... validate response ...
     return data;
   }
   ```

2. **Update `ItemDetails.tsx`**:
   ```typescript
   // Replace old format handling with new format
   if (analysisResult) {
     if (isIdentifiedResponse(analysisResult)) {
       // High confidence - pre-fill form
       setTitle(analysisResult.item.title);
       setCategory(analysisResult.item.category);
       // ... set other fields from analysisResult.item
     } else if (isNeedsClarificationResponse(analysisResult)) {
       // Medium or low confidence - navigate to clarification
       updateDraft({ clarificationResponse: analysisResult });
       navigation.navigate('Clarification');
     }
   }
   ```

3. **Update `ClarificationScreen.tsx`**:
   - Remove demo data logic
   - Use `draft.clarificationResponse` directly
   - Handle option selection
   - Handle text input for low confidence questions
   - Implement iteration loop

**Acceptance Criteria**:
- [ ] Mobile app uses `ClarificationResponse` type
- [ ] High confidence responses pre-fill form correctly
- [ ] Medium confidence shows options for selection
- [ ] Low confidence shows question input

---

### Phase 4: Implement Iterative Clarification Loop

**Goal**: Support multiple rounds of clarification when confidence is low

**Flow**:
1. Initial analysis → Low confidence → Ask question
2. User responds → Re-analyze with context → Check confidence
3. Repeat until high/medium confidence or max iterations (3)

**Files to Update**:
- `apps/mobile/src/screens/ClarificationScreen.tsx`
- `supabase/functions/analyzeImage/index.ts` - Add context parameter

**Implementation**:

1. **Update Edge Function**:
   ```typescript
   interface AnalyzeImageRequest {
     imageUrl: string;
     imagePath: string;
     clarificationContext?: {
       iteration: number;
       previousQuestion?: string;
       userResponse?: string;
       previousOptions?: ClarificationOption[];
     };
   }
   ```

2. **Update Clarification Screen**:
   ```typescript
   const [iteration, setIteration] = useState(0);
   const [userResponse, setUserResponse] = useState('');
   
   const handleClarificationResponse = async (response: string) => {
     if (iteration >= MAX_CLARIFICATION_ITERATIONS) {
       // Fallback to manual entry
       navigation.navigate('ItemDetails');
       return;
     }
     
     // Re-analyze with user response
     const newResult = await analyzeImageWithContext(
       signedUrl,
       imagePath,
       {
         iteration: iteration + 1,
         previousQuestion: clarificationResponse.question,
         userResponse: response,
       }
     );
     
     if (isIdentifiedResponse(newResult)) {
       // Success! Navigate to form with pre-filled data
       updateDraft({ clarificationResponse: newResult });
       navigation.navigate('ItemDetails');
     } else {
       // Still needs clarification
       setIteration(iteration + 1);
       updateDraft({ clarificationResponse: newResult });
     }
   };
   ```

3. **Update LLM Prompt with Context**:
   - Include previous question and user response in prompt
   - Instruct LLM to refine identification based on context
   - Track iteration count to avoid infinite loops

**Acceptance Criteria**:
- [ ] Iterative clarification works for low confidence cases
- [ ] Max iterations enforced (3)
- [ ] Context properly passed to LLM
- [ ] User can see progress through iterations

---

### Phase 5: Handle Medium Confidence Options

**Goal**: Allow users to select from options when confidence is medium

**Files to Update**:
- `apps/mobile/src/screens/ClarificationScreen.tsx`

**Implementation**:

```typescript
const handleOptionSelect = async (option: ClarificationOption) => {
  // Treat selected option as high confidence
  const identifiedResponse: IdentifiedResponse = {
    type: 'identified',
    item: {
      title: option.label,
      category: extractCategoryFromOption(option), // Or from descriptor
      description: option.descriptor,
    },
    confidence: 0.90, // High confidence after user selection
  };
  
  updateDraft({ clarificationResponse: identifiedResponse });
  navigation.navigate('ItemDetails');
};
```

**UI Requirements**:
- Display options as selectable cards
- Show thumbnails if available
- Show descriptors
- Handle "None of the above" option (if included)

**Acceptance Criteria**:
- [ ] Options displayed clearly
- [ ] Selection updates draft correctly
- [ ] Navigation to form works after selection

---

### Phase 6: Error Handling & Edge Cases

**Goal**: Handle failures gracefully

**Scenarios to Handle**:
1. LLM API failure → Fallback to manual entry
2. Invalid response format → Validate and show error
3. Network timeout → Retry or fallback
4. Image too large → Resize before upload
5. Unsupported image format → Convert or reject

**Files to Update**:
- `apps/mobile/src/services/imageService.ts`
- `apps/mobile/src/screens/upload/ItemDetails.tsx`
- `supabase/functions/analyzeImage/index.ts`

**Implementation**:
- Wrap LLM calls in try-catch
- Validate responses with `validateClarificationResponseSafe`
- Show user-friendly error messages
- Always allow manual entry as fallback

**Acceptance Criteria**:
- [ ] Errors don't crash the app
- [ ] Users can always enter details manually
- [ ] Error messages are clear

---

## Testing Strategy

### Unit Tests
- [ ] Test confidence threshold categorization
- [ ] Test response validation
- [ ] Test type guards (`isIdentifiedResponse`, etc.)

### Integration Tests
- [ ] Test full flow: Upload → Analyze → Response
- [ ] Test iterative clarification loop
- [ ] Test option selection flow
- [ ] Test error handling

### Manual Testing Checklist
- [ ] High confidence item (clear photo) → Pre-fills correctly
- [ ] Medium confidence item → Shows options → Selection works
- [ ] Low confidence item → Asks question → Iteration works
- [ ] Max iterations reached → Falls back to manual entry
- [ ] Network failure → Graceful fallback
- [ ] Invalid image → Error handling works

---

## Environment Setup

### Supabase Edge Function

1. **Set Environment Variables**:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-key-here
   ```

2. **Deploy Function**:
   ```bash
   supabase functions deploy analyzeImage
   ```

### Mobile App

1. **Environment Variables** (already configured):
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```

2. **No additional setup needed** (uses existing Supabase client)

---

## Cost Considerations

### OpenAI API Costs (GPT-4 Vision)
- **Input**: ~$0.01 per image (varies by resolution)
- **Output**: ~$0.03 per 1K tokens
- **Estimated**: $0.01-0.05 per identification request

### Optimization Strategies
1. **Image Compression**: Resize images before upload (target: <1MB)
2. **Caching**: Cache results for similar images
3. **Model Selection**: Use GPT-4o instead of GPT-4 Vision when available (cheaper)
4. **Batch Processing**: Group multiple images in one request when possible

---

## Future Enhancements

1. **Image Preprocessing**
   - Auto-rotate based on EXIF data
   - Enhance brightness/contrast
   - Remove background (optional)

2. **Confidence Calibration**
   - Track actual accuracy vs. predicted confidence
   - Adjust thresholds based on real data
   - A/B test different threshold values

3. **Multi-Image Support**
   - Analyze multiple photos of same item
   - Combine insights from different angles
   - Higher confidence with more photos

4. **Category-Specific Models**
   - Fine-tuned models for specific categories (furniture, electronics, etc.)
   - Faster and cheaper for common items

5. **Offline Support**
   - Cache common identifications
   - Use device ML models for basic categorization

---

## Dependencies

### Supabase Edge Function
- `openai` (or alternative LLM SDK)
- `@supabase/supabase-js` (for storage access if needed)

### Mobile App
- Already has all required dependencies
- No new packages needed

---

## Related Documentation

- `apps/docs/prompts/clarification_rules.yaml` - Confidence rules and thresholds
- `apps/mobile/src/schemas/clarification_schema.ts` - TypeScript types
- `docs/ai_pipeline.md` - General AI pipeline overview (may need updates)

---

## Implementation Order

1. **Phase 1** (Update response format) - 2-3 hours
2. **Phase 2** (LLM integration) - 4-6 hours
3. **Phase 3** (Mobile app updates) - 3-4 hours
4. **Phase 4** (Iterative loop) - 3-4 hours
5. **Phase 5** (Options handling) - 2-3 hours
6. **Phase 6** (Error handling) - 2-3 hours

**Total Estimated Time**: 16-23 hours

---

## Success Metrics

- **Accuracy**: >85% of high confidence identifications are correct
- **User Satisfaction**: <20% of users need to manually correct high confidence suggestions
- **Clarification Efficiency**: Average <2 iterations to reach high confidence
- **Error Rate**: <5% of requests fail completely
- **Response Time**: <5 seconds for initial analysis

---

## Notes

- The system should always allow manual entry as a fallback
- Confidence thresholds can be adjusted based on production data
- Consider implementing analytics to track confidence vs. accuracy
- The clarification loop should feel conversational, not interrogative

