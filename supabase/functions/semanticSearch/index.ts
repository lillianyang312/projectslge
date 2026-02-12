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
 * Uses PostgreSQL full-text search (tsvector) for fast, database-level search
 * without external API dependencies.
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
  condition?: string;
  retailPrice?: number;
  price: number;
  priceMin: number;
  priceMax: number;
  emoji: string;
  photos: string[];
  relevanceScore: number;
  matchReason: string;
  dealStatus?: 'pending' | 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled' | null;
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

// Extract keywords from query for category matching
function extractKeywords(query: string): string[] {
  // Simple keyword extraction: split on spaces, remove short words and common stop words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, ''))
    .filter(word => word.length > 2 && !stopWords.has(word));
}

// Generate interpretation from query
function generateInterpretation(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return 'Showing all available items';
  
  // Simple interpretation based on query
  const lowerQuery = trimmed.toLowerCase();
  
  // Check for common patterns
  if (lowerQuery.includes('work from home') || lowerQuery.includes('wfh')) {
    return 'Finding items for a work from home setup';
  }
  if (lowerQuery.includes('gift')) {
    return 'Finding gift ideas';
  }
  if (lowerQuery.includes('music')) {
    return 'Finding music-related items';
  }
  if (lowerQuery.includes('tech') || lowerQuery.includes('electronic')) {
    return 'Finding tech and electronics';
  }
  if (lowerQuery.includes('outdoor') || lowerQuery.includes('sport')) {
    return 'Finding outdoor and sports items';
  }
  
  return `Searching for "${trimmed}"`;
}

// Suggest categories based on query keywords
function suggestCategories(query: string, keywords: string[]): string[] {
  const categoryKeywords: Record<string, string[]> = {
    'Electronics': ['tech', 'electronic', 'computer', 'laptop', 'phone', 'tablet', 'device', 'gadget', 'monitor', 'keyboard', 'mouse'],
    'Furniture': ['furniture', 'chair', 'desk', 'table', 'sofa', 'couch', 'bed', 'shelf', 'cabinet'],
    'Office': ['office', 'work', 'desk', 'chair', 'monitor', 'keyboard', 'setup', 'wfh'],
    'Sports & Outdoors': ['sport', 'outdoor', 'bike', 'bicycle', 'exercise', 'fitness', 'gym', 'running', 'hiking'],
    'Music': ['music', 'guitar', 'piano', 'instrument', 'headphone', 'speaker', 'audio'],
    'Clothing': ['cloth', 'shirt', 'pant', 'dress', 'shoe', 'jacket', 'wear'],
    'Books': ['book', 'read', 'novel', 'textbook'],
    'Games': ['game', 'console', 'controller', 'gaming'],
    'Kitchen': ['kitchen', 'cook', 'utensil', 'pan', 'pot'],
    'Home': ['home', 'decor', 'lamp', 'rug', 'curtain'],
    'Art': ['art', 'paint', 'canvas', 'frame'],
  };
  
  const matchedCategories = new Set<string>();
  const queryLower = query.toLowerCase();
  
  // Check query against category keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        matchedCategories.add(category);
        break;
      }
    }
  }
  
  // Also check extracted keywords
  for (const keyword of keywords) {
    for (const [category, catKeywords] of Object.entries(categoryKeywords)) {
      if (catKeywords.some(k => k.includes(keyword) || keyword.includes(k))) {
        matchedCategories.add(category);
      }
    }
  }
  
  return Array.from(matchedCategories).slice(0, 5);
}

