import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { getMyDeals, DealsCursor, getHighestBuyerOfferForItem } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { Deal } from '../../types/models';
import { getSignedUrlCached } from '../../services/imageService';
import { INBOX_PAGE_SIZE } from '../../lib/constants';
import { dealEvents } from '../../lib/dealEvents';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealsHome'>;
type DealsRouteProp = RouteProp<AppTabsParamList, 'Deals'>;

// Category to emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  'Electronics': '📱',
  'Furniture': '🪑',
  'Clothing': '👕',
  'Books': '📚',
  'Sports': '⚽',
  'Sports & Outdoors': '🚴',
  'Music': '🎸',
  'Art': '🎨',
  'Kitchen': '🍳',
  'Home': '🏠',
  'Home Decor': '🏠',
  'Office': '💼',
  'Games': '🎮',
  'Health & Beauty': '💄',
  'Other': '📦',
};

function getEmojiForCategory(category: string): string {
  return CATEGORY_EMOJI[category] || '📦';
}

function getStatusBadge(deal: Deal): { label: string; variant: 'warning' | 'success' | 'purple' | 'neutral' } {
  switch (deal.status) {
    case 'negotiating':
      return { label: 'Pending', variant: 'purple' };
    case 'agreed':
      return { label: 'Agreed', variant: 'success' };
    case 'logistics':
      return { label: deal.pickup_date ? 'Scheduled' : 'Scheduling', variant: 'warning' };
    case 'completed':
      return { label: 'Complete', variant: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'neutral' };
    default:
      return { label: 'Unknown', variant: 'neutral' };
  }
}

function getDealMeta(deal: Deal): string {
  if (deal.agreed_price) {
    return `Accepted at $${deal.agreed_price}`;
  }
  if (deal.current_offer) {
    const bidText = `Your bid: $${deal.current_offer}`;
    if (deal.interested_for) {
      return `${bidText} · ${deal.interested_for}`;
    }
    return bidText;
  }
  if (deal.interested_for) {
    return `Interest sent · ${deal.interested_for}`;
  }
  return 'Interest sent';
}

