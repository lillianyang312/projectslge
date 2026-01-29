import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SwipeStackParamList } from '../../navigation/types';
import { Text } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { semanticSearch, SearchResultItem } from '../../services/searchService';
import { useAuthStore } from '../../state/authStore';
import { getSignedUrlCached } from '../../services/imageService';
import { BROWSE_PAGE_SIZE } from '../../lib/constants';
import { getStatusColor } from '../../lib/statusColorMap';
import { getDealsByItemId } from '../../services/dealsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GRID_PADDING = spacing.xxl;
const ITEM_GAP = spacing.md;
// Calculate exact item size: (screen width - padding - gaps) / columns
const ITEM_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (ITEM_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

type Props = NativeStackScreenProps<SwipeStackParamList, 'SwipeMain'>;

export default function BrowseGridScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [displayItems, setDisplayItems] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<{ created_at: string; id: string } | undefined>(undefined);
  const [interpretation, setInterpretation] = useState('');
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayItemsRef = useRef<SearchResultItem[]>([]);
  const user = useAuthStore((state) => state.user);

  // Keep ref in sync with displayItems
  useEffect(() => {
    displayItemsRef.current = displayItems;
  }, [displayItems]);

  // Load signed URLs for item photos (using cached signing)
  const loadImageUrls = useCallback(async (items: SearchResultItem[]) => {
    const newUrls: Record<string, string> = {};

    await Promise.all(
      items.map(async (item) => {
        if (item.photos && item.photos.length > 0) {
          const url = await getSignedUrlCached(item.photos[0]);
          if (url) {
            newUrls[item.id] = url;
          }
        }
      })
    );

    setImageUrls(prev => ({ ...prev, ...newUrls }));
  }, []);

  // Load initial items from database (excluding current user's items and sold items)
  const loadInitialItems = useCallback(async () => {
    setLoading(true);
    try {
      console.log('📦 [BrowseGrid] Loading all items, excluding user:', user?.id);
      const response = await semanticSearch('', BROWSE_PAGE_SIZE, user?.id, undefined);
      // Filter out sold items (completed deals) - server should already filter, but double-check client-side
      const availableItems = response.results.filter(item => item.dealStatus !== 'completed');
      setDisplayItems(availableItems);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore ?? true);
      console.log('✅ [BrowseGrid] Loaded', availableItems.length, 'available items');
      // Load images for items
      loadImageUrls(availableItems);
    } catch (error) {
      console.error('❌ [BrowseGrid] Error loading items:', error);
      setDisplayItems([]);
      setCursor(undefined);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadImageUrls]);

  // Load items on mount
  useEffect(() => {
    loadInitialItems();
  }, [loadInitialItems]);

  // Refresh deal statuses when screen comes into focus (e.g., returning from BrowseItemDetail)
  useFocusEffect(
    useCallback(() => {
      const currentItems = displayItemsRef.current;
      if (!user?.id || currentItems.length === 0) return;

      // Update deal statuses for items in the current view
      const updateDealStatuses = async () => {
        try {
          const itemIds = currentItems.map(item => item.id);
          const dealStatusUpdates: Record<string, string | null> = {};

          // Fetch deal statuses for all items in parallel
          await Promise.all(
            itemIds.map(async (itemId) => {
              try {
                const deals = await getDealsByItemId(itemId);
                const userDeal = deals.find(d => d.buyer_id === user.id && d.status !== 'cancelled');
                if (userDeal) {
                  dealStatusUpdates[itemId] = userDeal.status;
                } else {
                  dealStatusUpdates[itemId] = null;
                }
              } catch (error) {
                console.error(`Error fetching deal status for item ${itemId}:`, error);
                // Keep existing dealStatus on error
                dealStatusUpdates[itemId] = currentItems.find(i => i.id === itemId)?.dealStatus ?? null;
              }
            })
          );

          // Update displayItems with new deal statuses only if they changed
          setDisplayItems(prevItems =>
            prevItems.map(item => {
              const newStatus = dealStatusUpdates[item.id];
              // Only update if status actually changed to avoid unnecessary re-renders
              if (newStatus !== undefined && newStatus !== item.dealStatus) {
                const updatedItem: SearchResultItem = { 
                  ...item, 
                  dealStatus: (newStatus as 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled' | null | undefined) ?? undefined
                };
                return updatedItem;
              }
              return item;
            })
          );
        } catch (error) {
          console.error('Error updating deal statuses:', error);
        }
      };

      // Small delay to avoid running on initial mount (loadInitialItems already fetches statuses)
      const timeoutId = setTimeout(updateDealStatuses, 100);
      return () => clearTimeout(timeoutId);
    }, [user?.id])
  );

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Reload initial items when search is cleared
      loadInitialItems();
      setInterpretation('');
      setSuggestedCategories([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setCursor(undefined);
    setHasMore(true);

    try {
      console.log('🔍 [BrowseGrid] Searching for:', query);
      const response = await semanticSearch(query, BROWSE_PAGE_SIZE, user?.id, undefined);

      // Filter out sold items (completed deals) - server should already filter, but double-check client-side
      const availableItems = response.results.filter(item => item.dealStatus !== 'completed');
      setDisplayItems(availableItems.length > 0 ? availableItems : []);
      setInterpretation(response.interpretation);
      setSuggestedCategories(response.suggestedCategories);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore ?? true);
      // Load images for search results
      if (availableItems.length > 0) {
        loadImageUrls(availableItems);
      }

      console.log('✅ [BrowseGrid] Search complete:', {
        resultCount: availableItems.length,
        interpretation: response.interpretation,
      });
    } catch (error) {
      console.error('❌ [BrowseGrid] Search error:', error);
      setDisplayItems([]);
      setInterpretation('Something went wrong. Please try again.');
      setCursor(undefined);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadInitialItems, loadImageUrls]);

  // Handle search input change with debounce
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 500); // 500ms debounce
  }, [performSearch]);

  // Handle search submit (keyboard enter)
  const handleSearchSubmit = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    Keyboard.dismiss();
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleItemPress = (itemId: string) => {
    navigation.navigate('BrowseItemDetail', { itemId });
  };

  const handleCategoryPress = (category: string) => {
    setSearchQuery(category);
    performSearch(category);
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadInitialItems();
    setInterpretation('');
    setSuggestedCategories([]);
    setHasSearched(false);
    setCursor(undefined);
      setHasMore(true);
  };

  const fetchMore = useCallback(async () => {
    // FlatList can call onEndReached multiple times; guard aggressively.
    if (loading) {
      console.log('📄 [BrowseGrid] fetchMore: blocked (loading=true)');
      return;
    }
    if (isFetchingMore) {
      console.log('📄 [BrowseGrid] fetchMore: blocked (isFetchingMore=true)');
      return;
    }
    if (hasMore === false) {
      console.log('📄 [BrowseGrid] fetchMore: blocked (hasMore=false)');
      return;
    }

    // If we don't have a cursor after the first page, fetching more will just refetch page 1.
    // This typically indicates the backend isn't returning nextCursor/hasMore (e.g. edge function not deployed).
    if (!cursor && displayItems.length > 0) {
      console.log('📄 [BrowseGrid] fetchMore: blocked (cursor missing; would refetch page 1)', {
        totalLoaded: displayItems.length,
        hasMore,
      });
      return;
    }

    const q = hasSearched ? searchQuery : '';
    // If we're in "search mode" but query is empty (e.g. user cleared quickly), treat as browse-all.
    const effectiveQuery = q.trim();

    setIsFetchingMore(true);
    try {
      console.log('📄 [BrowseGrid] fetchMore: requesting page', { effectiveQuery, cursor, limit: BROWSE_PAGE_SIZE });
      const response = await semanticSearch(effectiveQuery, BROWSE_PAGE_SIZE, user?.id, cursor);

      console.log('📄 [BrowseGrid] fetchMore: got page', {
        resultCount: response.results?.length ?? 0,
        hasMore: response.hasMore,
        nextCursor: response.nextCursor,
      });

      if (response.results?.length) {
        setDisplayItems(prev => {
          const seen = new Set(prev.map(i => i.id));
          const dedupedAppend = response.results.filter(i => !seen.has(i.id));
          if (dedupedAppend.length !== response.results.length) {
            console.log('📄 [BrowseGrid] fetchMore: deduped items', {
              appended: dedupedAppend.length,
              received: response.results.length,
            });
          }
          return [...prev, ...dedupedAppend];
        });
        loadImageUrls(response.results);
      }

      setCursor(response.nextCursor);
      setHasMore(response.hasMore ?? true);
    } catch (error) {
      console.error('❌ [BrowseGrid] Error fetching more:', error);
      // Keep existing items; stop further paging until next refresh/search
      setHasMore(false);
    } finally {
      setIsFetchingMore(false);
    }
  }, [loading, isFetchingMore, hasMore, hasSearched, searchQuery, cursor, user?.id, loadImageUrls]);

  const handleEndReached = useCallback(
    (info: { distanceFromEnd: number }) => {
      console.log('📄 [BrowseGrid] onEndReached fired', {
        distanceFromEnd: info?.distanceFromEnd,
        totalLoaded: displayItems.length,
        hasMore,
        cursor,
        loading,
        isFetchingMore,
        hasSearched,
        searchQuery,
      });
      fetchMore();
    },
    [fetchMore, displayItems.length, hasMore, cursor, loading, isFetchingMore, hasSearched, searchQuery]
  );

  // Format price range display (always lower-higher)
  const formatPriceRange = (item: SearchResultItem) => {
    if (item.priceMin && item.priceMax && item.priceMin !== item.priceMax) {
      // Ensure lower number comes first
      const lower = Math.min(item.priceMin, item.priceMax);
      const higher = Math.max(item.priceMin, item.priceMax);
      return `$${lower} – $${higher}`;
    } else if (item.priceMin) {
      return `$${item.priceMin}`;
    } else if (item.priceMax) {
      return `$${item.priceMax}`;
    } else if (item.price) {
      return `$${item.price}`;
    }
    return 'Price TBD';
  };

  const renderItem = ({ item }: { item: SearchResultItem }) => {
    const imageUrl = imageUrls[item.id];
    const hasDeal = item.dealStatus && item.dealStatus !== 'completed' && item.dealStatus !== 'cancelled';
    const statusColor = hasDeal ? getStatusColor(item.dealStatus) : null;

    return (
      <Pressable
        style={[
          styles.galleryItem,
          statusColor
            ? {
                borderColor: statusColor,
                borderWidth: 2,
              }
            : null,
        ]}
        onPress={() => handleItemPress(item.id)}
      >
        <View style={styles.galleryThumb}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[
                styles.galleryImage,
                statusColor
                  ? {
                      borderColor: statusColor,
                      borderWidth: 2,
                    }
                  : null,
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.emojiWrapper,
                statusColor
                  ? {
                      borderColor: statusColor,
                      borderWidth: 2,
                    }
                  : null,
              ]}
            >
              <Text style={styles.galleryEmoji}>{item.emoji}</Text>
            </View>
          )}
        </View>
        {/* Deal status badge - top left */}
        {hasDeal && (
          <View style={[styles.dealStatusBadge, statusColor ? { backgroundColor: statusColor } : null]}>
            <Text style={styles.dealStatusText}>
              {item.dealStatus === 'pending' ? 'Pending' :
               item.dealStatus === 'negotiating' ? 'Negotiating' :
               item.dealStatus === 'agreed' ? 'Agreed' :
               item.dealStatus === 'logistics' ? 'Scheduled' : 'Active'}
            </Text>
          </View>
        )}
        <View style={styles.galleryInfo}>
          <View style={styles.priceTag}>
            <Text style={styles.priceText} numberOfLines={1}>
              {formatPriceRange(item)}
            </Text>
          </View>
          {hasSearched && item.relevanceScore > 0 && (
            <View style={styles.relevanceBadge}>
              <Text style={styles.relevanceText}>{item.relevanceScore}%</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Browse
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Try 'work from home setup' or 'gift for music lover'"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearButton}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* AI Interpretation */}
      {hasSearched && interpretation && (
        <View style={styles.interpretationContainer}>
          <Text style={styles.aiIcon}>🤖</Text>
          <Text variant="body" size="sm" color="secondary" style={styles.interpretationText}>
            {interpretation}
          </Text>
        </View>
      )}

      {/* Suggested Categories */}
      {suggestedCategories.length > 0 && (
        <View style={styles.categoriesContainer}>
          {suggestedCategories.map((category) => (
            <Pressable
              key={category}
              style={styles.categoryPill}
              onPress={() => handleCategoryPress(category)}
            >
              <Text variant="body" size="xs" color="secondary">
                {category}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text variant="body" size="sm" color="secondary" style={styles.loadingText}>
            Searching...
          </Text>
        </View>
      ) : displayItems.length === 0 && hasSearched ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text variant="bodyMedium" size="md" style={styles.emptyTitle}>
            No matches found
          </Text>
          <Text variant="body" size="sm" color="secondary" style={styles.emptyText}>
            Try a different search or browse all items
          </Text>
          <Pressable style={styles.browseAllButton} onPress={clearSearch}>
            <Text variant="bodyMedium" size="sm" color="accent">
              Browse all items
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  searchContainer: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    color: colors.textPrimary,
  },
  clearButton: {
    padding: spacing.sm,
  },
  clearText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  interpretationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentSoft,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },
  aiIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  interpretationText: {
    flex: 1,
    lineHeight: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  browseAllButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  grid: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 100,
  },
  footerLoading: {
    paddingVertical: spacing.lg,
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  galleryItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  emojiWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryEmoji: {
    fontSize: 32,
  },
  galleryInfo: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  priceText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  relevanceBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  relevanceText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dealStatusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    zIndex: 1,
  },
  dealStatusText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
