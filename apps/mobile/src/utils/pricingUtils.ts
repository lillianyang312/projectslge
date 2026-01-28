import { SellIntent } from '../state/itemsStore';

export interface OfferRecommendation {
  isRecommended: boolean;
  reason: string;
  badgeVariant: 'success' | 'warning' | 'neutral' | 'purple';
}

/**
 * Evaluates an offer against the seller's pricing expectations
 * Returns a recommendation with reason and visual badge variant
 */
export function evaluateOffer(
  offerAmount: number,
  minPrice: number | null | undefined,
  estimatedMin: number,
  estimatedMax: number,
  sellIntent: SellIntent
): OfferRecommendation {
  // If seller has set a minimum price, use that as the baseline
  const effectiveMin = minPrice ?? estimatedMin;
  const midpoint = (estimatedMin + estimatedMax) / 2;

  // Check if offer meets minimum price
  if (minPrice && offerAmount >= minPrice) {
    return {
      isRecommended: true,
      reason: 'Meets your minimum price',
      badgeVariant: 'success',
    };
  }

  // Offer is above market value max - definitely recommend
  if (offerAmount >= estimatedMax) {
    return {
      isRecommended: true,
      reason: 'Above market value',
      badgeVariant: 'success',
    };
  }

  // Offer is in the upper range of market value
  if (offerAmount >= midpoint) {
    // For "want gone" intent, recommend anything in market range
    if (sellIntent === 'Want gone') {
      return {
        isRecommended: true,
        reason: 'In market range',
        badgeVariant: 'success',
      };
    }
    return {
      isRecommended: true,
      reason: 'Good offer',
      badgeVariant: 'purple',
    };
  }

  // Offer is in the lower market range
  if (offerAmount >= estimatedMin) {
    // For "want gone" intent, might still be acceptable
    if (sellIntent === 'Want gone') {
      return {
        isRecommended: true,
        reason: 'Acceptable offer',
        badgeVariant: 'warning',
      };
    }
    return {
      isRecommended: false,
      reason: 'Below midpoint',
      badgeVariant: 'warning',
    };
  }

  // Offer is below market value
  if (offerAmount >= effectiveMin * 0.8) {
    return {
      isRecommended: false,
      reason: 'Below market value',
      badgeVariant: 'warning',
    };
  }

  // Offer is significantly below market value
  return {
    isRecommended: false,
    reason: 'Low offer',
    badgeVariant: 'neutral',
  };
}

/**
 * Calculates time until expiration in a human-readable format
 */
export function getExpirationText(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return `Expires in ${diffDays} days`;
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffHours > 1) return `Expires in ${diffHours}h`;
  if (diffMins > 1) return `Expires in ${diffMins}m`;
  return 'Expiring soon';
}

/**
 * Calculates when a deal should expire based on interestedFor duration
 */
export function calculateExpiresAt(createdAt: string, interestedFor: string): Date | null {
  const created = new Date(createdAt);

  switch (interestedFor) {
    case '1 week':
      return new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '2 weeks':
      return new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    case '1 month':
      return new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'Flexible':
    default:
      return null; // No expiration
  }
}

/**
 * Formats the last active time in a human-readable way
 */
export function getLastActiveText(updatedAt: string): string {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Active now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  if (diffDays === 1) return 'Active yesterday';
  if (diffDays < 7) return `Active ${diffDays} days ago`;
  return `Active ${Math.floor(diffDays / 7)} weeks ago`;
}

/**
 * Gets the best offer from a list of deals
 */
export function getBestOffer(deals: { current_offer?: number | null }[]): number | null {
  const offers = deals
    .filter((d) => d.current_offer != null)
    .map((d) => d.current_offer as number);

  if (offers.length === 0) return null;
  return Math.max(...offers);
}

/**
 * Counts interested buyers (active/negotiating deals with offers only)
 */
export function countInterestedBuyers(deals: { current_offer?: number | null; is_question?: boolean; status?: string }[]): number {
  return deals.filter((d) =>
    d.current_offer != null &&
    !d.is_question &&
    d.status === 'negotiating'
  ).length;
}
