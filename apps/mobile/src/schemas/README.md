# Listing Schema

A comprehensive, elastic schema system for item listings that supports multiple phases of the listing pipeline.

## Overview

The listing schema is designed to be flexible and extensible, accommodating the different stages an item listing goes through from initial creation to final sale. It provides type safety, validation, and utility functions to work with listings across all phases.

## Architecture

### Three-Phase Pipeline

The schema supports three distinct phases of a listing lifecycle:

1. **Original Listing** (`ListingPhase.ORIGINAL`)
   - Initial listing with basic description from upload system backend
   - Contains: title, category, description, images, condition, notes, tags
   - All listings must have this data regardless of phase

2. **Clarification** (`ListingPhase.CLARIFICATION`)
   - Additional seller information and logistics
   - Contains: seller location, contact methods, pickup/delivery options, availability
   - Builds upon the original listing data

3. **Negotiation** (`ListingPhase.NEGOTIATION`)
   - Market value estimation and bidding system
   - Contains: estimated market value, asking price, bids with buyer information, minimum price
   - Supports both fixed-price and auction-style listings

4. **Completed** (`ListingPhase.COMPLETED`)
   - Final state when listing is sold or closed

### Schema Structure

```typescript
type Listing = {
  id: string;
  phase: ListingPhase;
  original: OriginalListingData;      // Required for all phases
  clarification?: ClarificationData;  // Present in clarification+ phases
  negotiation?: NegotiationData;      // Present in negotiation phase
  createdAt: number;
  updatedAt: number;
  sellerId: string;
  isActive: boolean;
  visibility?: 'public' | 'private' | 'unlisted';
}
```

## Key Features

### 1. Type Safety

The schema uses TypeScript's type system to ensure:
- Phase-appropriate data is available
- Type guards for runtime validation
- Discriminated unions for phase-specific operations

```typescript
// Type guards
hasClarificationData(listing)  // Checks if clarification data exists
hasNegotiationData(listing)    // Checks if negotiation data exists
hasPhase(listing, phase)       // Checks if listing has reached a phase
```

### 2. Validation

Built-in validation ensures data integrity:

```typescript
import { validateListing, validateListingSafe } from './schemas';

// Returns array of validation errors
const errors = validateListing(partialListing);

// Returns success/error result object
const result = validateListingSafe(partialListing);
if (result.success) {
  // Use result.data (fully validated Listing)
} else {
  // Handle result.error (ListingValidationError)
}
```

### 3. Error Handling

Comprehensive error handling utilities:

```typescript
import { ListingValidationError, handleListingError } from './schemas';

try {
  validateListingOrThrow(listing);
} catch (error) {
  if (error instanceof ListingValidationError) {
    console.log(error.getErrorMessages());
    console.log(error.getFieldError('original.title'));
  }
}
```

### 4. Utility Functions

- `formatCurrency(cents, currency?)` - Format monetary values for display
- `getPhaseDisplayText(phase)` - Get human-readable phase name
- `safeGetListingData(listing)` - Extract data with safe fallbacks

## Integration Points

### State Management (`src/state/itemsStore.ts`)

The Zustand store uses the schema for:
- **Storage**: `listings: Listing[]` array holds all listings
- **Actions**: `commitDraft()`, `updateListing()`, `getListingById()` all use schema types
- **Validation**: Store methods validate listings before committing
- **Demo Data**: Seed functions create example listings across all phases

```typescript
import { useItemsStore } from '../state/itemsStore';
import { Listing, ListingPhase } from '../schemas/schema';

const listings = useItemsStore((state) => state.listings);
const commitDraft = useItemsStore((state) => state.commitDraft);

// Creates a validated Listing in ORIGINAL phase
const result = commitDraft('seller-id');
```

### UI Components

#### ItemDetail Screen (`src/screens/home/ItemDetail.tsx`)

Displays listing information based on current phase:
- Shows basic info for all phases
- Displays clarification data (location, shipping) when available
- Shows negotiation data (pricing, bids) in negotiation phase
- Phase-aware rendering with appropriate badges and sections

```typescript
import { 
  Listing, 
  ListingPhase, 
  hasClarificationData, 
  hasNegotiationData,
  formatCurrency 
} from '../../schemas/schema';

// Phase-aware rendering
{hasClarificationData(listing) && (
  <LocationCard location={listing.clarification.sellerLocation} />
)}
{hasNegotiationData(listing) && (
  <BidsList bids={listing.negotiation.bids} />
)}
```

#### MyList Screen (`src/screens/home/MyList.tsx`)

