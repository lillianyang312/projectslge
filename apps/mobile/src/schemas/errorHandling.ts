/**
 * Error handling utilities for listing schema operations
 */

import { ValidationError, Listing, validateListing } from './schema';

export class ListingValidationError extends Error {
  public errors: ValidationError[];

  constructor(errors: ValidationError[], message?: string) {
    super(message || 'Listing validation failed');
    this.name = 'ListingValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ListingValidationError.prototype);
  }

  /**
   * Get user-friendly error messages
   */
  getErrorMessages(): string[] {
    return this.errors.map((err) => err.message);
  }

  /**
   * Get the first error message
   */
  getFirstError(): string | null {
    return this.errors.length > 0 ? this.errors[0].message : null;
  }

  /**
   * Check if a specific field has an error
   */
  hasFieldError(field: string): boolean {
    return this.errors.some((err) => err.field === field);
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(field: string): string | null {
    const error = this.errors.find((err) => err.field === field);
    return error ? error.message : null;
  }
}

/**
 * Safely validate a listing and throw a ListingValidationError if invalid
 */
export function validateListingOrThrow(listing: Partial<Listing>): Listing {
  const errors = validateListing(listing);
  if (errors.length > 0) {
    throw new ListingValidationError(errors);
  }
  return listing as Listing;
}

/**
 * Safely validate a listing and return a result object
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ListingValidationError };

export function validateListingSafe(listing: Partial<Listing>): ValidationResult<Listing> {
  try {
    const errors = validateListing(listing);
    if (errors.length > 0) {
      return { success: false, error: new ListingValidationError(errors) };
    }
    return { success: true, data: listing as Listing };
  } catch (error) {
    if (error instanceof ListingValidationError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new ListingValidationError(
        [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown validation error' }]
      ),
    };
  }
}

/**
 * Error handler for React Native - displays alert with error message
 */
export function handleListingError(
  error: unknown,
  onShowAlert?: (title: string, message: string) => void
): void {
  if (error instanceof ListingValidationError) {
    const message = error.getErrorMessages().join('\n');
    if (onShowAlert) {
      onShowAlert('Validation Error', message);
    } else {
      console.error('Listing Validation Error:', message);
    }
  } else if (error instanceof Error) {
    if (onShowAlert) {
      onShowAlert('Error', error.message);
    } else {
      console.error('Error:', error.message);
    }
  } else {
    const message = 'An unknown error occurred';
    if (onShowAlert) {
      onShowAlert('Error', message);
    } else {
      console.error(message);
    }
  }
}

/**
 * Type-safe listing data extractor with fallbacks
 */
export function safeGetListingData(listing: Partial<Listing> | null | undefined) {
  return {
    id: listing?.id ?? 'unknown',
    title: listing?.original?.title ?? 'Untitled Item',
    category: listing?.original?.category ?? 'Uncategorized',
    description: listing?.original?.description ?? 'No description available',
    imageUris: listing?.original?.imageUris ?? [],
    phase: listing?.phase ?? 'original',
    hasClarification: !!listing?.clarification,
    hasNegotiation: !!listing?.negotiation,
    sellerLocation: listing?.clarification?.sellerLocation,
    bids: listing?.negotiation?.bids ?? [],
    estimatedValue: listing?.negotiation?.estimatedMarketValue,
    askingPrice: listing?.negotiation?.askingPrice,
  };
}

