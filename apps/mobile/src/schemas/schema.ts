/**
 * Global Listing Schema
 * 
 * Elastic schema that supports different phases of the item listing pipeline:
 * - Phase 1: Original listing (description from upload system backend)
 * - Phase 2: Clarification (seller location, additional details)
 * - Phase 3: Negotiation (market value, bids with buyer IDs and ratings)
 */

export enum ListingPhase {
  /** Initial listing with basic description from upload system */
  ORIGINAL = 'original',
  /** Clarification phase with seller location and additional details */
  CLARIFICATION = 'clarification',
  /** Negotiation phase with market value and bids */
  NEGOTIATION = 'negotiation',
  /** Listing is complete/sold */
  COMPLETED = 'completed',
}

export type Location = {
  /** Street address or location name */
  address?: string;
  /** City */
  city?: string;
  /** State or province */
  state?: string;
  /** ZIP or postal code */
  zipCode?: string;
  /** Country */
  country?: string;
  /** Geographic coordinates (latitude) */
  latitude?: number;
  /** Geographic coordinates (longitude) */
  longitude?: number;
  /** Formatted display address */
  displayAddress?: string;
};

export type Bid = {
  /** Unique bid identifier */
  id: string;
  /** Buyer user ID */
  buyerId: string;
  /** Buyer display name */
  buyerName?: string;
  /** Bid amount in cents (to avoid floating point issues) */
  amount: number;
  /** Buyer's rating (0-5) */
  buyerRating?: number;
  /** Number of reviews buyer has */
  buyerReviewCount?: number;
  /** Bid timestamp */
  createdAt: number;
  /** Bid message/note from buyer */
  message?: string;
  /** Whether this bid is currently active */
  isActive: boolean;
};

export type OriginalListingData = {
  /** Item title/name */
  title: string;
  /** Item category */
  category: string;
  /** Item description from upload system backend */
  description: string;
  /** Condition of the item */
  condition?: string;
  /** Item images URIs */
  imageUris: string[];
  /** Additional notes */
  notes?: string;
  /** Intent: 'owned' (selling) or 'wants' (buying) */
  intent: 'owned' | 'wants';
  /** Tags for searchability */
  tags?: string[];
};

export type ClarificationData = {
  /** Seller's location */
  sellerLocation: Location;
  /** Preferred contact method */
  contactMethod?: 'email' | 'phone' | 'in-app';
  /** Contact information */
  contactInfo?: string;
  /** Availability for viewing/pickup */
  availability?: string;
  /** Additional details about the item */
  additionalDetails?: string;
  /** Preferred pickup/delivery method */
  pickupMethod?: 'pickup' | 'delivery' | 'both';
  /** Shipping available? */
  shippingAvailable?: boolean;
};

export type NegotiationData = {
  /** Estimated market value in cents */
  estimatedMarketValue?: number;
  /** Starting/asking price in cents */
  askingPrice?: number;
  /** List of bids on this item */
  bids: Bid[];
  /** Current highest bid */
  highestBid?: Bid;
  /** Minimum acceptable price in cents */
  minimumPrice?: number;
  /** Whether the listing accepts offers */
  acceptsOffers: boolean;
  /** Auction end time (timestamp) */
  auctionEndTime?: number;
  /** Whether this is an auction-style listing */
  isAuction?: boolean;
};

/**
 * Complete listing schema that is elastic across all phases
 */
export type Listing = {
  /** Unique listing identifier */
  id: string;
  /** Current phase of the listing */
  phase: ListingPhase;
  /** Original listing data (required for all phases) */
  original: OriginalListingData;
  /** Clarification data (present in clarification and later phases) */
  clarification?: ClarificationData;
  /** Negotiation data (present in negotiation phase) */
  negotiation?: NegotiationData;
  /** Listing creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Seller/user ID who created the listing */
  sellerId: string;
  /** Whether the listing is currently active */
  isActive: boolean;
  /** Visibility status */
  visibility?: 'public' | 'private' | 'unlisted';
};

/**
 * Type guards and validation helpers
 */
export function isListingPhase(phase: string): phase is ListingPhase {
  return Object.values(ListingPhase).includes(phase as ListingPhase);
}

