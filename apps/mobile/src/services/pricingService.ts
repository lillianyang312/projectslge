import { supabase } from '../lib/supabase';

/**
 * Request body for price estimation
 */
export interface EstimatePriceRequest {
  title: string;
  category: string;
  condition: string;
  description?: string;
  pricePurchased?: number;
  photoUrls?: string[];
}

/**
 * Response from price estimation
 */
export interface EstimatePriceResponse {
  market_value_min: number;
  market_value_max: number;
  confidence: number;
  reasoning: string;
  estimated_midpoint: number;
}

/**
 * Estimates the price of an item using Claude AI
 */
export async function estimatePrice(
  request: EstimatePriceRequest
): Promise<EstimatePriceResponse | null> {
  try {
    console.log('[pricingService] Estimating price for:', {
      title: request.title,
      category: request.category,
      condition: request.condition,
    });

    const { data, error } = await supabase.functions.invoke('estimatePrice', {
      body: request,
    });

    if (error) {
      console.error('[pricingService] Error calling estimatePrice:', error);
      return null;
    }

    console.log('[pricingService] Price estimation result:', data);
    return data as EstimatePriceResponse;
  } catch (err) {
    console.error('[pricingService] Exception in estimatePrice:', err);
    return null;
  }
}
