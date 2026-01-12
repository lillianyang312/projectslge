/**
 * Tests for error handling utilities
 */

import {
  ListingValidationError,
  validateListingOrThrow,
  validateListingSafe,
  handleListingError,
  safeGetListingData,
} from '../errorHandling';
import { Listing, ListingPhase } from '../schema';

describe('Error Handling', () => {
  describe('ListingValidationError', () => {
    it('should create error with messages', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'category', message: 'Category is required' },
      ];
      const error = new ListingValidationError(errors);

      expect(error).toBeInstanceOf(Error);
      expect(error.errors).toEqual(errors);
      expect(error.name).toBe('ListingValidationError');
    });

    it('should get all error messages', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'category', message: 'Category is required' },
      ];
      const error = new ListingValidationError(errors);

      const messages = error.getErrorMessages();
      expect(messages).toEqual(['Title is required', 'Category is required']);
    });

    it('should get first error message', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'category', message: 'Category is required' },
      ];
      const error = new ListingValidationError(errors);

      expect(error.getFirstError()).toBe('Title is required');
    });

    it('should check if field has error', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'category', message: 'Category is required' },
      ];
      const error = new ListingValidationError(errors);

      expect(error.hasFieldError('title')).toBe(true);
      expect(error.hasFieldError('category')).toBe(true);
      expect(error.hasFieldError('description')).toBe(false);
    });

    it('should get field-specific error', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'category', message: 'Category is required' },
      ];
      const error = new ListingValidationError(errors);

      expect(error.getFieldError('title')).toBe('Title is required');
      expect(error.getFieldError('description')).toBeNull();
    });
  });

  describe('validateListingOrThrow', () => {
    it('should return listing when valid', () => {
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

      const result = validateListingOrThrow(listing);
      expect(result).toBeDefined();
      expect(result.id).toBe('test-1');
    });

    it('should throw ListingValidationError when invalid', () => {
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

      expect(() => validateListingOrThrow(listing)).toThrow(ListingValidationError);
    });
  });

  describe('safeGetListingData', () => {
    it('should extract data with fallbacks for valid listing', () => {
      const listing: Listing = {
        id: 'test-1',
        phase: ListingPhase.NEGOTIATION,
        original: {
          title: 'Test Item',
          category: 'Electronics',
          description: 'A test item',
          imageUris: ['image1.jpg', 'image2.jpg'],
          intent: 'owned',
        },
        clarification: {
          sellerLocation: {
            city: 'Boston',
            state: 'MA',
            displayAddress: 'Boston, MA',
          },
        },
        negotiation: {
          bids: [],
          acceptsOffers: true,
          estimatedMarketValue: 10000,
        },
        sellerId: 'seller-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      const data = safeGetListingData(listing);
      expect(data.id).toBe('test-1');
      expect(data.title).toBe('Test Item');
      expect(data.category).toBe('Electronics');
      expect(data.description).toBe('A test item');
      expect(data.imageUris).toEqual(['image1.jpg', 'image2.jpg']);
      expect(data.hasClarification).toBe(true);
      expect(data.hasNegotiation).toBe(true);
      expect(data.estimatedValue).toBe(10000);
    });

    it('should provide fallbacks for missing data', () => {
      const data = safeGetListingData(null);
      expect(data.id).toBe('unknown');
      expect(data.title).toBe('Untitled Item');
      expect(data.category).toBe('Uncategorized');
      expect(data.description).toBe('No description available');
      expect(data.imageUris).toEqual([]);
      expect(data.hasClarification).toBe(false);
      expect(data.hasNegotiation).toBe(false);
    });

    it('should handle partial listing data', () => {
      const partialListing: Partial<Listing> = {
        id: 'test-1',
        phase: ListingPhase.ORIGINAL,
        original: {
          title: 'Test',
          category: 'Test',
          description: '',
          imageUris: [],
          intent: 'owned',
        },
      };

      const data = safeGetListingData(partialListing);
      expect(data.id).toBe('test-1');
      expect(data.title).toBe('Test');
      expect(data.description).toBe(''); // Empty string is valid, not fallback
    });
  });

  describe('handleListingError', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let alertCallback: jest.Mock;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      alertCallback = jest.fn();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      alertCallback.mockClear();
    });

    it('should handle ListingValidationError', () => {
      const error = new ListingValidationError([
        { field: 'title', message: 'Title is required' },
      ]);

      handleListingError(error, alertCallback);
      expect(alertCallback).toHaveBeenCalledWith(
        'Validation Error',
        'Title is required'
      );
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');

      handleListingError(error, alertCallback);
      expect(alertCallback).toHaveBeenCalledWith('Error', 'Something went wrong');
    });

    it('should handle unknown error types', () => {
      handleListingError('string error', alertCallback);
      expect(alertCallback).toHaveBeenCalledWith('Error', 'An unknown error occurred');
    });

    it('should use console.error when no callback provided', () => {
      const error = new Error('Test error');
      handleListingError(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Test error');
    });
  });
});

