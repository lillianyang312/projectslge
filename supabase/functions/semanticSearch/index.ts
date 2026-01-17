// @deno-types="npm:@anthropic-ai/sdk"
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Deno global is available in Supabase Edge Functions runtime
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

/**
 * Semantic Search Edge Function
 *
 * Uses Claude to understand natural language search queries and match them
 * against item descriptions, categories, and attributes.
 */

export interface SearchRequest {
  query: string;
  limit?: number;
  excludeUserId?: string; // Exclude items owned by this user
}

export interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  priceMin: number;
  priceMax: number;
  emoji: string;
  photos: string[];
  relevanceScore: number;
  matchReason: string;
  dealStatus?: 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled' | null;
}

export interface SearchResponse {
  results: SearchResultItem[];
  interpretation: string;
  suggestedCategories: string[];
}

// Category to emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  'Electronics': '📱',
  'Furniture': '🪑',
  'Clothing': '👕',
  'Books': '📚',
  'Sports': '⚽',
  'Sports & Outdoors': '🚴',
  'Music': '🎸',
  'Art': '🎨',
  'Kitchen': '🍳',
  'Home': '🏠',
  'Office': '💼',
  'Games': '🎮',
  'Other': '📦',
};

function getEmojiForCategory(category: string): string {
  return CATEGORY_EMOJI[category] || '📦';
}

// Helper function to fetch items from Supabase
async function fetchItemsFromDatabase(excludeUserId?: string): Promise<SearchResultItem[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ [semanticSearch] Missing Supabase env vars");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch items
  let itemQuery = supabase
    .from('items')
    .select('id, title, category, condition, photos, estimated_value_min, estimated_value_max, owner_id')
    .order('created_at', { ascending: false });

  // Exclude user's own items if userId provided
  if (excludeUserId) {
    itemQuery = itemQuery.neq('owner_id', excludeUserId);
  }

  const { data: items, error: itemError } = await itemQuery;

  if (itemError) {
    console.error("❌ [semanticSearch] Error fetching items:", itemError);
    return [];
  }

  console.log(`📦 [semanticSearch] Fetched ${items?.length || 0} items from database`);

  // Fetch active deals for these items to show pending status
  const itemIds = (items || []).map(i => i.id);
  let dealStatusMap: Record<string, string> = {};

  if (itemIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('item_id, status')
      .in('item_id', itemIds)
      .not('status', 'in', '("completed","cancelled")');

    if (deals) {
      dealStatusMap = deals.reduce((acc, deal) => {
        // Only track the first active deal per item
        if (!acc[deal.item_id]) {
          acc[deal.item_id] = deal.status;
        }
        return acc;
      }, {} as Record<string, string>);
    }
  }

  return (items || []).map(item => ({
    id: item.id,
    title: item.title || 'Untitled Item',
    category: item.category || 'Other',
    description: `${item.condition || 'Good'} condition`,
    price: item.estimated_value_min || item.estimated_value_max || 0,
    priceMin: item.estimated_value_min || 0,
    priceMax: item.estimated_value_max || 0,
    emoji: getEmojiForCategory(item.category || 'Other'),
    photos: item.photos || [],
    relevanceScore: 0,
    matchReason: '',
    dealStatus: dealStatusMap[item.id] as SearchResultItem['dealStatus'] || null,
  }));
}

const SEARCH_SYSTEM_PROMPT = `You are a semantic search assistant for a marketplace app. Your job is to understand user search queries and match them to relevant items.

Given a search query, you need to:
1. Understand the user's intent (what they're looking for)
2. Consider synonyms, related terms, and contextual meaning
3. Match items based on semantic relevance, not just keyword matching
4. Explain why each item matches

For example:
- "something to sit on" should match sofas, chairs, etc.
- "work from home setup" should match monitors, chairs, desks
- "gift for music lover" should match instruments, headphones, etc.
- "outdoor activities" should match bikes, sports equipment
- "tech stuff" should match electronics

You will receive a JSON array of items and a search query. Return a JSON response with:
1. Matched item IDs with relevance scores (0-100) and match reasons
2. Your interpretation of what the user is looking for
3. Suggested categories they might be interested in

Be generous with matching - if there's any reasonable connection, include it with an appropriate score.`;

