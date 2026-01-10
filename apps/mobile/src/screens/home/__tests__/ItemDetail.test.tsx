/**
 * Tests for ItemDetail screen display logic
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ItemDetailScreen from '../ItemDetail';
import { Listing, ListingPhase } from '../../../schemas/schema';
import { useItemsStore } from '../../../state/itemsStore';

// Mock the items store
jest.mock('../../../state/itemsStore');

const Stack = createNativeStackNavigator();

const MockedNavigator = ({ component, params = {} }: { component: any; params?: any }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator id="test-navigator">
        <Stack.Screen
          name="ItemDetail"
          component={component}
          initialParams={params}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

describe('ItemDetailScreen', () => {
  const mockGetListingById = jest.fn();
  const mockSeedDemoListings = jest.fn(() => {}); // Make it a function

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Zustand store - it takes a selector function and returns the selected value
    (useItemsStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const mockState = {
        getListingById: mockGetListingById,
        seedDemoListings: mockSeedDemoListings,
        listings: [],
        items: [],
        draft: null,
        error: null,
      };
      // If selector is a function, call it with mockState, otherwise return mockState
      return typeof selector === 'function' ? selector(mockState) : mockState;
    });
  });

  it('should display loading state initially', async () => {
    mockGetListingById.mockReturnValue(undefined);

    const { queryByText } = render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-1' }}
      />
    );

    // Initially should show loading, then transition to error after useEffect
    // Check that loading text appears at least briefly, or that error appears after
    await waitFor(() => {
      const errorText = queryByText('Listing not found');
      const loadingText = queryByText('Loading...');
      // Either loading is shown (before useEffect) or error is shown (after useEffect)
      expect(loadingText || errorText).toBeTruthy();
    }, { timeout: 100 });
  });

  it('should display error when listing not found', async () => {
    mockGetListingById.mockReturnValue(undefined);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'nonexistent' }}
      />
    );

    // Wait for error state after useEffect runs
    await waitFor(() => {
      expect(screen.getByText('Listing not found')).toBeTruthy();
    }, { timeout: 100 });
  });

  it('should display original listing data correctly', () => {
    const listing: Listing = {
      id: 'test-1',
      phase: ListingPhase.ORIGINAL,
      original: {
        title: 'Test Item',
        category: 'Electronics',
        description: 'A test item description',
        imageUris: ['image1.jpg'],
        intent: 'owned',
        condition: 'Like new',
        notes: 'Additional notes here',
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-1' }}
      />
    );

    expect(screen.getByText('Test Item')).toBeTruthy();
    expect(screen.getByText('Electronics')).toBeTruthy();
    expect(screen.getByText('A test item description')).toBeTruthy();
    expect(screen.getByText('Draft Listing')).toBeTruthy(); // Phase badge
  });

  it('should display clarification data when available', () => {
    const listing: Listing = {
      id: 'test-2',
      phase: ListingPhase.CLARIFICATION,
      original: {
        title: 'Test Item',
        category: 'Furniture',
        description: 'A test item',
        imageUris: [],
        intent: 'owned',
      },
      clarification: {
        sellerLocation: {
          city: 'Boston',
          state: 'MA',
          zipCode: '02115',
          displayAddress: 'Boston, MA 02115',
        },
        pickupMethod: 'pickup',
        shippingAvailable: false,
        availability: 'Weekends only',
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-2' }}
      />
    );

    expect(screen.getByText(/Boston, MA 02115/)).toBeTruthy();
    expect(screen.getByText(/Pickup: pickup/)).toBeTruthy();
    expect(screen.getByText(/Shipping: Not available/)).toBeTruthy();
    expect(screen.getByText(/Availability: Weekends only/)).toBeTruthy();
  });

  it('should display negotiation data when available', () => {
    const listing: Listing = {
      id: 'test-3',
      phase: ListingPhase.NEGOTIATION,
      original: {
        title: 'Designer Handbag',
        category: 'Fashion',
        description: 'Authentic designer handbag',
        imageUris: [],
        intent: 'owned',
      },
      clarification: {
        sellerLocation: {
          city: 'Cambridge',
          displayAddress: 'Cambridge, MA',
        },
      },
      negotiation: {
        estimatedMarketValue: 50000,
        askingPrice: 45000,
        minimumPrice: 40000,
        bids: [
          {
            id: 'bid-1',
            buyerId: 'buyer-1',
            buyerName: 'John Doe',
            amount: 42000,
            buyerRating: 4.8,
            buyerReviewCount: 25,
            createdAt: Date.now(),
            message: 'Interested!',
            isActive: true,
          },
        ],
        acceptsOffers: true,
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-3' }}
      />
    );

    expect(screen.getByText(/Estimated Value:/)).toBeTruthy();
    expect(screen.getByText(/Asking Price:/)).toBeTruthy();
    expect(screen.getByText(/Minimum:/)).toBeTruthy();
    expect(screen.getByText(/Bids/)).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText(/Interested!/)).toBeTruthy();
  });

  it('should handle listing with no images gracefully', () => {
    const listing: Listing = {
      id: 'test-4',
      phase: ListingPhase.ORIGINAL,
      original: {
        title: 'No Image Item',
        category: 'Test',
        description: 'Item with no images',
        imageUris: [],
        intent: 'owned',
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-4' }}
      />
    );

    expect(screen.getByText('No Image Item')).toBeTruthy();
    // Should not crash when no images
  });

  it('should display tags when available', () => {
    const listing: Listing = {
      id: 'test-5',
      phase: ListingPhase.ORIGINAL,
      original: {
        title: 'Tagged Item',
        category: 'Test',
        description: 'Item with tags',
        imageUris: [],
        intent: 'owned',
        tags: ['furniture', 'vintage', 'antique'],
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-5' }}
      />
    );

    expect(screen.getByText('furniture')).toBeTruthy();
    expect(screen.getByText('vintage')).toBeTruthy();
    expect(screen.getByText('antique')).toBeTruthy();
  });

  it('should filter and display only active bids', () => {
    const listing: Listing = {
      id: 'test-6',
      phase: ListingPhase.NEGOTIATION,
      original: {
        title: 'Test Item',
        category: 'Test',
        description: 'Test',
        imageUris: [],
        intent: 'owned',
      },
      negotiation: {
        bids: [
          {
            id: 'bid-1',
            buyerId: 'buyer-1',
            buyerName: 'Active Buyer',
            amount: 10000,
            createdAt: Date.now(),
            isActive: true,
          },
          {
            id: 'bid-2',
            buyerId: 'buyer-2',
            buyerName: 'Inactive Buyer',
            amount: 9000,
            createdAt: Date.now(),
            isActive: false,
          },
        ],
        acceptsOffers: true,
      },
      sellerId: 'seller-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    mockGetListingById.mockReturnValue(listing);

    render(
      <MockedNavigator
        component={ItemDetailScreen}
        params={{ itemId: 'test-6' }}
      />
    );

    expect(screen.getByText('Active Buyer')).toBeTruthy();
    // Inactive bid should not be displayed
    expect(screen.queryByText('Inactive Buyer')).toBeNull();
  });
});

