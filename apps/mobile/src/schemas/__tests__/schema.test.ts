/**
 * Tests for listing schema validation and utilities
 */

import {
  Listing,
  ListingPhase,
  validateListing,
  hasPhase,
  hasClarificationData,
  hasNegotiationData,
  formatCurrency,
  getPhaseDisplayText,
  isListingPhase,
} from '../schema';
import { ListingValidationError, validateListingSafe } from '../errorHandling';

describe('Listing Schema', () => {
  describe('isListingPhase', () => {
    it('should return true for valid phases', () => {
      expect(isListingPhase(ListingPhase.ORIGINAL)).toBe(true);
      expect(isListingPhase(ListingPhase.CLARIFICATION)).toBe(true);
      expect(isListingPhase(ListingPhase.NEGOTIATION)).toBe(true);
      expect(isListingPhase(ListingPhase.COMPLETED)).toBe(true);
    });

    it('should return false for invalid phases', () => {
      expect(isListingPhase('invalid')).toBe(false);
      expect(isListingPhase('')).toBe(false);
    });
  });

  describe('hasPhase', () => {
    const listing: Listing = {
      id: 'test-1',
      phase: ListingPhase.NEGOTIATION,
      original: {
        title: 'Test Item',
        category: 'Test',
        description: 'Test description',
        imageUris: ['uri1'],
        intent: 'owned',
      },
      clarification: {
        sellerLocation: {
          city: 'Boston',
          state: 'MA',
          country: 'USA',
          displayAddress: 'Boston, MA',
        },
      },
      negotiation: {
        bids: [],
        acceptsOffers: true,
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    it('should correctly identify phases for negotiation listing', () => {
      expect(hasPhase(listing, ListingPhase.ORIGINAL)).toBe(true);
      expect(hasPhase(listing, ListingPhase.CLARIFICATION)).toBe(true);
      expect(hasPhase(listing, ListingPhase.NEGOTIATION)).toBe(true);
      expect(hasPhase(listing, ListingPhase.COMPLETED)).toBe(false);
    });

    it('should correctly identify phases for original listing', () => {
      const originalListing: Listing = {
        ...listing,
        phase: ListingPhase.ORIGINAL,
        clarification: undefined,
        negotiation: undefined,
      };
      expect(hasPhase(originalListing, ListingPhase.ORIGINAL)).toBe(true);
      expect(hasPhase(originalListing, ListingPhase.CLARIFICATION)).toBe(false);
      expect(hasPhase(originalListing, ListingPhase.NEGOTIATION)).toBe(false);
    });
  });

  describe('hasClarificationData', () => {
    it('should return true when clarification data exists', () => {
      const listing: Listing = {
        id: 'test-1',
        phase: ListingPhase.CLARIFICATION,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: [],
          intent: 'owned',
        },
        clarification: {
          sellerLocation: {
            city: 'Boston',
            displayAddress: 'Boston, MA',
          },
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      expect(hasClarificationData(listing)).toBe(true);
      if (hasClarificationData(listing)) {
        expect(listing.clarification.sellerLocation.city).toBe('Boston');
      }
    });

    it('should return false when clarification data is missing', () => {
      const listing: Listing = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: [],
          intent: 'owned',
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      expect(hasClarificationData(listing)).toBe(false);
    });
  });

  describe('hasNegotiationData', () => {
    it('should return true when negotiation data exists', () => {
      const listing: Listing = {
        id: 'test-1',
        phase: ListingPhase.NEGOTIATION,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: [],
          intent: 'owned',
        },
        negotiation: {
          bids: [],
          acceptsOffers: true,
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      expect(hasNegotiationData(listing)).toBe(true);
      if (hasNegotiationData(listing)) {
        expect(listing.negotiation.acceptsOffers).toBe(true);
      }
    });

    it('should return false when negotiation data is missing', () => {
      const listing: Listing = {
        id: 'test-1',
        phase: ListingPhase.CLARIFICATION,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: [],
          intent: 'owned',
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      expect(hasNegotiationData(listing)).toBe(false);
    });
  });

  describe('validateListing', () => {
    it('should return no errors for valid original listing', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: 'Test Item',
          category: 'Test Category',
          description: 'Test description',
          imageUris: ['image1.jpg'],
          intent: 'owned',
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      const errors = validateListing(listing);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: '',
          category: '',
          description: '',
          imageUris: [],
          intent: 'owned',
        },
      };

      const errors = validateListing(listing);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'original.title')).toBe(true);
      expect(errors.some((e) => e.field === 'original.category')).toBe(true);
      expect(errors.some((e) => e.field === 'original.description')).toBe(true);
      expect(errors.some((e) => e.field === 'original.imageUris')).toBe(true);
    });

    it('should require clarification data for clarification phase', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.CLARIFICATION,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: ['image1.jpg'],
          intent: 'owned',
        },
        sellerId: 'seller-1',
      };

      const errors = validateListing(listing);
      expect(errors.some((e) => e.field.includes('clarification'))).toBe(true);
    });

    it('should require negotiation data for negotiation phase', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.NEGOTIATION,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: ['image1.jpg'],
          intent: 'owned',
        },
        sellerId: 'seller-1',
      };

      const errors = validateListing(listing);
      expect(errors.some((e) => e.field.includes('negotiation'))).toBe(true);
    });

    it('should validate intent is either owned or wants', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: 'Test',
          category: 'Test',
          description: 'Test',
          imageUris: ['image1.jpg'],
          intent: 'invalid' as any,
        },
        sellerId: 'seller-1',
      };

      const errors = validateListing(listing);
      expect(errors.some((e) => e.field === 'original.intent')).toBe(true);
    });
  });

  describe('validateListingSafe', () => {
    it('should return success for valid listing', () => {
      const listing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: 'Test Item',
          category: 'Test Category',
          description: 'Test description',
          imageUris: ['image1.jpg'],
          intent: 'owned',
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      const result = validateListingSafe(listing);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test-1');
      }
    });

    it('should return error for invalid listing', () => {
      const listing: Partial<Listing> = {
        id: '',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: '',
          category: '',
          description: '',
          imageUris: [],
          intent: 'owned',
        },
      };

      const result = validateListingSafe(listing);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toBeInstanceOf(ListingValidationError);
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('formatCurrency', () => {
    it('should format cents to currency string', () => {
      expect(formatCurrency(10000)).toBe('$100');
      expect(formatCurrency(12345)).toBe('$123.45');
      expect(formatCurrency(500)).toBe('$5');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should handle different currencies', () => {
      expect(formatCurrency(10000, 'EUR')).toContain('100');
    });
  });

  describe('getPhaseDisplayText', () => {
    it('should return correct display text for each phase', () => {
      expect(getPhaseDisplayText(ListingPhase.ORIGINAL)).toBe('Draft Listing');
      expect(getPhaseDisplayText(ListingPhase.CLARIFICATION)).toBe('Clarification');
      expect(getPhaseDisplayText(ListingPhase.NEGOTIATION)).toBe('Active Listing');
      expect(getPhaseDisplayText(ListingPhase.COMPLETED)).toBe('Completed');
    });
  });
});

