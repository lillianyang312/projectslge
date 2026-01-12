# analyzeImage Edge Function

This edge function analyzes images and returns structured item identification results using a confidence-based approach.

## Response Format

The function returns a `ClarificationResponse` matching the schema defined in `apps/mobile/src/schemas/clarification_schema.ts`:

### High Confidence (≥0.85)
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

### Medium Confidence (0.60-0.84)
```json
{
  "type": "needs_clarification",
  "question": "Which item matches your photo?",
  "options": [
    {
      "id": "option-1",
      "label": "Furniture",
      "descriptor": "A furniture item that matches your photo"
    },
    {
      "id": "option-2",
      "label": "Electronics",
      "descriptor": "An electronics item that matches your photo"
    }
  ],
  "confidence": 0.72
}
```

### Low Confidence (<0.60)
```json
{
  "type": "needs_clarification",
  "question": "What type of item is this? (e.g., furniture, electronics, clothing)",
  "options": [],
  "confidence": 0.35
}
```

## Confidence Thresholds

- **High**: ≥0.85 → Returns `identified` response
- **Medium**: 0.60-0.84 → Returns `needs_clarification` with options
- **Low**: <0.60 → Returns `needs_clarification` with empty options

These thresholds match `clarification_schema.ts` and `clarification_rules.yaml`.

## Request Format

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "imagePath": "user-123/1234567890.jpg"
}
```

## Testing

### Unit Tests

Run unit tests with Deno:

```bash
cd supabase/functions/analyzeImage
deno test index.test.ts
```

### Integration Tests

The edge function is tested as part of the Supabase smoke test:

```bash
npx tsx scripts/supabase_smoke_test.ts
```

## Current Implementation

This function currently uses a **stub implementation** that:
- Generates random confidence scores
- Returns sample data based on confidence thresholds
- Validates responses against the schema

**Next Steps**: Replace `analyzeImageStub` with actual LLM integration (see Phase 2 in `docs/Image-pipeline.md`).

## Validation

All responses are validated against the `ClarificationResponse` schema before being returned. Invalid responses return a 500 error with validation details.

