/**
 * Agent Negotiation Service
 *
 * Provides AI-powered negotiation suggestions and deal analysis.
 * The agent considers:
 * - User's min/max price
 * - Market estimates
 * - Item urgency
 * - Current deal state
 */

import { Item, Deal, AgentSuggestion } from '../types/models';

interface NegotiationContext {
  item: Item;
  currentOffer?: number;
  lastOfferBy?: string;
  userId: string; // Current user (buyer or seller)
  isBuyer: boolean;
}

/**
 * Generate agent suggestion for next negotiation move
 */
export function generateNegotiationSuggestion(
  context: NegotiationContext
): AgentSuggestion {
  const { item, currentOffer, isBuyer, userId } = context;

  const marketMin = item.market_value_min || 0;
  const marketMax = item.market_value_max || 0;
  const marketAvg = (marketMin + marketMax) / 2;

  const userMin = item.user_min_price || marketMin;
  const userMax = item.user_max_price || marketMax;

  // If there's no offer yet, suggest initial offer
  if (!currentOffer) {
    return generateInitialOffer(item, isBuyer, userMin, userMax, marketAvg);
  }

  // If there's an existing offer, suggest counter or accept
  return generateCounterOrAccept(
    item,
    currentOffer,
    isBuyer,
    userMin,
    userMax,
    marketAvg
  );
}

function generateInitialOffer(
  item: Item,
  isBuyer: boolean,
  userMin: number,
  userMax: number,
  marketAvg: number
): AgentSuggestion {
  let suggestedAmount: number;
  let reasoning: string;

  if (isBuyer) {
    // Buyer: Start below market avg but above seller's likely minimum
    suggestedAmount = Math.round(marketAvg * 0.85);

    // Don't exceed user's max
    if (suggestedAmount > userMax) {
      suggestedAmount = Math.round(userMax * 0.9);
    }

    reasoning = `Starting at 85% of market value ($${Math.round(marketAvg)}) leaves room for negotiation while showing serious interest.`;
  } else {
    // Seller: Start at or slightly above market avg
    suggestedAmount = Math.round(marketAvg * 1.05);

    // Don't go below user's minimum
    if (suggestedAmount < userMin) {
      suggestedAmount = Math.round(userMin * 1.1);
    }

    reasoning = `Starting slightly above market value ($${Math.round(marketAvg)}) accounts for potential negotiation while maximizing your return.`;
  }

  // Adjust for urgency
  if (item.urgency === 'urgent') {
    if (isBuyer) {
      suggestedAmount = Math.round(suggestedAmount * 1.05);
      reasoning += ' Increased slightly due to urgent need.';
    } else {
      suggestedAmount = Math.round(suggestedAmount * 0.95);
      reasoning += ' Reduced slightly to move faster due to urgency.';
    }
  }

  return {
    type: 'offer',
    amount: suggestedAmount,
    reasoning,
    confidence: 0.8,
  };
}

