import { createClient } from '@/lib/supabase/client';

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

export async function semanticSearch(
  query: string,
  limit: number = 10,
  excludeUserId?: string,
  cursor?: { created_at: string; id: string }
): Promise<SearchResponse> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('semanticSearch', {
      body: { query, limit, excludeUserId, cursor },
    });

    if (error) throw error;
    if (!data) throw new Error('No data returned from search function');
    return data;
  } catch {
    return {
      results: [],
      interpretation: 'Search failed. Please try again.',
      suggestedCategories: [],
      nextCursor: undefined,
      hasMore: false,
    };
  }
}

export function createDebouncedSearch(delayMs: number = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (
    query: string,
    callback: (response: SearchResponse) => void,
    limit?: number
  ) => {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      const response = await semanticSearch(query, limit);
      callback(response);
    }, delayMs);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  };
}