export async function handleSearchRequest(req: Request): Promise<Response> {
  console.log("🔍 [semanticSearch] Request received:", {
    method: req.method,
    url: req.url,
  });

  // CORS handling
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    let body: SearchRequest;
    try {
      body = await req.json();
      console.log("📥 [semanticSearch] Search query:", body.query);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const { query, limit = 10, excludeUserId } = body;

    // Fetch items from database
    const itemsDatabase = await fetchItemsFromDatabase(excludeUserId);
    console.log(`📦 [semanticSearch] Working with ${itemsDatabase.length} items`);

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      // Return all items if no query - no need for Claude API
      return new Response(
        JSON.stringify({
          results: itemsDatabase.slice(0, limit).map(item => ({
            ...item,
            relevanceScore: 50,
            matchReason: 'Showing all items',
          })),
          interpretation: 'Showing all available items',
          suggestedCategories: ['Electronics', 'Furniture', 'Sports & Outdoors'],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // If no items in database, return empty
    if (itemsDatabase.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          interpretation: 'No items available at this time',
          suggestedCategories: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Only check for Claude API key when we need to perform semantic search
    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      console.error("❌ [semanticSearch] CLAUDE_API_KEY not set");
      return new Response(
        JSON.stringify({
          error: "CLAUDE_API_KEY is not set.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const client = new Anthropic({ apiKey });

    // Prepare items summary for Claude
    const itemsSummary = itemsDatabase.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      price: item.price,
    }));

    const userPrompt = `Search query: "${query}"

Available items:
${JSON.stringify(itemsSummary, null, 2)}

Analyze the search query and return a JSON response in this exact format:
{
  "interpretation": "Your understanding of what the user wants",
  "matches": [
    {
      "id": "item_id",
      "score": 85,
      "reason": "Brief explanation of why this matches"
    }
  ],
  "suggestedCategories": ["Category1", "Category2"]
}

Include all items that have any reasonable relevance. Score from 0-100 based on how well they match.
Return ONLY valid JSON, no other text.`;

    console.log("🤖 [semanticSearch] Calling Claude API...");
    const startTime = Date.now();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SEARCH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const duration = Date.now() - startTime;
    console.log(`✨ [semanticSearch] Claude responded in ${duration}ms`);

    const outputText =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    // Parse Claude's JSON response
    let searchResult: {
      interpretation: string;
      matches: Array<{ id: string; score: number; reason: string }>;
      suggestedCategories: string[];
    };

    try {
      // Try to extract JSON from the response
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        searchResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("❌ [semanticSearch] Failed to parse Claude response:", outputText);
      // Fallback: return items with basic keyword matching
      const lowerQuery = query.toLowerCase();
      const fallbackResults = itemsDatabase
        .filter(item =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.category.toLowerCase().includes(lowerQuery) ||
          item.description.toLowerCase().includes(lowerQuery)
        )
        .map(item => ({
          ...item,
          relevanceScore: 70,
          matchReason: 'Keyword match',
        }));

      return new Response(
        JSON.stringify({
          results: fallbackResults.slice(0, limit),
          interpretation: `Showing items matching "${query}"`,
          suggestedCategories: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Build results with full item data
    const results: SearchResultItem[] = searchResult.matches
      .filter(match => match.score > 20) // Filter out very low scores
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, limit)
      .map(match => {
        const item = itemsDatabase.find(i => i.id === match.id);
        if (!item) return null;
        return {
          ...item,
          relevanceScore: match.score,
          matchReason: match.reason,
        };
      })
      .filter((item): item is SearchResultItem => item !== null);

    console.log(`✅ [semanticSearch] Returning ${results.length} results`);

    const searchResponse: SearchResponse = {
      results,
      interpretation: searchResult.interpretation,
      suggestedCategories: searchResult.suggestedCategories || [],
    };

    return new Response(JSON.stringify(searchResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("❌ [semanticSearch] Error:", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// Only start the server if this is the main module
if (import.meta.main) {
  Deno.serve(handleSearchRequest);
}
