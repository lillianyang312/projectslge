import { createClient } from '@/lib/supabase/client';
import type { SellIntent } from '@/types/models';

export interface EstimatePriceRequest {
  title: string;
  category: string;
  condition: string;
  description?: string;
  pricePurchased?: number;
  photoUrls?: string[];
  sellIntent?: SellIntent;
  categoryFields?: Record<string, unknown>;
}

export interface EstimatePriceResponse {
  market_value_min: number;
  market_value_max: number;
  confidence: number;
  reasoning: string;
  estimated_midpoint: number;
  estimated_retail_price?: number;
}

export async function estimatePrice(
  request: EstimatePriceRequest
): Promise<EstimatePriceResponse | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('estimatePrice', {
      body: request,
    });

    if (error) {
      console.error('[estimatePrice] Edge function error:', error);
      return null;
    }

    // Handle case where edge function returns an error in the data body
    if (data && typeof data === 'object' && 'error' in data) {
      console.error('[estimatePrice] Edge function returned error:', data.error);
      return null;
    }

    return data as EstimatePriceResponse;
  } catch (err) {
    console.error('[estimatePrice] Exception:', err);
    return null;
  }
}

export function calculateDisplayRange(
  baseMin: number,
  baseMax: number,
  sellIntent: SellIntent
): { displayMin: number; displayMax: number } {
  switch (sellIntent) {
    case 'Want gone':
      return { displayMin: Math.round(baseMin * 0.8), displayMax: Math.round(baseMax * 1.1) };
    case 'If good offer':
      return { displayMin: baseMin, displayMax: baseMax };
    case 'Maybe':
      return { displayMin: Math.round(baseMin * 1.1), displayMax: baseMax };
    default:
      return { displayMin: baseMin, displayMax: baseMax };
  }
}
