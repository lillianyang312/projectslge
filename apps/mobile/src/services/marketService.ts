/**
 * Market Value Estimation Service
 *
 * Provides AI-powered market value estimates for items.
 * Currently uses stub logic - will be replaced with actual ML model or LLM integration.
 */

import { Item, MarketValue, DealEvaluation } from '../types/models';

// Stub price ranges by category
const CATEGORY_PRICE_RANGES: Record<string, { min: number; max: number }> = {
  furniture: { min: 50, max: 800 },
  electronics: { min: 30, max: 1200 },
  clothing: { min: 10, max: 150 },
  books: { min: 5, max: 40 },
  kitchen: { min: 15, max: 300 },
  sports: { min: 20, max: 500 },
  toys: { min: 10, max: 100 },
  tools: { min: 25, max: 400 },
};

// Condition multipliers
const CONDITION_MULTIPLIERS: Record<string, number> = {
  new: 1.0,
  like_new: 0.85,
  good: 0.65,
  fair: 0.45,
  poor: 0.25,
};

/**
 * Estimate market value for an item
 * TODO: Replace with actual ML model or LLM API call
 */
export async function estimateMarketValue(item: Item): Promise<MarketValue> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const category = item.category || 'furniture';
  const baseRange = CATEGORY_PRICE_RANGES[category] || { min: 20, max: 200 };

  // Apply condition multiplier
  const conditionMultiplier = CONDITION_MULTIPLIERS[item.condition || 'good'] || 0.65;

  const min = Math.round(baseRange.min * conditionMultiplier);
  const max = Math.round(baseRange.max * conditionMultiplier);

  // Confidence is higher for common categories and good condition
  const baseConfidence = 0.7;
  const conditionBonus = item.condition === 'good' || item.condition === 'like_new' ? 0.1 : 0;
  const confidence = Math.min(0.95, baseConfidence + conditionBonus);

  return {
    min,
    max,
    confidence,
  };
}

/**
 * Evaluate if a deal is good based on market value and offer price
 */
export function evaluateDeal(
  item: Item,
  offerPrice: number,
  userMaxPrice?: number
): DealEvaluation {
  const marketMin = item.market_value_min || 0;
  const marketMax = item.market_value_max || 0;
  const marketAvg = (marketMin + marketMax) / 2;

  // Determine if it's below, at, or above market
  let marketComparison: 'below' | 'at' | 'above';
  if (offerPrice < marketMin * 0.9) {
    marketComparison = 'below';
  } else if (offerPrice > marketMax * 1.1) {
    marketComparison = 'above';
  } else {
    marketComparison = 'at';
  }

  // Calculate percentage off (if below market)
  const percentageOff = marketComparison === 'below'
    ? Math.round(((marketAvg - offerPrice) / marketAvg) * 100)
    : undefined;

  // Determine if it's a good deal
  const isGoodDeal = marketComparison === 'below' ||
    (marketComparison === 'at' && offerPrice <= marketAvg);

  // Build reasoning
  const reasoning: string[] = [];

  if (marketComparison === 'below') {
    reasoning.push(`${percentageOff}% below market average of $${Math.round(marketAvg)}`);
  } else if (marketComparison === 'at') {
    reasoning.push(`Fair market price (avg: $${Math.round(marketAvg)})`);
  } else {
    reasoning.push(`Above market average of $${Math.round(marketAvg)}`);
  }

  // Check against user's max price
  if (userMaxPrice && offerPrice > userMaxPrice) {
    reasoning.push(`Over your max budget of $${userMaxPrice}`);
  } else if (userMaxPrice && offerPrice <= userMaxPrice * 0.8) {
    reasoning.push(`Well within your budget of $${userMaxPrice}`);
  }

  // Consider item condition
  if (item.condition === 'new' || item.condition === 'like_new') {
    reasoning.push('Item is in excellent condition');
  } else if (item.condition === 'poor') {
    reasoning.push('Item condition is poor - price should reflect that');
  }

  // Agent's take
  let agentTake: string;
  if (isGoodDeal && marketComparison === 'below') {
    agentTake = `Strong buy! This is ${percentageOff}% off market value.`;
  } else if (isGoodDeal) {
    agentTake = 'Fair deal at market price.';
  } else if (marketComparison === 'above') {
    agentTake = 'Overpriced compared to market. Consider negotiating.';
  } else {
    agentTake = 'Reasonable price, but shop around.';
  }

  return {
    is_good_deal: isGoodDeal,
    market_comparison: marketComparison,
    percentage_off: percentageOff,
    agent_take: agentTake,
    reasoning,
  };
}

/**
 * Calculate match score between a buyer's want and a seller's item
 * Returns a score from 0-100
 */
export function calculateMatchScore(
  buyerWant: Item,
  sellerItem: Item,
  buyerLocation?: string,
  sellerLocation?: string
): number {
  let score = 0;

  // Category match (40 points)
  if (buyerWant.category === sellerItem.category) {
    score += 40;
  } else if (buyerWant.label === sellerItem.label) {
    score += 30; // Close match on label
  }

  // Price compatibility (30 points)
  if (buyerWant.user_max_price && sellerItem.user_min_price) {
    const buyerMax = buyerWant.user_max_price;
    const sellerMin = sellerItem.user_min_price;

    if (buyerMax >= sellerMin) {
      // There's overlap - calculate how much
      const overlap = Math.min(buyerMax - sellerMin, buyerMax * 0.3);
      const maxOverlap = buyerMax * 0.3;
      score += Math.round((overlap / maxOverlap) * 30);
    }
  } else {
    score += 15; // Default partial score if no prices set
  }

  // Delivery preference match (15 points)
  if (
    buyerWant.delivery_preference === sellerItem.delivery_preference ||
    buyerWant.delivery_preference === 'either' ||
    sellerItem.delivery_preference === 'either'
  ) {
    score += 15;
  }

  // Urgency compatibility (10 points)
  if (buyerWant.urgency === 'urgent' && sellerItem.urgency === 'urgent') {
    score += 10;
  } else if (buyerWant.urgency === 'flexible' || sellerItem.urgency === 'flexible') {
    score += 5;
  }

  // Location proximity (5 points) - stub implementation
  if (buyerLocation && sellerLocation && buyerLocation === sellerLocation) {
    score += 5;
  }

  return Math.min(100, score);
}
