import { create } from 'zustand';
import {
  Listing,
  ListingPhase,
  OriginalListingData,
} from '../schemas/schema';
import {
  handleListingError,
  ListingValidationError,
  validateListingSafe,
  type ValidationResult,
} from '../schemas/errorHandling';
import {
  ClarificationResponse,
  ConfidenceLevel,
  getConfidenceLevel,
} from '../schemas/clarification_schema';

// Legacy Item type for backward compatibility
export type Item = {
  id: string;
  title: string;
  category: string;
  intent: 'owned' | 'wants';
  condition?: string;
  notes?: string;
  imageUri?: string;
  createdAt: number;
};

// Sell intent type
export type SellIntent = 'Maybe' | 'If good offer' | 'Want gone';

// Draft type for creating new listings
export type DraftListing = Partial<OriginalListingData> & {
  imageUri?: string;
  // Current clarification response from the identification process
  clarificationResponse?: ClarificationResponse;
  // New fields for upload flow
  pricePurchased?: number;        // Optional price paid for item
  sellIntent?: SellIntent;        // How likely to sell
  estimatedPrice?: number;        // API estimated price
  minimumPrice?: number;          // Optional minimum price to sell
};

type ItemsStore = {
  // New schema-based listings
  listings: Listing[];
  // Legacy items (for migration/compatibility)
  items: Item[];
  // Draft for new listing creation
  draft: DraftListing | null;
  // Error state
  error: string | null;
  // Actions
  seedDemoItems: () => void;
  seedDemoListings: () => void;
  setDraftFromImage: (uri: string) => void;
  updateDraft: (patch: Partial<DraftListing>) => void;
  commitDraft: (sellerId: string) => ValidationResult<Listing>;
  clearDraft: () => void;
  getListingById: (id: string) => Listing | undefined;
  updateListing: (id: string, updates: Partial<Listing>) => ValidationResult<Listing>;
  setError: (error: string | null) => void;
  clearError: () => void;
};

