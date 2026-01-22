import { supabase } from '../lib/supabase';
import type { SellIntent } from '../state/itemsStore';

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
  // New fields for bulk upload
  sellIntent?: SellIntent;
  categoryFields?: Record<string, any>;
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
      sellIntent: request.sellIntent,
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

/**
 * Calculate display range based on sell intent
 * - 'Want gone': Wider range, can go 20% below minimum
 * - 'If good offer': Standard range
 * - 'Maybe': Narrower range, 10% higher floor
 */
export function calculateDisplayRange(
  baseMin: number,
  baseMax: number,
  sellIntent: SellIntent
): { displayMin: number; displayMax: number } {
  switch (sellIntent) {
    case 'Want gone':
      // Wider range, can go 20% below minimum
      return {
        displayMin: Math.round(baseMin * 0.8),
        displayMax: Math.round(baseMax * 1.1),
      };
    case 'If good offer':
      // Standard range
      return { displayMin: baseMin, displayMax: baseMax };
    case 'Maybe':
      // Narrower range, 10% higher floor
      return {
        displayMin: Math.round(baseMin * 1.1),
        displayMax: baseMax,
      };
    default:
      return { displayMin: baseMin, displayMax: baseMax };
  }
}
