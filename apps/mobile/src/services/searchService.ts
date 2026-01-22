import { supabase } from '../lib/supabase';

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

/**
 * Performs semantic search using Claude AI backend
 *
 * @param query - Natural language search query
 * @param limit - Maximum number of results to return
 * @param excludeUserId - Optional user ID to exclude their items from results
 * @returns Search results with relevance scores and explanations
 */
export async function semanticSearch(
  query: string,
  limit: number = 10,
  excludeUserId?: string,
  cursor?: { created_at: string; id: string }
): Promise<SearchResponse> {
  console.log('🔍 [searchService] Starting semantic search:', { query, limit, excludeUserId, cursor });

  try {
    const { data, error } = await supabase.functions.invoke('semanticSearch', {
      body: { query, limit, excludeUserId, cursor },
    });

    if (error) {
      console.error('❌ [searchService] Supabase function error:', error);
      throw error;
    }

    console.log('✅ [searchService] Search completed:', {
      resultCount: data?.results?.length || 0,
      interpretation: data?.interpretation,
    });

    return data as SearchResponse;
  } catch (error) {
    console.error('❌ [searchService] Search failed:', error);

    // Return empty results on error
    return {
      results: [],
      interpretation: 'Search failed. Please try again.',
      suggestedCategories: [],
      nextCursor: undefined,
      hasMore: false,
    };
  }
}

/**
 * Debounced search - waits for user to stop typing before searching
 */
export function createDebouncedSearch(delayMs: number = 500) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (
    query: string,
    callback: (response: SearchResponse) => void,
    limit?: number
  ) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      const response = await semanticSearch(query, limit);
      callback(response);
    }, delayMs);

    // Return cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  };
}
