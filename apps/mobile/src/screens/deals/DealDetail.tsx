import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppTabsParamList } from '../../navigation/types';
import { getDealById, cancelDeal } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { Deal } from '../../types/models';
import { getSignedUrl } from '../../services/imageService';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealDetail'>;
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

function getStatusBadge(status: string): { label: string; variant: 'warning' | 'success' | 'purple' | 'default' } {
  switch (status) {
    case 'negotiating':
      return { label: 'Negotiating', variant: 'purple' };
    case 'agreed':
      return { label: 'Agreed', variant: 'success' };
    case 'logistics':
      return { label: 'Scheduling', variant: 'warning' };
    case 'completed':
      return { label: 'Complete', variant: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'default' };
    default:
      return { label: 'Unknown', variant: 'default' };
  }
}

function getAgentStatus(deal: Deal, isSelling: boolean): string {
  switch (deal.status) {
    case 'negotiating':
      if (deal.current_offer) {
        if (isSelling) {
          return `New offer of $${deal.current_offer} received. Review and respond.`;
        } else {
          return 'Waiting for seller to respond to your offer.';
        }
      }
      return isSelling
        ? 'Buyer has expressed interest. Waiting for an offer.'
        : 'You expressed interest. Consider making an offer!';
    case 'agreed':
      return `Deal agreed at $${deal.agreed_price}! Arrange pickup or shipping.`;
    case 'logistics':
      return 'Coordinating pickup/delivery time and location.';
    case 'completed':
      return 'Deal completed successfully!';
    case 'cancelled':
      return 'This deal has been cancelled.';
    default:
      return 'Processing...';
  }
}

function getStatusText(deal: Deal, isSelling: boolean): string {
  switch (deal.status) {
    case 'negotiating':
      if (deal.current_offer) {
        return isSelling ? 'Offer received' : 'Awaiting response';
      }
      return 'Interest expressed';
    case 'agreed':
      return 'Price agreed';
    case 'logistics':
      return 'Scheduling pickup';
    case 'completed':
      return 'Deal completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

export default function DealDetailScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const tabNavigation = useNavigation<TabNavProp>();
  const user = useAuthStore((state) => state.user);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Load deal from database
  useEffect(() => {
    async function loadDeal() {
      setLoading(true);
      try {
        const fetchedDeal = await getDealById(dealId);
        setDeal(fetchedDeal);

        // Load item image
        if (fetchedDeal?.item?.photos?.[0]) {
          const url = await getSignedUrl(fetchedDeal.item.photos[0]);
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Error loading deal:', error);
      } finally {
        setLoading(false);
      }
    }
    loadDeal();
  }, [dealId]);

  const isSelling = deal?.seller_id === user?.id;
  const badge = deal ? getStatusBadge(deal.status) : { label: 'Loading', variant: 'default' as const };
  const agentStatus = deal ? getAgentStatus(deal, isSelling) : '';
  const statusText = deal ? getStatusText(deal, isSelling) : '';

  const handleChatPress = () => {
    navigation.navigate('DealChat', { dealId });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleItemPress = () => {
    // Navigate to List tab and open ItemDetail
    tabNavigation.navigate('List');
  };

  const handleCancelDeal = () => {
    Alert.alert(
      'Cancel Deal',
      'Are you sure you want to cancel this deal? This action cannot be undone.',
      [
        {
          text: 'Keep Deal',
          style: 'cancel',
        },
        {
          text: 'Cancel Deal',
          style: 'destructive',
          onPress: async () => {
            if (deal && user) {
              await cancelDeal(deal.id, user.id);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!deal) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">Deal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const itemTitle = deal.item?.title || 'Untitled Item';
  const itemCategory = deal.item?.category || 'Other';
  const emoji = getEmojiForCategory(itemCategory);

  // Price display logic
  const priceLabel = deal.agreed_price ? 'Agreed price' : 'Proposed price';
  const priceValue = deal.agreed_price
    ? `$${deal.agreed_price}`
    : deal.current_offer
      ? `$${deal.current_offer}`
      : 'No offer yet';

  // Chat button text
  const chatButtonText = isSelling ? 'Chat with buyer' : 'Chat with seller';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading2" style={styles.headerTitle} numberOfLines={1}>
            {itemTitle}
          </Text>
        </View>

        {/* Item Card */}
        <Pressable onPress={handleItemPress}>
          <Card style={styles.itemCard}>
            <View style={styles.itemContent}>
              <View style={styles.itemThumb}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.thumbImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.itemEmoji}>{emoji}</Text>
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text variant="bodyMedium" size="lg" style={styles.itemName} numberOfLines={1}>
                  {itemTitle}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  {isSelling ? "You're selling" : "You're buying"}
                </Text>
              </View>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </View>
          </Card>
        </Pressable>

        {/* Deal Summary */}
        <View style={styles.agentSummary}>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              {priceLabel}
            </Text>
            <Text variant="bodyMedium" size="md">
              {priceValue}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              {isSelling ? 'Buyer' : 'Seller'}
            </Text>
            <Text variant="bodyMedium" size="md">
              Anonymous
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Status
            </Text>
            <Text variant="bodyMedium" size="md">
              {statusText}
            </Text>
          </View>
        </View>

        {/* Agent Status */}
        <View style={styles.agentRecommendation}>
          <Text variant="body" size="sm" color="secondary" style={styles.agentRecLabel}>
            Agent status
          </Text>
          <Text variant="bodyMedium" size="md" style={styles.agentRecValue}>
            {agentStatus}
          </Text>
        </View>

        {/* Buttons */}
        <Button variant="primary" onPress={handleChatPress}>
          {chatButtonText}
        </Button>

        <Button variant="secondary" onPress={handleCancelDeal} style={styles.cancelButton}>
          Cancel deal
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    marginBottom: spacing.xl,
  },
  itemContent: {
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
  agentSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  agentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  agentRecommendation: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  agentRecLabel: {
    marginBottom: spacing.xs,
  },
  agentRecValue: {
    lineHeight: 22,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