function generateCounterOrAccept(
  item: Item,
  currentOffer: number,
  isBuyer: boolean,
  userMin: number,
  userMax: number,
  marketAvg: number
): AgentSuggestion {
  const offerVsMarket = currentOffer / marketAvg;

  if (isBuyer) {
    // Buyer evaluating seller's offer
    if (currentOffer <= userMax) {
      // Offer is within budget
      if (currentOffer <= marketAvg * 0.9) {
        // Great deal - accept
        return {
          type: 'accept',
          reasoning: `This is a great deal! ${Math.round(((marketAvg - currentOffer) / marketAvg) * 100)}% below market value and within your budget.`,
          confidence: 0.95,
        };
      } else if (currentOffer <= userMax * 0.95) {
        // Decent deal - could accept or counter down slightly
        const counterAmount = Math.round(currentOffer * 0.95);
        return {
          type: 'counter',
          amount: counterAmount,
          reasoning: `The offer is fair, but there's room to negotiate. A 5% counter keeps the deal moving while saving you money.`,
          confidence: 0.7,
        };
      } else {
        // At the top of budget - accept if urgent, counter otherwise
        if (item.urgency === 'urgent') {
          return {
            type: 'accept',
            reasoning: `Given your urgent need, accepting now is the best move even though it's near market value.`,
            confidence: 0.75,
          };
        } else {
          const counterAmount = Math.round(currentOffer * 0.92);
          return {
            type: 'counter',
            amount: counterAmount,
            reasoning: `Counter down to get closer to market average ($${Math.round(marketAvg)}). You have flexibility on timing.`,
            confidence: 0.65,
          };
        }
      }
    } else {
      // Over budget - counter or decline
      if (currentOffer <= userMax * 1.1) {
        // Close to budget - counter at max
        return {
          type: 'counter',
          amount: userMax,
          reasoning: `The offer exceeds your budget by ${Math.round(currentOffer - userMax)}. Counter at your max price of $${userMax}.`,
          confidence: 0.8,
        };
      } else {
        // Way over budget - decline
        return {
          type: 'decline',
          reasoning: `This offer is significantly over your budget ($${userMax}). Better to decline and keep looking.`,
          confidence: 0.9,
        };
      }
    }
  } else {
    // Seller evaluating buyer's offer
    if (currentOffer >= userMin) {
      // Offer meets minimum
      if (currentOffer >= marketAvg) {
        // At or above market - accept
        return {
          type: 'accept',
          reasoning: `Great offer! At or above market value ($${Math.round(marketAvg)}) and meets your minimum price.`,
          confidence: 0.95,
        };
      } else if (currentOffer >= userMin * 1.1) {
        // Decent buffer above minimum - accept if urgent, counter otherwise
        if (item.urgency === 'urgent') {
          return {
            type: 'accept',
            reasoning: `This meets your minimum and given your urgency to sell, accepting now is the smart move.`,
            confidence: 0.85,
          };
        } else {
          const counterAmount = Math.round((currentOffer + marketAvg) / 2);
          return {
            type: 'counter',
            amount: counterAmount,
            reasoning: `Counter halfway to market value ($${Math.round(marketAvg)}) to maximize your return.`,
            confidence: 0.7,
          };
        }
      } else {
        // Just above minimum - counter up
        const counterAmount = Math.round(currentOffer * 1.08);
        return {
          type: 'counter',
          amount: counterAmount,
          reasoning: `The offer meets your minimum but you can do better. Counter up 8% toward market value.`,
          confidence: 0.75,
        };
      }
    } else {
      // Below minimum
      if (currentOffer >= userMin * 0.9) {
        // Close to minimum - counter at minimum
        return {
          type: 'counter',
          amount: userMin,
          reasoning: `The offer is close but below your minimum. Counter at your minimum acceptable price of $${userMin}.`,
          confidence: 0.8,
        };
      } else {
        // Way below minimum - decline
        return {
          type: 'decline',
          reasoning: `This offer is significantly below your minimum ($${userMin}). Better to decline and wait for serious buyers.`,
          confidence: 0.9,
        };
      }
    }
  }
}

/**
 * Generate quick action messages for chat
 */
export function getQuickActionMessages(context: 'pickup' | 'shipping'): string[] {
  if (context === 'pickup') {
    return [
      "I'm running 10 minutes late",
      "I'm here!",
      "Can we reschedule?",
      "Where should I meet you?",
      "On my way",
    ];
  } else {
    return [
      "When will this ship?",
      "Got the tracking number?",
      "Package arrived!",
      "Issue with the item",
      "Thanks, all good!",
    ];
  }
}

/**
 * Generate agent message for deal state transitions
 */
export function getAgentSystemMessage(
  event: 'deal_created' | 'offer_made' | 'offer_accepted' | 'logistics_set' | 'completed',
  context?: Record<string, any>
): string {
  switch (event) {
    case 'deal_created':
      return "Great news! You've got a match. Let's work together to make this deal happen.";
    case 'offer_made':
      return `New offer: $${context?.amount}. I've analyzed the market data and have a suggestion for you.`;
    case 'offer_accepted':
      return `Deal agreed at $${context?.amount}! Now let's arrange logistics.`;
    case 'logistics_set':
      return context?.method === 'pickup'
        ? `Pickup scheduled for ${context?.date}. I'll send reminders as the date approaches.`
        : 'Shipping details confirmed. I\'ll track the package and keep you updated.';
    case 'completed':
      return 'Deal completed! Hope everything went smoothly. Ready to help with your next one.';
    default:
      return '';
  }
}