export function hasPhase(listing: Listing, phase: ListingPhase): boolean {
  switch (phase) {
    case ListingPhase.ORIGINAL:
      return listing.phase === ListingPhase.ORIGINAL ||
             listing.phase === ListingPhase.CLARIFICATION ||
             listing.phase === ListingPhase.NEGOTIATION ||
             listing.phase === ListingPhase.COMPLETED;
    case ListingPhase.CLARIFICATION:
      return listing.phase === ListingPhase.CLARIFICATION ||
             listing.phase === ListingPhase.NEGOTIATION ||
             listing.phase === ListingPhase.COMPLETED;
    case ListingPhase.NEGOTIATION:
      return listing.phase === ListingPhase.NEGOTIATION ||
             listing.phase === ListingPhase.COMPLETED;
    case ListingPhase.COMPLETED:
      return listing.phase === ListingPhase.COMPLETED;
    default:
      return false;
  }
}

export function hasClarificationData(listing: Listing): listing is Listing & { clarification: ClarificationData } {
  return listing.clarification !== undefined && listing.clarification !== null;
}

export function hasNegotiationData(listing: Listing): listing is Listing & { negotiation: NegotiationData } {
  return listing.negotiation !== undefined && listing.negotiation !== null;
}

/**
 * Validation errors
 */
export type ValidationError = {
  field: string;
  message: string;
};

/**
 * Validate a listing against the schema
 */
export function validateListing(listing: Partial<Listing>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required top-level fields
  if (!listing.id) {
    errors.push({ field: 'id', message: 'Listing ID is required' });
  }

  if (!listing.phase || !isListingPhase(listing.phase)) {
    errors.push({ field: 'phase', message: 'Valid listing phase is required' });
  }

  if (!listing.original) {
    errors.push({ field: 'original', message: 'Original listing data is required' });
  } else {
    // Validate original listing data
    if (!listing.original.title?.trim()) {
      errors.push({ field: 'original.title', message: 'Title is required' });
    }
    if (!listing.original.category?.trim()) {
      errors.push({ field: 'original.category', message: 'Category is required' });
    }
    if (!listing.original.description?.trim()) {
      errors.push({ field: 'original.description', message: 'Description is required' });
    }
    if (!listing.original.imageUris || listing.original.imageUris.length === 0) {
      errors.push({ field: 'original.imageUris', message: 'At least one image is required' });
    }
    if (!listing.original.intent || !['owned', 'wants'].includes(listing.original.intent)) {
      errors.push({ field: 'original.intent', message: 'Intent must be "owned" or "wants"' });
    }
  }

  // Validate clarification data if phase requires it
  if (hasPhase(listing as Listing, ListingPhase.CLARIFICATION) && listing.phase !== ListingPhase.ORIGINAL) {
    if (listing.clarification) {
      if (!listing.clarification.sellerLocation) {
        errors.push({ field: 'clarification.sellerLocation', message: 'Seller location is required in clarification phase' });
      }
    } else if (listing.phase === ListingPhase.CLARIFICATION || listing.phase === ListingPhase.NEGOTIATION) {
      errors.push({ field: 'clarification', message: 'Clarification data is required for this phase' });
    }
  }

  // Validate negotiation data if phase requires it
  if (hasPhase(listing as Listing, ListingPhase.NEGOTIATION) && listing.phase === ListingPhase.NEGOTIATION) {
    if (listing.negotiation) {
      if (!listing.negotiation.bids) {
        errors.push({ field: 'negotiation.bids', message: 'Bids array is required in negotiation phase' });
      }
    } else {
      errors.push({ field: 'negotiation', message: 'Negotiation data is required for negotiation phase' });
    }
  }

  if (!listing.sellerId) {
    errors.push({ field: 'sellerId', message: 'Seller ID is required' });
  }

  return errors;
}

/**
 * Format currency from cents to display string
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(cents / 100);
}

/**
 * Get display text for listing phase
 */
export function getPhaseDisplayText(phase: ListingPhase): string {
  switch (phase) {
    case ListingPhase.ORIGINAL:
      return 'Draft Listing';
    case ListingPhase.CLARIFICATION:
      return 'Clarification';
    case ListingPhase.NEGOTIATION:
      return 'Active Listing';
    case ListingPhase.COMPLETED:
      return 'Completed';
    default:
      return 'Unknown';
  }
}