export default function DealsHomeScreen({ navigation, route }: Props) {
  const tabRoute = useRoute<DealsRouteProp>();
  const user = useAuthStore((state) => state.user);

  // Always show buying mode (selling is handled via My Items → Offers tab)
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [highestOffers, setHighestOffers] = useState<Record<string, number | null>>({});
  const [cursor, setCursor] = useState<DealsCursor | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const fetchingMoreRef = useRef(false);
  const cursorRef = useRef<DealsCursor | undefined>(undefined);
  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Sync cursor ref with state
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  // Load deals from database
  const loadDeals = useCallback(async (showRefresh = false, append = false, cursorOverride?: DealsCursor | undefined) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous loads
    if (loadingRef.current && !showRefresh) {
      console.log('📦 [DealsHome] loadDeals: already loading, skipping');
      return;
    }

    // Don't load if already fetching more and appending
    if (append && (isFetchingMore || fetchingMoreRef.current)) {
      return;
    }

    loadingRef.current = true;

    if (showRefresh) {
      setRefreshing(true);
    } else if (!append) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      // Use cursorOverride if provided, otherwise use ref (for append) or undefined (for initial load)
      const currentCursor = cursorOverride !== undefined 
        ? cursorOverride 
        : (append ? cursorRef.current : undefined);
      
      console.log('📦 [DealsHome] Loading deals for user:', user.id, { append, cursor: currentCursor });
      
      const response = await getMyDeals(user.id, INBOX_PAGE_SIZE, currentCursor);
      const fetchedDeals = response.deals;
      
      console.log('✅ [DealsHome] Loaded', fetchedDeals.length, 'deals', { hasMore: response.hasMore });

      if (append) {
        // Append new deals, deduplicating by id
        setDeals(prev => {
          const seen = new Set(prev.map(d => d.id));
          const deduped = fetchedDeals.filter(d => !seen.has(d.id));
          return [...prev, ...deduped];
        });
      } else {
        setDeals(fetchedDeals);
      }

      setCursor(response.nextCursor);
      cursorRef.current = response.nextCursor;
      setHasMore(response.hasMore);

      // Load images for items (using cached signed URLs)
      const newUrls: Record<string, string> = {};
      await Promise.all(
        fetchedDeals.map(async (deal) => {
          if (deal.item?.photos && deal.item.photos.length > 0) {
            const url = await getSignedUrlCached(deal.item.photos[0]);
            if (url) {
              newUrls[deal.id] = url;
            }
          }
        })
      );
      setImageUrls(prev => ({ ...prev, ...newUrls }));
    } catch (error) {
      console.error('❌ [DealsHome] Error loading deals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsFetchingMore(false);
      loadingRef.current = false;
    }
  }, [user?.id, isFetchingMore]);

  // Load deals on mount and when focused
  useFocusEffect(
    useCallback(() => {
      if (!user?.id || loadingRef.current) return;

      // Initial load or refresh on focus
      const isInitialLoad = !initialLoadRef.current;

      if (isInitialLoad) {
        initialLoadRef.current = true;
        loadingRef.current = true;
        setLoading(true);
      } else {
        // Silently refresh when returning to screen (don't show loading spinner)
        loadingRef.current = true;
      }

      getMyDeals(user.id, INBOX_PAGE_SIZE, undefined)
        .then(async response => {
          setDeals(response.deals);
          setCursor(response.nextCursor);
          cursorRef.current = response.nextCursor;
          setHasMore(response.hasMore);

          // Load images
          const newUrls: Record<string, string> = {};
          await Promise.all(
            response.deals.map(async (deal) => {
              if (deal.item?.photos && deal.item.photos.length > 0) {
                const url = await getSignedUrlCached(deal.item.photos[0]);
                if (url) {
                  newUrls[deal.id] = url;
                }
              }
            })
          );
          setImageUrls(prev => ({ ...prev, ...newUrls }));

          // Fetch highest buyer offer for buying deals
          const buyingDeals = response.deals.filter(d => d.buyer_id === user.id);
          const uniqueItemIds = [...new Set(buyingDeals.map(d => d.item_id))];
          if (uniqueItemIds.length > 0) {
            const offerResults = await Promise.all(
              uniqueItemIds.map(async (itemId) => {
                const highest = await getHighestBuyerOfferForItem(itemId);
                return { itemId, highest };
              })
            );
            const offerMap: Record<string, number | null> = {};
            offerResults.forEach(r => { offerMap[r.itemId] = r.highest; });
            setHighestOffers(prev => ({ ...prev, ...offerMap }));
          }
        })
        .catch(error => {
          console.error('❌ [DealsHome] Error loading deals:', error);
          if (isInitialLoad) {
            initialLoadRef.current = false; // Reset on error so we can retry
          }
        })
        .finally(() => {
          setLoading(false);
          loadingRef.current = false;
        });
    }, [user?.id]) // Only depend on user.id
  );


  // Reset initial load ref when user changes
  useEffect(() => {
    initialLoadRef.current = false;
  }, [user?.id]);

  // Subscribe to deal update events for real-time updates
  useEffect(() => {
    const handleDealUpdate = () => {
      // Refresh deals when a deal is created/updated
      loadDeals(false, false, undefined);
    };

    const unsubscribe = dealEvents.subscribe(handleDealUpdate);

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [loadDeals]);

  // Filter to only buying deals
  const filteredDeals = deals.filter((deal) => deal.buyer_id === user?.id);

  // Separate pending purchases (accepted deals) from active bids
  const pendingPurchases = filteredDeals.filter(deal =>
    ['agreed', 'logistics'].includes(deal.status)
  );

  const activeBids = filteredDeals.filter(deal =>
    deal.status === 'negotiating'
  );

  const completedDeals = filteredDeals.filter(deal => deal.status === 'completed');

  const handleDealPress = (deal: Deal) => {
    // Mirror Inbox behavior: go straight to the deal chat for this deal
    navigation.navigate('DealChat', { dealId: deal.id });
  };

  const handleRefresh = () => {
    setCursor(undefined);
    cursorRef.current = undefined;
    setHasMore(true);
    initialLoadRef.current = false; // Allow reload after refresh
    loadDeals(true, false, undefined);
  };

  // Fetch more deals when scrolling to end
  const fetchMore = useCallback(() => {
    // Guard against duplicate calls using ref to prevent race conditions
    if (loading || isFetchingMore || fetchingMoreRef.current || !hasMore) {
      console.log('📄 [DealsHome] fetchMore: blocked', { 
        loading, 
        isFetchingMore, 
        fetchingMore: fetchingMoreRef.current,
        hasMore 
      });
      return;
    }

    // If we don't have a cursor after the first page, fetching more will just refetch page 1
    if (!cursor && deals.length > 0) {
      console.log('📄 [DealsHome] fetchMore: blocked (cursor missing)', {
        totalLoaded: deals.length,
        hasMore,
      });
      return;
    }

    // Set ref to prevent multiple simultaneous calls
    fetchingMoreRef.current = true;
    setIsFetchingMore(true);

    const currentCursor = cursorRef.current;
    console.log('📄 [DealsHome] fetchMore: requesting page', { cursor: currentCursor, limit: INBOX_PAGE_SIZE });
    
    // Call loadDeals directly without including it in dependencies
    if (user?.id) {
      getMyDeals(user.id, INBOX_PAGE_SIZE, currentCursor)
        .then(response => {
          const fetchedDeals = response.deals;
          
          // Append new deals, deduplicating by id
          setDeals(prev => {
            const seen = new Set(prev.map(d => d.id));
            const deduped = fetchedDeals.filter(d => !seen.has(d.id));
            return [...prev, ...deduped];
          });

          setCursor(response.nextCursor);
          setHasMore(response.hasMore);

          // Load images for items
          const newUrls: Record<string, string> = {};
          Promise.all(
            fetchedDeals.map(async (deal) => {
              if (deal.item?.photos && deal.item.photos.length > 0) {
                const url = await getSignedUrlCached(deal.item.photos[0]);
                if (url) {
                  newUrls[deal.id] = url;
                }
              }
            })
          ).then(() => setImageUrls(prev => ({ ...prev, ...newUrls })));
        })
        .catch(error => {
          console.error('❌ [DealsHome] Error fetching more deals:', error);
        })
        .finally(() => {
          setIsFetchingMore(false);
          fetchingMoreRef.current = false;
        });
    } else {
      setIsFetchingMore(false);
      fetchingMoreRef.current = false;
    }
  }, [loading, isFetchingMore, hasMore, cursor, deals.length, user?.id]);

  // Build flat list data with section headers
  type ListItem = 
    | { type: 'section'; label: string }
    | { type: 'deal'; deal: Deal };

  const buildListData = (): ListItem[] => {
    const items: ListItem[] = [];

    if (pendingPurchases.length > 0) {
      items.push(...pendingPurchases.map(deal => ({ type: 'deal' as const, deal })));
      if (activeBids.length > 0) {
        items.push({ type: 'section', label: 'Active bids' });
      }
    }
    activeBids.forEach(deal => items.push({ type: 'deal', deal }));

    if (completedDeals.length > 0) {
      items.push({ type: 'section', label: 'Completed' });
      completedDeals.forEach(deal => items.push({ type: 'deal', deal }));
    }

    return items;
  };

  const listData = buildListData();

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'section') {
      return (
        <Text variant="body" size="sm" color="secondary" style={styles.sectionHeader}>
          {item.label}
        </Text>
      );
    }

    const deal = item.deal;
    const badge = getStatusBadge(deal);
    const meta = getDealMeta(deal);
    const emoji = deal.item?.category ? getEmojiForCategory(deal.item.category) : '📦';
    const title = deal.item?.title || 'Untitled Item';
    const imageUrl = imageUrls[deal.id];

    // Format pickup date for display when scheduled
    const formattedPickupDate = deal.pickup_date
      ? new Date(deal.pickup_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <Pressable onPress={() => handleDealPress(deal)}>
        <Card style={styles.dealCard}>
          <View style={styles.itemCard}>
            <View style={styles.itemThumb}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.thumbImage} resizeMode="cover" />
              ) : (
                <Text style={styles.itemEmoji}>{emoji}</Text>
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text variant="bodyMedium" size="lg" style={styles.itemName} numberOfLines={1}>
                {title}
              </Text>
              <Text variant="body" size="sm" color="secondary">
                {meta}
              </Text>
              {/* Item details */}
              {deal.item?.condition && (
                <Text variant="body" size="xs" color="muted">
                  {deal.item.condition.charAt(0).toUpperCase() + deal.item.condition.slice(1).replace('_', ' ')}
                  {deal.item?.estimated_value_min && deal.item?.estimated_value_max
                    ? ` · Est. $${deal.item.estimated_value_min} – $${deal.item.estimated_value_max}`
                    : ''}
                </Text>
              )}
              {/* Show highest offer */}
              {highestOffers[deal.item_id] && (
                <Text variant="body" size="xs" color={
                  deal.buyer_offer === highestOffers[deal.item_id] ? 'success' : 'danger'
                }>
                  Top offer: ${highestOffers[deal.item_id]}
                  {deal.buyer_offer === highestOffers[deal.item_id] ? ' (yours)' : ''}
                </Text>
              )}
              {/* Show pickup time when scheduled */}
              {formattedPickupDate && (
                <Text variant="body" size="xs" color="muted">
                  Pickup: {formattedPickupDate}
                </Text>
              )}
            </View>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          My Offers
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredDeals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text variant="bodyMedium" size="md" style={styles.emptyTitle}>
            No offers yet
          </Text>
          <Text variant="body" size="sm" color="secondary" style={styles.emptyText}>
            Browse items and make offers to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) => 
            item.type === 'section' ? `section-${item.label}-${index}` : item.deal.id
          }
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={fetchMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          removeClippedSubviews={false}
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
    paddingBottom: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dealCard: {
    marginBottom: spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemThumb: {
    width: 56,
    height: 56,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    marginBottom: 4,
  },
  activeBidsLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  completedLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    opacity: 0.6,
  },
});
