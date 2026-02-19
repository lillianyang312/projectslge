import { Item, DealEvaluation } from '../types/models';

type OurTakeContext = 'buy' | 'sell';

interface RuleMatchResult {
  scenario:
    | 'undervalued'
    | 'fairly_priced'
    | 'slightly_overpriced_urgent'
    | 'significantly_overpriced'
    | null;
  recommendation?: string;
  longReasoning?: string;
}

/**
 * Internal helper that encodes the YAML rules from apps/docs/prompts/our_take_rules.yaml
 * in a TypeScript-friendly way.
 *
 * It returns which pricing scenario (if any) matched for a given item + asking price.
 */
function matchOurTakeRule(
  item: Item,
  askingPrice: number
): RuleMatchResult {
  const marketMin = item.market_value_min ?? 0;
  const marketMax = item.market_value_max ?? 0;

  if (!marketMin || !marketMax) {
    return { scenario: null };
  }

  const marketAvg = (marketMin + marketMax) / 2;
  if (!marketAvg) {
    return { scenario: null };
  }

  // price_difference_to_market: (asking - market_avg) / market_avg
  const priceDiffToMarket = (askingPrice - marketAvg) / marketAvg;

  const imageIdentified = Boolean(item.label);
  const sellerUrgencyHigh = item.urgency === 'urgent';

  // 1) Undervalued item (Owner asking too low)
  if (imageIdentified && priceDiffToMarket < -0.2) {
    return {
      scenario: 'undervalued',
      recommendation: 'Ask for higher price',
      longReasoning:
        "Your asking price is well below the item’s market value; you could list it for more to maximize your return.",
    };
  }

  // 2) Fairly priced item
  if (priceDiffToMarket >= -0.1 && priceDiffToMarket <= 0.1) {
    return {
      scenario: 'fairly_priced',
      recommendation: 'Sell at current price',
      longReasoning:
        'Your price is in line with market expectations, so the item is likely to attract buyers and sell in a reasonable time frame.',
    };
  }

  // 3) Slightly overpriced item with high urgency
  if (priceDiffToMarket > 0.1 && priceDiffToMarket <= 0.25 && sellerUrgencyHigh) {
    return {
      scenario: 'slightly_overpriced_urgent',
      recommendation: 'Lower price to market value',
      longReasoning:
        'Your desired price is a bit high. For a quicker sale, consider pricing closer to the market average so buyers see it as a fair deal.',
    };
  }

  // 4) Significantly overpriced item
  if (priceDiffToMarket > 0.25) {
    return {
      scenario: 'significantly_overpriced',
      recommendation: 'Keep (do not sell now)',
      longReasoning:
        'The price you want is much higher than what buyers are paying. It likely won’t sell at this price. You may choose to keep it for now or rethink your price later rather than have it sit unsold.',
    };
  }

  // 5) Seasonal / upcoming model rules from YAML are not yet wired to data fields
  // (category "textbook" + semester_time, category "electronics" + new_model_release),
  // so we skip them until those fields exist in the schema.

  return { scenario: null };
}

/**
 * Evaluate "OUR TAKE" for a given listing using the YAML rules as the primary
 * source of truth. The result is shaped like DealEvaluation so it can plug into
 * existing UI without changes.
 *
 * - For "buy" context, messages are written from the buyer’s perspective.
 * - For "sell" context, messages are written from the owner's perspective.
 */
export function evaluateOurTake(
  item: Item,
  askingPrice: number,
  context: OurTakeContext
): DealEvaluation {
  const marketMin = item.market_value_min ?? 0;
  const marketMax = item.market_value_max ?? 0;
  const marketAvg = (marketMin + marketMax) / 2 || 0;

  const reasoning: string[] = [];

  if (marketMin && marketMax) {
    reasoning.push(
      `Market range estimated at $${marketMin}-${marketMax} (avg ~$${Math.round(marketAvg)})`
    );
  }

  const ruleMatch = matchOurTakeRule(item, askingPrice);

  // Derive market comparison and percentage_off in a way that aligns with the YAML ranges
  let marketComparison: 'below' | 'at' | 'above' = 'at';
  let percentageOff: number | undefined;

  if (marketAvg > 0) {
    const priceDiffToMarket = (askingPrice - marketAvg) / marketAvg;

    if (priceDiffToMarket < -0.1) {
      marketComparison = 'below';
      percentageOff = Math.round(((marketAvg - askingPrice) / marketAvg) * 100);
    } else if (priceDiffToMarket > 0.1) {
      marketComparison = 'above';
      percentageOff = Math.round(((askingPrice - marketAvg) / marketAvg) * 100);
    } else {
      marketComparison = 'at';
    }
  }

  // Base "is_good_deal" primarily on buyer perspective
  let isGoodDeal = false;
  if (ruleMatch.scenario === 'undervalued' || ruleMatch.scenario === 'fairly_priced') {
    isGoodDeal = true;
  }

  // Build agent_take using context-aware phrasing but grounded in YAML recommendations
  let agentTake: string;

  switch (ruleMatch.scenario) {
    case 'undervalued':
      if (context === 'buy') {
        agentTake =
          'Strong buy. The owner is asking well below market value for this item.';
      } else {
        agentTake =
          'You are likely underpricing this item relative to market; consider raising your ask.';
      }
      break;
    case 'fairly_priced':
      if (context === 'buy') {
        agentTake = 'Fair deal at roughly market price.';
      } else {
        agentTake = 'Your price is in line with the market; selling at this price is reasonable.';
      }
      break;
    case 'slightly_overpriced_urgent':
      if (context === 'buy') {
        agentTake =
          'Price is above market, but the owner looks motivated. There may be room to negotiate.';
      } else {
        agentTake =
          'You are priced above market. To sell faster, consider lowering closer to market value.';
      }
      break;
    case 'significantly_overpriced':
      if (context === 'buy') {
        agentTake =
          'This is priced well above market. It may not be the best value unless you really want it.';
      } else {
        agentTake =
          'You are asking far above what buyers typically pay; this may sit unsold at this price.';
      }
      break;
    default:
      if (marketComparison === 'below') {
        agentTake =
          context === 'buy'
            ? 'Looks like a good value compared to similar items.'
            : 'You are priced competitively compared to the market.';
        isGoodDeal = true;
      } else if (marketComparison === 'at') {
        agentTake =
          context === 'buy'
            ? 'Reasonable price around market value.'
            : 'Reasonable list price around market value.';
      } else {
        agentTake =
          context === 'buy'
            ? 'Above typical market pricing; consider negotiating or waiting.'
            : 'Above market; lowering your ask could increase interest.';
      }
  }

  if (ruleMatch.longReasoning) {
    reasoning.push(ruleMatch.longReasoning);
  }

  // Add some short, structured bullets based on comparison
  if (percentageOff !== undefined) {
    if (marketComparison === 'below') {
      reasoning.push(`${percentageOff}% below market average of ~$${Math.round(marketAvg)}.`);
    } else if (marketComparison === 'above') {
      reasoning.push(`${percentageOff}% above market average of ~$${Math.round(marketAvg)}.`);
    }
  }

  return {
    is_good_deal: isGoodDeal,
    market_comparison: marketComparison,
    percentage_off: percentageOff,
    agent_take: agentTake,
    reasoning,
  };
}