export const useItemsStore = create<ItemsStore>((set, get) => ({
  listings: [],
  items: [],
  draft: null,
  error: null,

  seedDemoItems: () => {
    const { items } = get();
    if (items.length === 0) {
      set({
        items: [
          {
            id: '1',
            title: 'Herman Miller Aeron Chair',
            category: 'Furniture',
            intent: 'owned',
            condition: 'Like new',
            notes: 'Barely used, great condition',
            imageUri: undefined,
            createdAt: Date.now() - 86400000, // 1 day ago
          },
        ],
      });
    }
  },

  seedDemoListings: () => {
    const { listings } = get();
    if (listings.length === 0) {
      const now = Date.now();
      const demoListings: Listing[] = [
        // High confidence example - clearly identified item
        {
          id: 'demo-high-confidence',
          phase: ListingPhase.ORIGINAL,
          original: {
            title: 'Herman Miller Aeron Chair, Size B',
            category: 'Furniture',
            description: 'Ergonomic office chair with mesh back and adjustable features. Like-new condition.',
            condition: 'Like new',
            imageUris: [],
            intent: 'owned',
            tags: ['chair', 'office', 'ergonomic', 'herman miller', 'size B'],
          },
          sellerId: 'demo-user',
          createdAt: now - 3600000,
          updatedAt: now - 3600000,
          isActive: true,
          visibility: 'public',
        },
        // Medium confidence example - needs options selection
        {
          id: 'demo-medium-confidence',
          phase: ListingPhase.ORIGINAL,
          original: {
            title: 'Office Chair',
            category: 'Furniture',
            description: 'Ergonomic office chair with mesh back. Brand/model unclear from photo.',
            condition: 'Good',
            imageUris: [],
            intent: 'owned',
            tags: ['chair', 'office', 'ergonomic'],
          },
          sellerId: 'demo-user',
          createdAt: now - 7200000,
          updatedAt: now - 7200000,
          isActive: true,
          visibility: 'public',
        },
        // Low confidence example - needs question/clarification
        {
          id: 'demo-low-confidence',
          phase: ListingPhase.ORIGINAL,
          original: {
            title: 'Unidentified Item',
            category: 'Unknown',
            description: 'Blurry or unclear photo - needs clarification.',
            imageUris: [],
            intent: 'owned',
            tags: [],
          },
          sellerId: 'demo-user',
          createdAt: now - 10800000,
          updatedAt: now - 10800000,
          isActive: true,
          visibility: 'public',
        },
        // Original demo listings
        {
          id: 'listing-1',
          phase: ListingPhase.ORIGINAL,
          original: {
            title: 'Herman Miller Aeron Chair',
            category: 'Furniture',
            description: 'Ergonomic office chair in excellent condition. Barely used, great condition.',
            condition: 'Like new',
            notes: 'Barely used, great condition',
            imageUris: [],
            intent: 'owned',
            tags: ['furniture', 'office', 'chair', 'ergonomic'],
          },
          sellerId: 'user-1',
          createdAt: now - 86400000,
          updatedAt: now - 86400000,
          isActive: true,
          visibility: 'public',
        },
        {
          id: 'listing-2',
          phase: ListingPhase.CLARIFICATION,
          original: {
            title: 'Vintage Camera Collection',
            category: 'Electronics',
            description: 'Collection of vintage film cameras including Canon, Nikon, and Leica models.',
            condition: 'Good',
            imageUris: [],
            intent: 'owned',
            tags: ['camera', 'vintage', 'photography'],
          },
          clarification: {
            sellerLocation: {
              city: 'Boston',
              state: 'MA',
              zipCode: '02115',
              country: 'USA',
              displayAddress: 'Boston, MA 02115',
            },
            contactMethod: 'in-app',
            pickupMethod: 'pickup',
            shippingAvailable: false,
            availability: 'Weekends only',
          },
          sellerId: 'user-2',
          createdAt: now - 172800000,
          updatedAt: now - 86400000,
          isActive: true,
          visibility: 'public',
        },
        // Additional CLARIFICATION phase listings for demo
        {
          id: 'clarification-1',
          phase: ListingPhase.CLARIFICATION,
          original: {
            title: 'Office Desk',
            category: 'Furniture',
            description: 'Solid wood office desk with drawers. Good condition with minor wear.',
            condition: 'Good',
            imageUris: [],
            intent: 'owned',
            tags: ['desk', 'office', 'furniture', 'wood'],
          },
          clarification: {
            sellerLocation: {
              city: 'Cambridge',
              state: 'MA',
              zipCode: '02138',
              country: 'USA',
              displayAddress: 'Cambridge, MA 02138',
            },
            contactMethod: 'in-app',
            pickupMethod: 'both',
            shippingAvailable: true,
            availability: 'Weekdays 5-8pm',
            additionalDetails: 'Desk needs to be disassembled for pickup',
          },
          sellerId: 'demo-user',
          createdAt: now - 14400000, // 4 hours ago
          updatedAt: now - 7200000, // 2 hours ago
          isActive: true,
          visibility: 'public',
        },
        {
          id: 'clarification-2',
          phase: ListingPhase.CLARIFICATION,
          original: {
            title: 'Vintage Record Player',
            category: 'Electronics',
            description: 'Classic turntable in working condition. Comes with speakers.',
            condition: 'Excellent',
            imageUris: [],
            intent: 'owned',
            tags: ['record player', 'turntable', 'vintage', 'audio'],
          },
          clarification: {
            sellerLocation: {
              city: 'Somerville',
              state: 'MA',
              zipCode: '02143',
              country: 'USA',
              displayAddress: 'Somerville, MA 02143',
            },
            contactMethod: 'in-app',
            pickupMethod: 'pickup',
            shippingAvailable: false,
            availability: 'Saturdays only',
          },
          sellerId: 'demo-user',
          createdAt: now - 21600000, // 6 hours ago
          updatedAt: now - 10800000, // 3 hours ago
          isActive: true,
          visibility: 'public',
        },
        {
          id: 'clarification-3',
          phase: ListingPhase.CLARIFICATION,
          original: {
            title: 'Bicycle',
            category: 'Sports & Outdoors',
            description: 'Mountain bike, well-maintained. Perfect for commuting.',
            condition: 'Very good',
            imageUris: [],
            intent: 'owned',
            tags: ['bike', 'bicycle', 'mountain bike', 'transportation'],
          },
          clarification: {
            sellerLocation: {
              city: 'Boston',
              state: 'MA',
              zipCode: '02115',
              country: 'USA',
              displayAddress: 'Boston, MA 02115',
            },
            contactMethod: 'phone',
            contactInfo: '(617) 555-0123',
            pickupMethod: 'pickup',
            shippingAvailable: false,
            availability: 'Flexible - call to arrange',
          },
          sellerId: 'demo-user',
          createdAt: now - 28800000, // 8 hours ago
          updatedAt: now - 14400000, // 4 hours ago
          isActive: true,
          visibility: 'public',
        },
        {
          id: 'listing-3',
          phase: ListingPhase.NEGOTIATION,
          original: {
            title: 'Designer Handbag',
            category: 'Fashion',
            description: 'Authentic designer handbag in excellent condition.',
            condition: 'Excellent',
            imageUris: [],
            intent: 'owned',
            tags: ['handbag', 'designer', 'fashion'],
          },
          clarification: {
            sellerLocation: {
              city: 'Cambridge',
              state: 'MA',
              zipCode: '02138',
              country: 'USA',
              displayAddress: 'Cambridge, MA 02138',
            },
            contactMethod: 'in-app',
            pickupMethod: 'both',
            shippingAvailable: true,
          },
          negotiation: {
            estimatedMarketValue: 50000, // $500.00
            askingPrice: 45000, // $450.00
            minimumPrice: 40000, // $400.00
            acceptsOffers: true,
            isAuction: false,
            bids: [
              {
                id: 'bid-1',
                buyerId: 'buyer-1',
                buyerName: 'John Doe',
                amount: 42000,
                buyerRating: 4.8,
                buyerReviewCount: 25,
                createdAt: now - 3600000,
                message: 'Interested in this item!',
                isActive: true,
              },
              {
                id: 'bid-2',
                buyerId: 'buyer-2',
                buyerName: 'Jane Smith',
                amount: 43000,
                buyerRating: 4.9,
                buyerReviewCount: 50,
                createdAt: now - 1800000,
                message: 'Willing to pick up today.',
                isActive: true,
              },
            ],
          },
          sellerId: 'user-3',
          createdAt: now - 259200000,
          updatedAt: now - 1800000,
          isActive: true,
          visibility: 'public',
        },
      ];
      set({ listings: demoListings });
    }
  },

  setDraftFromImage: (uri: string) => {
    set({
      draft: {
        imageUri: uri,
        imageUris: [uri],
      },
    });
  },

  updateDraft: (patch: Partial<DraftListing>) => {
    const { draft } = get();
    if (draft) {
      // Merge imageUri into imageUris if provided
      const updatedDraft = { ...draft, ...patch };
      if (patch.imageUri && !updatedDraft.imageUris?.includes(patch.imageUri)) {
        updatedDraft.imageUris = [...(draft.imageUris || []), patch.imageUri];
      }
      set({ draft: updatedDraft });
    }
  },

  commitDraft: (sellerId: string): ValidationResult<Listing> => {
    const { draft, listings } = get();
    if (!draft) {
      return {
        success: false,
        error: new ListingValidationError([
          { field: 'draft', message: 'No draft to commit' },
        ]),
      };
    }

    if (!draft.title || !draft.category) {
      return {
        success: false,
        error: new ListingValidationError([
          { field: 'original.title', message: 'Title and category are required' },
        ]),
      };
    }

    const now = Date.now();
    const newListing: Listing = {
      id: `listing-${now}`,
      phase: ListingPhase.ORIGINAL,
      original: {
        title: draft.title,
        category: draft.category,
        description: draft.description || draft.notes || '',
        condition: draft.condition,
        notes: draft.notes,
        imageUris: draft.imageUris || (draft.imageUri ? [draft.imageUri] : []),
        intent: draft.intent || 'owned',
        tags: draft.tags,
      },
      sellerId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      visibility: 'public',
    };

    const validation = validateListingSafe(newListing);
    if (validation.success === false) {
      const errorMessage = validation.error.getFirstError() || 'Validation failed';
      set({ error: errorMessage });
      return validation;
    }
    set({
      listings: [newListing, ...listings],
      draft: null,
      error: null,
    });
    return validation;
  },

  clearDraft: () => {
    set({ draft: null, error: null });
  },

  getListingById: (id: string): Listing | undefined => {
    const { listings } = get();
    return listings.find((listing) => listing.id === id);
  },

  updateListing: (id: string, updates: Partial<Listing>): ValidationResult<Listing> => {
    const { listings } = get();
    const listing = listings.find((l) => l.id === id);
    if (!listing) {
      return {
        success: false,
        error: new ListingValidationError([
          { field: 'id', message: `Listing with id ${id} not found` },
        ]),
      };
    }

    const updatedListing: Listing = {
      ...listing,
      ...updates,
      updatedAt: Date.now(),
    };

    const validation = validateListingSafe(updatedListing);
    if (validation.success === false) {
      const errorMessage = validation.error.getFirstError() || 'Validation failed';
      set({ error: errorMessage });
      return validation;
    }
    set({
      listings: listings.map((l) => (l.id === id ? updatedListing : l)),
      error: null,
    });
    return validation;
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));

/**
 * Helper function to create demo drafts with clarification responses
 * These represent the three confidence levels for UI demonstration
 */
export function getDemoDrafts(): DraftListing[] {
  return [
    // High confidence (0.92) - identified item
    {
      title: 'Herman Miller Aeron Chair, Size B',
      category: 'Furniture',
      description: 'Ergonomic office chair with mesh back and adjustable features',
      condition: 'Like new',
      imageUris: [],
      intent: 'owned',
      tags: ['chair', 'office', 'ergonomic', 'herman miller', 'size B'],
      clarificationResponse: {
        type: 'identified',
        item: {
          title: 'Herman Miller Aeron Chair, Size B',
          category: 'Furniture',
          description: 'Ergonomic office chair with mesh back and adjustable features',
          condition: 'Like new',
          tags: ['chair', 'office', 'ergonomic', 'herman miller', 'size B'],
        },
        confidence: 0.92,
      },
    },
    // Medium confidence (0.72) - needs options selection
    {
      title: 'Office Chair',
      category: 'Furniture',
      description: 'Ergonomic office chair with mesh back. Brand/model unclear from photo.',
      condition: 'Good',
      imageUris: [],
      intent: 'owned',
      tags: ['chair', 'office', 'ergonomic'],
      clarificationResponse: {
        type: 'needs_clarification',
        question: 'Which chair matches your item?',
        options: [
          {
            label: 'Herman Miller Aeron Chair',
            id: 'option-1',
            descriptor: 'Mesh back, ergonomic office chair with adjustable arms',
          },
          {
            label: 'Steelcase Leap Chair',
            id: 'option-2',
            descriptor: 'Ergonomic office chair with contoured back',
          },
          {
            label: 'IKEA Markus Chair',
            id: 'option-3',
            descriptor: 'Affordable office chair with mesh back',
          },
          {
            label: 'None of the above',
            id: 'option-4',
            descriptor: 'My chair is different',
          },
        ],
        confidence: 0.72,
      },
    },
    // Low confidence (0.35) - needs question/clarification
    {
      title: 'Unidentified Item',
      category: 'Unknown',
      description: 'Blurry or unclear photo - needs clarification.',
      imageUris: [],
      intent: 'owned',
      tags: [],
      clarificationResponse: {
        type: 'needs_clarification',
        question: 'What type of furniture is this?',
        options: [],
        confidence: 0.35,
      },
    },
  ];
}
