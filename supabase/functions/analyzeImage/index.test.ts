/**
 * Unit tests for analyzeImage Edge Function
 * 
 * Run with: deno test index.test.ts --allow-net
 */

import {
  assertEquals,
  assertExists,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  getConfidenceLevel,
  validateClarificationResponse,
  analyzeImageStub,
  type ClarificationResponse,
  type IdentifiedResponse,
  type NeedsClarificationResponse,
} from './index.ts';

// Test confidence level categorization
Deno.test('getConfidenceLevel - High confidence (≥0.85)', () => {
  assertEquals(getConfidenceLevel(0.85), 'high');
  assertEquals(getConfidenceLevel(0.90), 'high');
  assertEquals(getConfidenceLevel(1.0), 'high');
  assertEquals(getConfidenceLevel(0.95), 'high');
});

Deno.test('getConfidenceLevel - Medium confidence (0.60-0.84)', () => {
  assertEquals(getConfidenceLevel(0.60), 'medium');
  assertEquals(getConfidenceLevel(0.70), 'medium');
  assertEquals(getConfidenceLevel(0.84), 'medium');
  assertEquals(getConfidenceLevel(0.75), 'medium');
});

Deno.test('getConfidenceLevel - Low confidence (<0.60)', () => {
  assertEquals(getConfidenceLevel(0.59), 'low');
  assertEquals(getConfidenceLevel(0.50), 'low');
  assertEquals(getConfidenceLevel(0.30), 'low');
  assertEquals(getConfidenceLevel(0.0), 'low');
});

// Test response validation
Deno.test('validateClarificationResponse - Valid identified response', () => {
  const response: IdentifiedResponse = {
    type: 'identified',
    item: {
      title: 'Test Item',
      category: 'Electronics',
      description: 'A test item',
      condition: 'Good',
      tags: ['test', 'item'],
    },
    confidence: 0.90,
  };

  const result = validateClarificationResponse(response);
  assert(result.valid, 'Response should be valid');
  assertEquals(result.errors.length, 0);
});

Deno.test('validateClarificationResponse - Valid needs_clarification with options', () => {
  const response: NeedsClarificationResponse = {
    type: 'needs_clarification',
    question: 'Which item is this?',
    options: [
      {
        id: 'option-1',
        label: 'Option 1',
        descriptor: 'First option',
      },
      {
        id: 'option-2',
        label: 'Option 2',
        descriptor: 'Second option',
        thumbnail: 'https://example.com/image.jpg',
      },
    ],
    confidence: 0.70,
  };

  const result = validateClarificationResponse(response);
  assert(result.valid, 'Response should be valid');
  assertEquals(result.errors.length, 0);
});

Deno.test('validateClarificationResponse - Valid needs_clarification with empty options', () => {
  const response: NeedsClarificationResponse = {
    type: 'needs_clarification',
    question: 'What type of item is this?',
    options: [],
    confidence: 0.40,
  };

  const result = validateClarificationResponse(response);
  assert(result.valid, 'Response should be valid');
  assertEquals(result.errors.length, 0);
});

Deno.test('validateClarificationResponse - Invalid: missing type', () => {
  const response = {
    item: { title: 'Test', category: 'Test' },
    confidence: 0.90,
  } as any;

  const result = validateClarificationResponse(response);
  assert(!result.valid, 'Response should be invalid');
  assert(result.errors.length > 0);
});

Deno.test('validateClarificationResponse - Invalid: confidence out of range', () => {
  const response: IdentifiedResponse = {
    type: 'identified',
    item: {
      title: 'Test Item',
      category: 'Electronics',
    },
    confidence: 1.5, // Invalid: > 1.0
  };

  const result = validateClarificationResponse(response);
  assert(!result.valid, 'Response should be invalid');
  assert(result.errors.some((e) => e.includes('Confidence')));
});

Deno.test('validateClarificationResponse - Invalid: missing item title', () => {
  const response = {
    type: 'identified',
    item: {
      category: 'Electronics',
    },
    confidence: 0.90,
  } as any;

  const result = validateClarificationResponse(response);
  assert(!result.valid, 'Response should be invalid');
  assert(result.errors.some((e) => e.includes('title')));
});

Deno.test('validateClarificationResponse - Invalid: missing question', () => {
  const response = {
    type: 'needs_clarification',
    options: [],
    confidence: 0.40,
    // question is missing
  } as any;

  const result = validateClarificationResponse(response);
  assert(!result.valid, 'Response should be invalid');
  assert(
    result.errors.some((e) => e.toLowerCase().includes('question')),
    `Expected error about question, got: ${result.errors.join(', ')}`
  );
});

