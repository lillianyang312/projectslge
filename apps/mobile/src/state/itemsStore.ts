import { create } from 'zustand';
import {
  Listing,
  ListingPhase,
  OriginalListingData,
  validateListingSafe,
  type ValidationResult,
} from '../schemas/schema';
import { handleListingError, ListingValidationError } from '../schemas/errorHandling';

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

// Draft type for creating new listings
export type DraftListing = Partial<OriginalListingData> & {
  imageUri?: string;
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
    if (validation.success) {
      set({
        listings: [newListing, ...listings],
        draft: null,
        error: null,
      });
    } else {
      set({ error: validation.error.getFirstError() || 'Validation failed' });
    }
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
    if (validation.success) {
      set({
        listings: listings.map((l) => (l.id === id ? updatedListing : l)),
        error: null,
      });
    } else {
      set({ error: validation.error.getFirstError() || 'Validation failed' });
    }
    return validation;
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));
