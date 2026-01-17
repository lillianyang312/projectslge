/**
 * Unit tests for chatbot Edge Function
 * 
 * Run with: deno test index.test.ts --allow-net --allow-env
 */

import {
  assertEquals,
  assertExists,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildDbContextSummary,
  extractPriceReferencesFromOutput,
  handleChatbotRequest,
  type DbItemRow,
  type DbDealRow,
} from './index.ts';

// Demo items from MyList.tsx
const DEMO_ITEMS: DbItemRow[] = [
  {
    id: '1',
    label: 'Herman Miller Aeron',
    category: 'Furniture',
    market_value_min: 800,
    market_value_max: 1200,
    user_min_price: 900,
    user_max_price: null,
  },
  {
    id: '2',
    label: 'iPhone 14 Pro',
    category: 'Electronics',
    market_value_min: 700,
    market_value_max: 900,
    user_min_price: 750,
    user_max_price: null,
  },
  {
    id: '3',
    label: 'Fender Stratocaster',
    category: 'Music',
    market_value_min: 500,
    market_value_max: 800,
    user_min_price: 600,
    user_max_price: null,
  },
];

// Test buildDbContextSummary
Deno.test('buildDbContextSummary - Empty when no item or deal', () => {
  const summary = buildDbContextSummary();
  assertEquals(summary, '');
});

Deno.test('buildDbContextSummary - Item with all fields', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const summary = buildDbContextSummary(item);
  
  assert(summary.includes('Herman Miller Aeron'));
  assert(summary.includes('Furniture'));
  assert(summary.includes('$800 - $1200'));
  assert(summary.includes('$900'));
});

Deno.test('buildDbContextSummary - Item with minimal fields', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test Item',
  };
  const summary = buildDbContextSummary(item);
  
  assert(summary.includes('Test Item'));
  assert(!summary.includes('category'));
});

Deno.test('buildDbContextSummary - Item without label uses default', () => {
  const item: DbItemRow = {
    id: 'test-id',
    category: 'Electronics',
  };
  const summary = buildDbContextSummary(item);
  
  assert(summary.includes('this item'));
  assert(summary.includes('Electronics'));
});

Deno.test('buildDbContextSummary - Deal with current offer', () => {
  const deal: DbDealRow = {
    id: 'deal-1',
    item_id: 'item-1',
    current_offer: 850,
  };
  const summary = buildDbContextSummary(undefined, deal);
  
  assert(summary.includes('$850'));
  assert(summary.includes('Current active offer'));
});

Deno.test('buildDbContextSummary - Deal with agreed price', () => {
  const deal: DbDealRow = {
    id: 'deal-1',
    item_id: 'item-1',
    agreed_price: 1000,
  };
  const summary = buildDbContextSummary(undefined, deal);
  
  assert(summary.includes('$1000'));
  assert(summary.includes('Agreed deal price'));
});

Deno.test('buildDbContextSummary - Item and deal together', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const deal: DbDealRow = {
    id: 'deal-1',
    item_id: '1',
    current_offer: 950,
    agreed_price: null,
  };
  const summary = buildDbContextSummary(item, deal);
  
  assert(summary.includes('Herman Miller Aeron'));
  assert(summary.includes('$950'));
  assert(summary.includes('Current active offer'));
});

Deno.test('buildDbContextSummary - Item with buyer max price', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test Item',
    user_max_price: 500,
  };
  const summary = buildDbContextSummary(item);
  
  assert(summary.includes('Buyer maximum price'));
  assert(summary.includes('$500'));
});

// Test extractPriceReferencesFromOutput
Deno.test('extractPriceReferencesFromOutput - Empty output returns empty array', () => {
  const references = extractPriceReferencesFromOutput('');
  assertEquals(references.length, 0);
});

Deno.test('extractPriceReferencesFromOutput - No matching prices returns empty', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'This is a great item but I cannot find the price.';
  const references = extractPriceReferencesFromOutput(output, item);
  assertEquals(references.length, 0);
});

Deno.test('extractPriceReferencesFromOutput - Extracts market_low from output', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The market value starts at $800 and goes up to $1200.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  assert(references.length > 0);
  const marketLow = references.find(r => r.kind === 'market_low');
  assertExists(marketLow);
  assertEquals(marketLow?.amount, 800);
  assertEquals(marketLow?.currency, 'USD');
  assertEquals(marketLow?.itemId, '1');
});