Lists items with phase indicators:
- Filters listings by intent ('owned' vs 'wants')
- Displays phase badges for visual feedback
- Navigates to ItemDetail with listing ID

#### ConfirmAddToList Screen (`src/screens/upload/ConfirmAddToList.tsx`)

Creates new listings:
- Collects original listing data from user input
- Uses schema validation before submission
- Creates listings in `ORIGINAL` phase

### Error Boundary (`src/components/ErrorBoundary.tsx`)

Global error handling for schema-related errors:
- Catches validation errors during rendering
- Displays user-friendly error messages
- Integrates with listing error handling utilities

```typescript
import { handleListingError } from '../schemas/errorHandling';

componentDidCatch(error: Error) {
  handleListingError(error, (title, message) => {
    Alert.alert(title, message);
  });
}
```

## Usage Examples

### Creating a New Listing

```typescript
import { Listing, ListingPhase, validateListingSafe } from './schemas';

const newListing: Partial<Listing> = {
  id: 'listing-123',
  phase: ListingPhase.ORIGINAL,
  original: {
    title: 'Vintage Camera',
    category: 'Electronics',
    description: 'Excellent condition film camera',
    imageUris: ['image1.jpg'],
    intent: 'owned',
    tags: ['camera', 'vintage'],
  },
  sellerId: 'user-456',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isActive: true,
};

const result = validateListingSafe(newListing);
if (result.success) {
  // Listing is valid and ready to use
  const validatedListing = result.data;
}
```

### Transitioning Between Phases

```typescript
import { ListingPhase } from './schemas';

// Move from ORIGINAL to CLARIFICATION
const updatedListing = {
  ...listing,
  phase: ListingPhase.CLARIFICATION,
  clarification: {
    sellerLocation: {
      city: 'Boston',
      state: 'MA',
      displayAddress: 'Boston, MA',
    },
    pickupMethod: 'pickup',
    shippingAvailable: false,
  },
  updatedAt: Date.now(),
};
```

### Working with Bids

```typescript
import { Bid, formatCurrency } from './schemas';

// Add a new bid
const newBid: Bid = {
  id: 'bid-789',
  buyerId: 'buyer-123',
  buyerName: 'John Doe',
  amount: 45000, // $450.00 in cents
  buyerRating: 4.8,
  buyerReviewCount: 25,
  createdAt: Date.now(),
  message: 'Interested in this item!',
  isActive: true,
};

// Display bid amount
console.log(formatCurrency(newBid.amount)); // "$450.00"

// Filter active bids
const activeBids = listing.negotiation?.bids.filter(bid => bid.isActive) || [];
```

### Validation in Forms

```typescript
import { validateListing, ListingValidationError } from './schemas';

function handleSubmit(formData: Partial<Listing>) {
  const errors = validateListing(formData);
  
  if (errors.length > 0) {
    // Display validation errors
    errors.forEach(error => {
      showFieldError(error.field, error.message);
    });
    return;
  }
  
  // Proceed with submission
  submitListing(formData as Listing);
}
```

## Testing

The schema includes comprehensive test coverage:

- **Unit Tests** (`__tests__/schema.test.ts`): Tests for validation, type guards, and utilities
- **Error Handling Tests** (`__tests__/errorHandling.test.ts`): Tests for error classes and handlers
- **Integration Tests**: ItemDetail component tests demonstrate schema usage in UI

Run tests with:
```bash
npm test
```

## File Structure

```
schemas/
├── README.md              # This file
├── schema.ts              # Core schema definitions and validation
├── errorHandling.ts       # Error handling utilities
├── index.ts               # Public exports
└── __tests__/
    ├── schema.test.ts     # Schema validation tests
    └── errorHandling.test.ts  # Error handling tests
```

## Best Practices

1. **Always Validate**: Use `validateListingSafe()` before storing or displaying listings
2. **Type Guards**: Use `hasClarificationData()` and `hasNegotiationData()` before accessing optional fields
3. **Error Handling**: Wrap schema operations in try-catch blocks and use `handleListingError()`
4. **Phase Progression**: Ensure data requirements are met before advancing to next phase
5. **Currency Handling**: Always store monetary values in cents (integers) to avoid floating-point issues

## Future Enhancements

Potential extensions to the schema:
- Bid expiration and auto-rejection
- Multi-currency support
- Listing analytics and metrics
- Buyer/seller ratings integration
- Shipping cost calculations
- Tax and fee structures

## Related Documentation

- [State Management](../state/README.md) - How listings are stored and managed
- [Error Handling](./errorHandling.ts) - Detailed error handling API
- [Testing Guide](../../../testing.md) - How to test schema-dependent components