async function fetchItemsFromDatabase(opts: {
  excludeUserId?: string;
  limit: number;
  cursor?: { created_at: string; id: string };
  searchQuery?: string;
}): Promise<{ items: SearchResultItem[]; hasMore: boolean; nextCursor?: { created_at: string; id: string } }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ [semanticSearch] Missing Supabase env vars");
    return { items: [], hasMore: false, nextCursor: undefined };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Type for database item row
  interface DbItem {
    id: string;
    title: string | null;
    category: string | null;
    description: string | null;
    condition: string | null;
    retail_price: number | null;
    photos: string[] | null;
    estimated_value_min: number | null;
    estimated_value_max: number | null;
    owner_id: string;
    created_at: string;
    rank?: number;
  }

  // Use RPC function for full-text search if query provided, otherwise use regular query
  let items: DbItem[] = [];
  let itemError: { message: string } | null = null;

  if (opts.searchQuery && opts.searchQuery.trim()) {
    // Use full-text search via RPC
    let rpcFailed = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_items', {
        search_text: opts.searchQuery.trim(),
        exclude_user_id: opts.excludeUserId || null,
        result_limit: opts.limit + 1,
        cursor_created_at: opts.cursor?.created_at || null,
        cursor_id: opts.cursor?.id || null,
      });

      if (rpcError) {
        console.error("❌ [semanticSearch] RPC error:", rpcError);
        console.log("⚠️ [semanticSearch] Falling back to regular query search");
        rpcFailed = true;
      } else {
        items = rpcData || [];
      }
    } catch (rpcException) {
      console.error("❌ [semanticSearch] RPC exception:", rpcException);
      console.log("⚠️ [semanticSearch] Falling back to regular query search");
      rpcFailed = true;
    }
    
    // If RPC failed, fall back to regular query with ILIKE search
    if (rpcFailed) {
      const searchTerms = opts.searchQuery.trim().split(/\s+/).filter(t => t.length > 2);
      if (searchTerms.length > 0) {
        const orFilter = searchTerms
          .slice(0, 5)
          .map(term => `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
          .join(',');
        
        let itemQuery = supabase
          .from('items')
          .select('id, title, category, description, condition, retail_price, photos, estimated_value_min, estimated_value_max, owner_id, created_at')
          .or(orFilter)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(opts.limit + 1);

        if (opts.excludeUserId) {
          itemQuery = itemQuery.neq('owner_id', opts.excludeUserId);
        }

        if (opts.cursor?.created_at && opts.cursor?.id) {
          const cursorCreatedAt = encodeURIComponent(opts.cursor.created_at);
          const cursorId = encodeURIComponent(opts.cursor.id);
          itemQuery = itemQuery.or(
            `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
          );
        }

        const { data, error } = await itemQuery;
        items = data || [];
        itemError = error;
      } else {
        // No search terms, return empty
        items = [];
      }
    }
  } else {
    // Browse-all: regular query without search
    let itemQuery = supabase
      .from('items')
      .select('id, title, category, description, condition, retail_price, photos, estimated_value_min, estimated_value_max, owner_id, created_at')
      .eq('is_active', true) // Only show active items
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(opts.limit + 1);

    // Exclude user's own items if userId provided
    if (opts.excludeUserId) {
      itemQuery = itemQuery.neq('owner_id', opts.excludeUserId);
    }

    // Apply cursor (older than cursor)
    // PostgREST: created_at < cursor.created_at OR (created_at = cursor.created_at AND id < cursor.id)
    if (opts.cursor?.created_at && opts.cursor?.id) {
      const cursorCreatedAt = encodeURIComponent(opts.cursor.created_at);
      const cursorId = encodeURIComponent(opts.cursor.id);
      // Use or() to combine: created_at < cursor OR (created_at = cursor AND id < cursor)
      itemQuery = itemQuery.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
      );
    }

    const { data, error } = await itemQuery;
    if (error) {
      console.error("❌ [semanticSearch] Browse query error:", error);
      console.error("❌ [semanticSearch] Query details:", { excludeUserId: opts.excludeUserId, cursor: opts.cursor, limit: opts.limit });
    }
    items = data || [];
    itemError = error;
  }

  if (itemError) {
    console.error("❌ [semanticSearch] Error fetching items:", itemError);
    console.error("❌ [semanticSearch] Error details:", JSON.stringify(itemError, null, 2));
    // Don't throw - return empty results instead
    return { items: [], hasMore: false, nextCursor: undefined };
  }

  const fetchedCount = items?.length || 0;
  console.log(`📦 [semanticSearch] Fetched ${fetchedCount} items from database`);

  // Pagination setup
  const pageItems = (items || []).slice(0, opts.limit);
  const hasMore = fetchedCount > opts.limit;
  const last = pageItems[pageItems.length - 1] as unknown as { id: string; created_at: string; rank?: number } | undefined;
  const nextCursor = last ? { created_at: last.created_at, id: last.id } : undefined;

  // Fetch all deals for these items to track status and filter sold items
  const itemIds = pageItems.map(i => i.id);
  const dealStatusMap: Record<string, string> = {};
  const soldItemIds: Set<string> = new Set();

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
    items: availableItems.map(item => {
      // Calculate relevance score from rank if available, otherwise use default
      let relevanceScore = 50;
      if (item.rank !== undefined && item.rank !== null) {
        // Normalize ts_rank (typically 0-1) to 0-100 scale
        relevanceScore = Math.min(100, Math.max(40, Math.round(item.rank * 100)));
      }

      // Generate match reason
      let matchReason = 'Showing all items';
      if (opts.searchQuery && opts.searchQuery.trim()) {
        const reasons: string[] = [];
        const queryLower = opts.searchQuery.toLowerCase();
        if (item.title && item.title.toLowerCase().includes(queryLower)) {
          reasons.push('title');
        }
        if (item.category && item.category.toLowerCase().includes(queryLower)) {
          reasons.push('category');
        }
        if (item.description && item.description.toLowerCase().includes(queryLower)) {
          reasons.push('description');
        }
        matchReason = reasons.length > 0 
          ? `Matched in ${reasons.join(', ')}` 
          : 'Relevant match';
      }

      return {
        id: item.id,
        title: item.title || 'Untitled Item',
        category: item.category || 'Other',
        description: item.description || `${item.condition || 'Good'} condition`,
        condition: item.condition || undefined,
        retailPrice: item.retail_price || undefined,
        price: item.estimated_value_min || item.estimated_value_max || 0,
        priceMin: item.estimated_value_min || 0,
        priceMax: item.estimated_value_max || 0,
        emoji: getEmojiForCategory(item.category || 'Other'),
        photos: item.photos || [],
        relevanceScore,
        matchReason,
        dealStatus: dealStatusMap[item.id] as SearchResultItem['dealStatus'] || null,
      };
    }),
    hasMore,
    nextCursor,
  };
}


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
      // Browse-all: keyset-paged
      try {
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
      } catch (browseError) {
        console.error("❌ [semanticSearch] Browse-all error:", browseError);
        return new Response(
          JSON.stringify({
            results: [],
            interpretation: 'Error loading items. Please try again.',
            suggestedCategories: [],
            nextCursor: undefined,
            hasMore: false,
          }),
          {
            status: 200, // Return 200 with empty results instead of 500
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // Use PostgreSQL full-text search
    console.log("🔍 [semanticSearch] Performing full-text search:", query);
    const startTime = Date.now();

    const keywords = extractKeywords(query);
    const interpretation = generateInterpretation(query);
    const suggestedCategories = suggestCategories(query, keywords);

    const page = await fetchItemsFromDatabase({ 
      excludeUserId, 
      limit, 
      cursor, 
      searchQuery: query 
    });

    const duration = Date.now() - startTime;
    console.log(`✨ [semanticSearch] Search completed in ${duration}ms`);

    if (page.items.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          interpretation: `No matches for "${query}"`,
          suggestedCategories,
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

    const searchResponse: SearchResponse = {
      results: page.items,
      interpretation,
      suggestedCategories,
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
