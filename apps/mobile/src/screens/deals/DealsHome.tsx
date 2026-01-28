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
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DealsStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Card, Badge, ToggleGroup } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { getMyDeals, DealsCursor } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { Deal } from '../../types/models';
import { getSignedUrlCached } from '../../services/imageService';
import { INBOX_PAGE_SIZE } from '../../lib/constants';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealsHome'>;
type DealsRouteProp = RouteProp<AppTabsParamList, 'Deals'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

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

function getStatusBadge(deal: Deal, isSelling: boolean): { label: string; variant: 'warning' | 'success' | 'purple' | 'neutral' } {
  switch (deal.status) {
    case 'negotiating':
      return isSelling
        ? { label: 'New Offer', variant: 'purple' }
        : { label: 'Pending', variant: 'purple' };
    case 'agreed':
      return { label: 'Agreed', variant: 'success' };
    case 'logistics':
      // Show "Scheduled" when pickup_date is set, otherwise "Scheduling"
      return { label: deal.pickup_date ? 'Scheduled' : 'Scheduling', variant: 'warning' };
    case 'completed':
      return { label: 'Complete', variant: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'neutral' };
    default:
      return { label: 'Unknown', variant: 'neutral' };
  }
}

function getDealMeta(deal: Deal, isSelling: boolean): string {
  if (deal.agreed_price) {
    return isSelling ? `Sold for $${deal.agreed_price}` : `Accepted at $${deal.agreed_price}`;
  }
  if (deal.current_offer) {
    const bidText = isSelling ? `Offer: $${deal.current_offer}` : `Your bid: $${deal.current_offer}`;
    // Add interested_for info for buyers
    if (!isSelling && deal.interested_for) {
      return `${bidText} · ${deal.interested_for}`;
    }
    return bidText;
  }
  // Show interested_for for interest without bid
  if (!isSelling && deal.interested_for) {
    return `Interest sent · ${deal.interested_for}`;
  }
  return isSelling ? 'Awaiting offer' : 'Interest sent';
}

