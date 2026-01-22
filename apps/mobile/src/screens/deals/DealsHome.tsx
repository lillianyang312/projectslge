import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Card, Badge, ToggleGroup } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { getMyDeals } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { Deal } from '../../types/models';
import { getSignedUrlCached } from '../../services/imageService';

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

function getStatusBadge(deal: Deal, isSelling: boolean): { label: string; variant: 'warning' | 'success' | 'purple' | 'neutral' } {
  switch (deal.status) {
    case 'negotiating':
      return isSelling
        ? { label: 'New Offer', variant: 'purple' }
        : { label: 'Pending', variant: 'purple' };
    case 'agreed':
      return { label: 'Agreed', variant: 'success' };
    case 'logistics':
      return { label: 'Scheduling', variant: 'warning' };
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
    return isSelling ? `Offer: $${deal.current_offer}` : `Your bid: $${deal.current_offer}`;
  }
  return isSelling ? 'Awaiting offer' : 'Interest sent';
}

export default function DealsHomeScreen({ navigation, route }: Props) {
  const tabRoute = useRoute<DealsRouteProp>();
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

  // Load deals from database
  const loadDeals = useCallback(async (showRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log('📦 [DealsHome] Loading deals for user:', user.id);
      const fetchedDeals = await getMyDeals(user.id);
      setDeals(fetchedDeals);
      console.log('✅ [DealsHome] Loaded', fetchedDeals.length, 'deals');

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
      setImageUrls(newUrls);
    } catch (error) {
      console.error('❌ [DealsHome] Error loading deals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Load deals on mount and when focused
  useFocusEffect(
    useCallback(() => {
      loadDeals();
    }, [loadDeals])
  );

  useEffect(() => {
    // Update mode when params change
    const newMode = initialModeFromRoute || initialModeFromTab;
    if (newMode) {
      setMode(newMode);
    }
  }, [initialModeFromRoute, initialModeFromTab]);

  // Filter deals based on mode
  const filteredDeals = deals.filter((deal) => {
    if (mode === 'selling') {
      return deal.seller_id === user?.id;
    } else {
      return deal.buyer_id === user?.id;
    }
  });

  const sectionLabel = mode === 'selling' ? 'Pending sales' : 'Bids you\'ve sent';

  const handleToggle = (index: number) => {
    setMode(index === 0 ? 'selling' : 'buying');
  };

  const handleDealPress = (dealId: string) => {
    navigation.navigate('DealDetail', { dealId });
  };

  const handleRefresh = () => {
    loadDeals(true);
  };

  const renderDealCard = (deal: Deal) => {
    const isSelling = deal.seller_id === user?.id;
    const badge = getStatusBadge(deal, isSelling);
    const meta = getDealMeta(deal, isSelling);
    const emoji = deal.item?.category ? getEmojiForCategory(deal.item.category) : '📦';
    const title = deal.item?.title || 'Untitled Item';
    const imageUrl = imageUrls[deal.id];

    return (
      <Pressable key={deal.id} onPress={() => handleDealPress(deal.id)}>
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
            </View>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </View>
        </Card>
      </Pressable>
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {filteredDeals.map(renderDealCard)}
        </ScrollView>
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
});