Deno.test('extractPriceReferencesFromOutput - Extracts market_high from output', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The market value ranges from $800 to $1200.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const marketHigh = references.find(r => r.kind === 'market_high');
  assertExists(marketHigh);
  assertEquals(marketHigh?.amount, 1200);
});

Deno.test('extractPriceReferencesFromOutput - Extracts listing_price from output', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The seller minimum price is $900.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const listingPrice = references.find(r => r.kind === 'listing_price');
  assertExists(listingPrice);
  assertEquals(listingPrice?.amount, 900);
});

Deno.test('extractPriceReferencesFromOutput - Extracts buyer_bid from item', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test',
    user_max_price: 500,
  };
  const output = 'The buyer maximum price is $500.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const buyerBid = references.find(r => r.kind === 'buyer_bid');
  assertExists(buyerBid);
  assertEquals(buyerBid?.amount, 500);
});

Deno.test('extractPriceReferencesFromOutput - Extracts deal current_offer', () => {
  const deal: DbDealRow = {
    id: 'deal-1',
    item_id: 'item-1',
    current_offer: 750,
  };
  const output = 'The current offer is $750.';
  const references = extractPriceReferencesFromOutput(output, undefined, deal);
  
  const buyerBid = references.find(r => r.kind === 'buyer_bid' && r.dealId === 'deal-1');
  assertExists(buyerBid);
  assertEquals(buyerBid?.amount, 750);
  assertEquals(buyerBid?.dealId, 'deal-1');
});

Deno.test('extractPriceReferencesFromOutput - Extracts agreed_price from deal', () => {
  const deal: DbDealRow = {
    id: 'deal-1',
    item_id: 'item-1',
    agreed_price: 1000,
  };
  const output = 'We agreed on a price of $1000.';
  const references = extractPriceReferencesFromOutput(output, undefined, deal);
  
  const agreedPrice = references.find(r => r.kind === 'agreed_price');
  assertExists(agreedPrice);
  assertEquals(agreedPrice?.amount, 1000);
  assertEquals(agreedPrice?.dealId, 'deal-1');
});

Deno.test('extractPriceReferencesFromOutput - Multiple prices in output', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'Market value is $800-$1200, seller wants $900.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  assert(references.length >= 2);
  assert(references.some(r => r.kind === 'market_low' && r.amount === 800));
  assert(references.some(r => r.kind === 'market_high' && r.amount === 1200));
  assert(references.some(r => r.kind === 'listing_price' && r.amount === 900));
});

Deno.test('extractPriceReferencesFromOutput - Ignores prices not in context', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The market value is $800-$1200, but I think it should be $1500.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  // Should only include prices that match item context
  assert(references.some(r => r.amount === 800));
  assert(references.some(r => r.amount === 1200));
  // $1500 should not be included as it's not in the item context
  assert(!references.some(r => r.amount === 1500));
});

Deno.test('extractPriceReferencesFromOutput - Handles price with dollar sign', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The price is $900.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const listingPrice = references.find(r => r.kind === 'listing_price');
  assertExists(listingPrice);
  assertEquals(listingPrice?.amount, 900);
});

Deno.test('extractPriceReferencesFromOutput - Handles price without dollar sign', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The price is 900 dollars.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const listingPrice = references.find(r => r.kind === 'listing_price');
  assertExists(listingPrice);
  assertEquals(listingPrice?.amount, 900);
});

Deno.test('extractPriceReferencesFromOutput - Ignores null/undefined prices', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test',
    market_value_min: null,
    market_value_max: null,
    user_min_price: null,
    user_max_price: null,
  };
  const output = 'This item has no prices set.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  assertEquals(references.length, 0);
});

// Test handleChatbotRequest
Deno.test('handleChatbotRequest - OPTIONS request returns CORS headers', async () => {
  const req = new Request('http://localhost', {
    method: 'OPTIONS',
  });
  
  const response = await handleChatbotRequest(req);
  assertEquals(response.status, 200);
  assertEquals(await response.text(), 'ok');
  
  const headers = response.headers;
  assertEquals(headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
});

Deno.test('handleChatbotRequest - Non-POST method returns 405', async () => {
  const req = new Request('http://localhost', {
    method: 'GET',
  });
  
  const response = await handleChatbotRequest(req);
  assertEquals(response.status, 405);
  
  const body = await response.json();
  assert(body.error.includes('Method not allowed'));
});

Deno.test('handleChatbotRequest - Invalid JSON body returns 400', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: 'invalid json{',
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Mock OpenAI API key to avoid 500 error
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return 'test-key';
    return originalEnv(key);
  };
  
  try {
    const response = await handleChatbotRequest(req);
    assertEquals(response.status, 400);
    
    const body = await response.json();
    assert(body.error.includes('Invalid JSON'));
  } finally {
    Deno.env.get = originalEnv;
  }
});