export default function DealsHomeScreen({ navigation, route }: Props) {
  const tabRoute = useRoute<DealsRouteProp>();
  const tabNavigation = useNavigation<TabNavProp>();
  const user = useAuthStore((state) => state.user);

  // Get initialMode from both tab params and route params
  const initialModeFromTab = tabRoute.params?.initialMode;
  const initialModeFromRoute = route.params?.initialMode;
  const initialMode = initialModeFromRoute || initialModeFromTab || 'selling';

  const [mode, setMode] = useState<'selling' | 'buying'>(initialMode);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
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
        .then(response => {
          setDeals(response.deals);
          setCursor(response.nextCursor);
          cursorRef.current = response.nextCursor;
          setHasMore(response.hasMore);

          // Load images
          const newUrls: Record<string, string> = {};
          return Promise.all(
            response.deals.map(async (deal) => {
              if (deal.item?.photos && deal.item.photos.length > 0) {
                const url = await getSignedUrlCached(deal.item.photos[0]);
                if (url) {
                  newUrls[deal.id] = url;
                }
              }
            })
          ).then(() => {
            setImageUrls(prev => ({ ...prev, ...newUrls }));
          });
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

  useEffect(() => {
    // Update mode when params change
    const newMode = initialModeFromRoute || initialModeFromTab;
    if (newMode && newMode !== mode) {
      setMode(newMode);
      // Reset pagination when mode changes
      setCursor(undefined);
      cursorRef.current = undefined;
      setHasMore(true);
      setDeals([]);
      initialLoadRef.current = false; // Allow reload on next focus
      // Reload deals with new mode
      loadDeals(false, false, undefined);
    }
  }, [initialModeFromRoute, initialModeFromTab, mode, user?.id, loadDeals]);

  // Reset initial load ref when user changes
  useEffect(() => {
    initialLoadRef.current = false;
  }, [user?.id]);

  // Filter deals based on mode
  const filteredDeals = deals.filter((deal) => {
    if (mode === 'selling') {
      return deal.seller_id === user?.id;
    } else {
      return deal.buyer_id === user?.id;
    }
  });

  // Separate pending purchases (accepted deals) from active bids
  const pendingPurchases = filteredDeals.filter(deal =>
    mode === 'buying' && ['agreed', 'logistics'].includes(deal.status)
  );

  const activeBids = filteredDeals.filter(deal =>
    mode === 'buying' ? deal.status === 'negotiating' : true
  );

  // For selling mode, separate by status as well
  const pendingSales = filteredDeals.filter(deal =>
    mode === 'selling' && ['agreed', 'logistics'].includes(deal.status)
  );

  const activeOffers = filteredDeals.filter(deal =>
    mode === 'selling' ? deal.status === 'negotiating' : true
  );

  const completedDeals = filteredDeals.filter(deal => deal.status === 'completed');

  const sectionLabel = mode === 'selling' ? 'Pending sales' : 'Bids you\'ve sent';

  const handleToggle = (index: number) => {
    const newMode = index === 0 ? 'selling' : 'buying';
    if (newMode !== mode) {
      setMode(newMode);
      // Reset pagination when mode changes
      setCursor(undefined);
      cursorRef.current = undefined;
      setHasMore(true);
      setDeals([]);
      initialLoadRef.current = false; // Allow reload on next focus
      loadDeals(false, false, undefined);
    }
  };

  const handleDealPress = (deal: Deal) => {
    const isSelling = deal.seller_id === user?.id;
    const itemId = deal.item_id;

    if (isSelling) {
      // Seller: navigate to ItemDetail in List tab
      tabNavigation.navigate('List', {
        screen: 'ItemDetail',
        params: { itemId },
      } as any);
    } else {
      // Buyer: navigate to BrowseItemDetail in Swipe tab
      tabNavigation.navigate('Swipe', {
        screen: 'BrowseItemDetail',
        params: { itemId },
      } as any);
    }
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

    if (mode === 'buying') {
      if (pendingPurchases.length > 0) {
        items.push(...pendingPurchases.map(deal => ({ type: 'deal' as const, deal })));
        if (activeBids.length > 0) {
          items.push({ type: 'section', label: 'Active bids' });
        }
      }
      activeBids.forEach(deal => items.push({ type: 'deal', deal }));
    } else {
      if (pendingSales.length > 0) {
        items.push(...pendingSales.map(deal => ({ type: 'deal' as const, deal })));
        if (activeOffers.filter(d => d.status === 'negotiating').length > 0) {
          items.push({ type: 'section', label: 'Incoming offers' });
        }
      }
      activeOffers.filter(d => d.status === 'negotiating').forEach(deal => {
        items.push({ type: 'deal', deal });
      });
    }

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
    const isSelling = deal.seller_id === user?.id;
    const badge = getStatusBadge(deal, isSelling);
    const meta = getDealMeta(deal, isSelling);
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
          Deals
        </Text>
      </View>

      {/* Toggle: Selling / Buying */}
      <View style={styles.toggleContainer}>
        <ToggleGroup
          options={['Selling', 'Buying']}
          selectedIndex={mode === 'selling' ? 0 : 1}
          onSelect={handleToggle}
        />
      </View>

      {/* Section Label */}
      <Text variant="body" size="sm" color="secondary" style={styles.sectionLabel}>
        {sectionLabel}
      </Text>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredDeals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{mode === 'selling' ? '📤' : '🛒'}</Text>
          <Text variant="bodyMedium" size="md" style={styles.emptyTitle}>
            {mode === 'selling' ? 'No sales yet' : 'No bids yet'}
          </Text>
          <Text variant="body" size="sm" color="secondary" style={styles.emptyText}>
            {mode === 'selling'
              ? 'When buyers express interest in your items, they\'ll show up here.'
              : 'When you express interest in items, your bids will show up here.'}
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
  toggleContainer: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
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
