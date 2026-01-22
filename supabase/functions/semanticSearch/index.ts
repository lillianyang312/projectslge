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
  cursor?: { created_at: string; id: string };
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
  nextCursor?: { created_at: string; id: string };
  hasMore: boolean;
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
function sanitizeOrTerm(term: string): string {
  // PostgREST filter strings are fragile; keep this conservative.
  return term
    .trim()
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

function buildOrFilter(terms: string[]): string | undefined {
  const cleaned = terms.map(sanitizeOrTerm).filter(Boolean);
  if (cleaned.length === 0) return undefined;

  const parts: string[] = [];
  for (const t of cleaned.slice(0, 8)) {
    // Match in title/description/category (best effort)
    parts.push(`title.ilike.%${t}%`);
    parts.push(`description.ilike.%${t}%`);
    parts.push(`category.ilike.%${t}%`);
  }
  return parts.join(",");
}

async function fetchItemsFromDatabase(opts: {
  excludeUserId?: string;
  limit: number;
  cursor?: { created_at: string; id: string };
  orFilter?: string;
}): Promise<{ items: SearchResultItem[]; hasMore: boolean; nextCursor?: { created_at: string; id: string } }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ [semanticSearch] Missing Supabase env vars");
    return { items: [], hasMore: false, nextCursor: undefined };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch items (keyset pagination: created_at desc, id desc)
  let itemQuery = supabase
    .from('items')
    .select('id, title, category, description, condition, photos, estimated_value_min, estimated_value_max, owner_id, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(opts.limit + 1);

  if (opts.orFilter) {
    itemQuery = itemQuery.or(opts.orFilter);
  }

  // Exclude user's own items if userId provided
  if (opts.excludeUserId) {
    itemQuery = itemQuery.neq('owner_id', opts.excludeUserId);
  }

  // Apply cursor (older than cursor)
  if (opts.cursor?.created_at && opts.cursor?.id) {
    // Cursor values may include characters like '+' (e.g. +00:00) that must be URL-safe
    // inside PostgREST filter strings.
    const cursorCreatedAt = encodeURIComponent(opts.cursor.created_at);
    const cursorId = encodeURIComponent(opts.cursor.id);
    // created_at < cursor.created_at OR (created_at = cursor.created_at AND id < cursor.id)
    itemQuery = itemQuery.or(
      `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
    );
  }

  const { data: items, error: itemError } = await itemQuery;

  if (itemError) {
    console.error("❌ [semanticSearch] Error fetching items:", itemError);
    return { items: [], hasMore: false, nextCursor: undefined };
  }

  const fetchedCount = items?.length || 0;
  console.log(`📦 [semanticSearch] Fetched ${fetchedCount} items from database`);

  // Pagination setup
  const pageItems = (items || []).slice(0, opts.limit);
  const hasMore = fetchedCount > opts.limit;
  const last = pageItems[pageItems.length - 1] as unknown as { id: string; created_at: string } | undefined;
  const nextCursor = last ? { created_at: last.created_at, id: last.id } : undefined;

  // Fetch all deals for these items to track status and filter sold items
  const itemIds = pageItems.map(i => i.id);
  let dealStatusMap: Record<string, string> = {};
  let soldItemIds: Set<string> = new Set();

  if (itemIds.length > 0) {
    // Fetch all deals (including completed) to know which items are sold
    const { data: deals } = await supabase
      .from('deals')
      .select('item_id, status')
      .in('item_id', itemIds);

    if (deals) {
      deals.forEach(deal => {
        // Track sold items (completed deals)
        if (deal.status === 'completed') {
          soldItemIds.add(deal.item_id);
        }
        // Track active deal status (not completed/cancelled) for badge display
        if (!dealStatusMap[deal.item_id] &&
            deal.status !== 'completed' &&
            deal.status !== 'cancelled') {
          dealStatusMap[deal.item_id] = deal.status;
        }
      });
    }
  }

  console.log(`🚫 [semanticSearch] Filtering out ${soldItemIds.size} sold items`);

  // Filter out sold items and map to result format
  const availableItems = pageItems.filter(item => !soldItemIds.has(item.id));

  return {
    items: availableItems.map(item => ({
      id: item.id,
      title: item.title || 'Untitled Item',
      category: item.category || 'Other',
      description: item.description || `${item.condition || 'Good'} condition`,
      price: item.estimated_value_min || item.estimated_value_max || 0,
      priceMin: item.estimated_value_min || 0,
      priceMax: item.estimated_value_max || 0,
      emoji: getEmojiForCategory(item.category || 'Other'),
      photos: item.photos || [],
      relevanceScore: 0,
      matchReason: '',
      dealStatus: dealStatusMap[item.id] as SearchResultItem['dealStatus'] || null,
    })),
    hasMore,
    nextCursor,
  };
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

    const { query, limit = 10, excludeUserId, cursor } = body;

    // For both browse-all and semantic paths, we fetch a single page from DB.

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      // Browse-all (no Claude): keyset-paged
      const page = await fetchItemsFromDatabase({ excludeUserId, limit, cursor });
      return new Response(
        JSON.stringify({
          results: page.items.map(item => ({
            ...item,
            relevanceScore: 50,
            matchReason: 'Showing all items',
          })),
          interpretation: 'Showing all available items',
          suggestedCategories: ['Electronics', 'Furniture', 'Sports & Outdoors'],
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
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

    // Ask Claude for query understanding only (paginatable)
    const userPrompt = `Search query: "${query}"

Return ONLY valid JSON in this exact format:
{
  "interpretation": "Your understanding of what the user wants",
  "suggestedCategories": ["Category1", "Category2"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- suggestedCategories: 0-5 short marketplace categories
- keywords: 3-8 short terms or phrases, no punctuation
`;

    console.log("🤖 [semanticSearch] Calling Claude API (query understanding)...");
    const startTime = Date.now();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SEARCH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const duration = Date.now() - startTime;
    console.log(`✨ [semanticSearch] Claude responded in ${duration}ms`);

    const outputText =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    let understood: {
      interpretation: string;
      suggestedCategories: string[];
      keywords: string[];
    } = { interpretation: `Searching for "${query}"`, suggestedCategories: [], keywords: [] };

    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        understood = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Best-effort; fall back to raw query keyword
      understood = { interpretation: `Searching for "${query}"`, suggestedCategories: [], keywords: [query] };
    }

    const terms = [
      ...(Array.isArray(understood.keywords) ? understood.keywords : []),
      ...(Array.isArray(understood.suggestedCategories) ? understood.suggestedCategories : []),
      query,
    ];

    const orFilter = buildOrFilter(terms);

    const page = await fetchItemsFromDatabase({ excludeUserId, limit, cursor, orFilter });

    if (page.items.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          interpretation: understood.interpretation || `No matches for "${query}"`,
          suggestedCategories: understood.suggestedCategories || [],
          nextCursor: undefined,
          hasMore: false,
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

    // Deterministic scoring on the returned page
    const loweredTerms = terms.map(t => sanitizeOrTerm(t).toLowerCase()).filter(Boolean);
    const scored = page.items.map((item) => {
      const hayTitle = (item.title || "").toLowerCase();
      const hayDesc = (item.description || "").toLowerCase();
      const hayCat = (item.category || "").toLowerCase();

      let hits = 0;
      const reasons: string[] = [];
      for (const t of loweredTerms.slice(0, 8)) {
        if (t.length < 2) continue;
        if (hayTitle.includes(t)) {
          hits += 3;
          reasons.push(`title: ${t}`);
        } else if (hayCat.includes(t)) {
          hits += 2;
          reasons.push(`category: ${t}`);
        } else if (hayDesc.includes(t)) {
          hits += 1;
          reasons.push(`description: ${t}`);
        }
      }

      const relevance = Math.min(100, 40 + hits * 8);
      return {
        ...item,
        relevanceScore: relevance,
        matchReason: reasons.length ? `Matched ${reasons.slice(0, 3).join(", ")}` : "Possible match",
      };
    });

    const searchResponse: SearchResponse = {
      results: scored,
      interpretation: understood.interpretation || `Searching for "${query}"`,
      suggestedCategories: understood.suggestedCategories || [],
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };

    console.log(`✅ [semanticSearch] Returning ${searchResponse.results.length} results (hasMore=${searchResponse.hasMore})`);

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