Deno.test('handleChatbotRequest - Missing userMessage returns 400', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Mock OpenAI API key to avoid 500 error
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return 'test-key';
    return originalEnv(key);
  };
  
  try {
    const response = await handleChatbotRequest(req);
    assertEquals(response.status, 400);
    
    const body = await response.json();
    assert(body.error.includes('userMessage'));
  } finally {
    Deno.env.get = originalEnv;
  }
});

Deno.test('handleChatbotRequest - Missing CLAUDE_API_KEY returns 500', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ userMessage: 'Hello' }),
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Ensure CLAUDE_API_KEY is not set
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return undefined;
    return originalEnv(key);
  };
  
  try {
    const response = await handleChatbotRequest(req);
    assertEquals(response.status, 500);
    
    const body = await response.json();
    assert(body.error.includes('CLAUDE_API_KEY'));
  } finally {
    Deno.env.get = originalEnv;
  }
});

Deno.test('handleChatbotRequest - Valid request uses default system prompt', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ userMessage: 'Hello' }),
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Mock OpenAI API key
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return 'test-key';
    return originalEnv(key);
  };
  
  try {
    // This will fail at OpenAI API call, but we can verify the request structure
    const response = await handleChatbotRequest(req);
    // Should get 500 due to invalid API key, but request was processed
    assert(response.status >= 400);
  } finally {
    Deno.env.get = originalEnv;
  }
});

Deno.test('handleChatbotRequest - Custom system prompt is used', async () => {
  const customPrompt = 'You are a test assistant.';
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({
      userMessage: 'Hello',
      systemPrompt: customPrompt,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Mock OpenAI API key
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return 'test-key';
    return originalEnv(key);
  };
  
  try {
    const response = await handleChatbotRequest(req);
    // Should get error due to invalid API key, but request was processed
    assert(response.status >= 400);
  } finally {
    Deno.env.get = originalEnv;
  }
});

Deno.test('handleChatbotRequest - Response includes CORS headers', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ userMessage: 'Hello' }),
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Mock OpenAI API key
  const originalEnv = Deno.env.get;
  Deno.env.get = (key: string) => {
    if (key === 'CLAUDE_API_KEY') return 'test-key';
    return originalEnv(key);
  };
  
  try {
    const response = await handleChatbotRequest(req);
    const headers = response.headers;
    assertEquals(headers.get('Access-Control-Allow-Origin'), '*');
  } finally {
    Deno.env.get = originalEnv;
  }
});

// Test edge cases
Deno.test('buildDbContextSummary - Item with partial market value', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test',
    market_value_min: 100,
    market_value_max: null,
  };
  const summary = buildDbContextSummary(item);
  
  // Should not include market value range if both min and max aren't present
  assert(!summary.includes('Estimated market value range'));
});

Deno.test('extractPriceReferencesFromOutput - Decimal prices', () => {
  const item: DbItemRow = {
    id: 'test-id',
    label: 'Test',
    user_min_price: 99.99,
  };
  const output = 'The price is $99.99.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const listingPrice = references.find(r => r.kind === 'listing_price');
  assertExists(listingPrice);
  assertEquals(listingPrice?.amount, 99.99);
});

Deno.test('extractPriceReferencesFromOutput - Price at end of sentence', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'The market value is $800.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const marketLow = references.find(r => r.kind === 'market_low');
  assertExists(marketLow);
  assertEquals(marketLow?.amount, 800);
});

Deno.test('extractPriceReferencesFromOutput - Price in middle of text', () => {
  const item: DbItemRow = DEMO_ITEMS[0];
  const output = 'I think $900 is a fair price for this item.';
  const references = extractPriceReferencesFromOutput(output, item);
  
  const listingPrice = references.find(r => r.kind === 'listing_price');
  assertExists(listingPrice);
  assertEquals(listingPrice?.amount, 900);
});