Deno.test('validateClarificationResponse - Invalid: option missing descriptor', () => {
  const response = {
    type: 'needs_clarification',
    question: 'Which item?',
    options: [
      {
        id: 'option-1',
        label: 'Option 1',
        // Missing descriptor
      },
    ],
    confidence: 0.70,
  } as any;

  const result = validateClarificationResponse(response);
  assert(!result.valid, 'Response should be invalid');
  assert(result.errors.some((e) => e.includes('descriptor')));
});

// Test analyzeImageStub with controlled confidence values
Deno.test('analyzeImageStub - Returns valid response format', () => {
  // We can't control Math.random(), but we can verify the response structure
  // Run multiple times to test different confidence levels
  for (let i = 0; i < 10; i++) {
    const response = analyzeImageStub('https://example.com/image.jpg');
    
    // Verify it's a valid ClarificationResponse
    assert(
      response.type === 'identified' || response.type === 'needs_clarification',
      'Response must have valid type'
    );
    assertExists(response.confidence);
    assert(response.confidence >= 0 && response.confidence <= 1, 'Confidence must be in [0, 1]');
    
    // Validate the response
    const validation = validateClarificationResponse(response);
    assert(validation.valid, `Response should be valid: ${validation.errors.join(', ')}`);
  }
});

// Test that stub respects confidence thresholds
Deno.test('analyzeImageStub - High confidence returns identified', () => {
  // Mock Math.random to return high confidence
  const originalRandom = Math.random;
  let callCount = 0;
  Math.random = () => {
    callCount++;
    // Return 0.9 for confidence (high)
    if (callCount === 1) return 0.9;
    // Return random category index using original function
    return originalRandom();
  };

  try {
    const response = analyzeImageStub('https://example.com/image.jpg');
    assertEquals(response.type, 'identified');
    assert(response.confidence >= 0.85);
    assertExists((response as IdentifiedResponse).item);
    assertExists((response as IdentifiedResponse).item.title);
    assertExists((response as IdentifiedResponse).item.category);
  } finally {
    Math.random = originalRandom;
  }
});

Deno.test('analyzeImageStub - Medium confidence returns needs_clarification with options', () => {
  // Mock Math.random to return medium confidence
  const originalRandom = Math.random;
  let callCount = 0;
  Math.random = () => {
    callCount++;
    // Return 0.7 for confidence (medium)
    if (callCount === 1) return 0.7;
    // Return random category index using original function
    return originalRandom();
  };

  try {
    const response = analyzeImageStub('https://example.com/image.jpg');
    assertEquals(response.type, 'needs_clarification');
    assert(response.confidence >= 0.60 && response.confidence < 0.85);
    const needsClarification = response as NeedsClarificationResponse;
    assertExists(needsClarification.question);
    assert(needsClarification.options.length > 0, 'Medium confidence should have options');
    needsClarification.options.forEach((option) => {
      assertExists(option.id);
      assertExists(option.label);
      assertExists(option.descriptor);
    });
  } finally {
    Math.random = originalRandom;
  }
});

Deno.test('analyzeImageStub - Low confidence returns needs_clarification with empty options', () => {
  // Mock Math.random to return low confidence
  const originalRandom = Math.random;
  let callCount = 0;
  Math.random = () => {
    callCount++;
    // Return 0.4 for confidence (low)
    if (callCount === 1) return 0.4;
    // Return random category index using original function
    return originalRandom();
  };

  try {
    const response = analyzeImageStub('https://example.com/image.jpg');
    assertEquals(response.type, 'needs_clarification');
    assert(response.confidence < 0.60);
    const needsClarification = response as NeedsClarificationResponse;
    assertExists(needsClarification.question);
    assertEquals(needsClarification.options.length, 0, 'Low confidence should have empty options');
  } finally {
    Math.random = originalRandom;
  }
});

// Test edge cases
Deno.test('validateClarificationResponse - Boundary values', () => {
  // Test exactly at thresholds
  const highResponse: IdentifiedResponse = {
    type: 'identified',
    item: { title: 'Test', category: 'Test' },
    confidence: 0.85, // Exactly at high threshold
  };
  assert(validateClarificationResponse(highResponse).valid);

  const mediumResponse: NeedsClarificationResponse = {
    type: 'needs_clarification',
    question: 'Test',
    options: [{ id: '1', label: 'Test', descriptor: 'Test' }],
    confidence: 0.60, // Exactly at medium threshold
  };
  assert(validateClarificationResponse(mediumResponse).valid);

  const lowResponse: NeedsClarificationResponse = {
    type: 'needs_clarification',
    question: 'Test',
    options: [],
    confidence: 0.59, // Just below medium threshold
  };
  assert(validateClarificationResponse(lowResponse).valid);
});

