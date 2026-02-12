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
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge, Tabs } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppTabsParamList } from '../../navigation/types';
import { getDealById, cancelDeal, getHighestBuyerOfferForItem } from '../../services/dealsService';
import { getItemById, Item } from '../../services/itemsService';
import { useAuthStore } from '../../state/authStore';
import { Deal } from '../../types/models';
import { getSignedUrlCached } from '../../services/imageService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<DealsStackParamList, 'DealDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

// Helper to check if deal is accepted (profile visible)
function isDealAccepted(status: string): boolean {
  return ['agreed', 'logistics', 'completed'].includes(status);
}

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

function getStatusBadge(status: string): { label: string; variant: 'warning' | 'success' | 'purple' | 'neutral' } {
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
      return { label: 'Cancelled', variant: 'neutral' };
    default:
      return { label: 'Unknown', variant: 'neutral' };
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
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0); // 0 = Deal Summary, 1 = Item Details
  const [itemDetail, setItemDetail] = useState<Item | null>(null);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [highestOfferOnItem, setHighestOfferOnItem] = useState<number | null>(null);

  // Load deal from database
  useEffect(() => {
    async function loadDeal() {
      setLoading(true);
      try {
        const fetchedDeal = await getDealById(dealId);
        setDeal(fetchedDeal);

        // Load all item images (using cached signed URLs)
        if (fetchedDeal?.item?.photos && fetchedDeal.item.photos.length > 0) {
          const urls = await Promise.all(
            fetchedDeal.item.photos.map((path: string) => getSignedUrlCached(path))
          );
          const validUrls = urls.filter((u): u is string => u !== null);
          setAllImageUrls(validUrls);
          setImageUrl(validUrls[0] || null);
        }

        // Fetch highest buyer offer for buying deals
        if (fetchedDeal && fetchedDeal.buyer_id === user?.id) {
          const highest = await getHighestBuyerOfferForItem(fetchedDeal.item_id);
          setHighestOfferOnItem(highest);
        }

        // Load full item details for Item Details tab
        if (fetchedDeal?.item_id) {
          const { data } = await getItemById(fetchedDeal.item_id);
          if (data) {
            setItemDetail(data);
          }
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
  const badge = deal ? getStatusBadge(deal.status) : { label: 'Loading', variant: 'neutral' as const };
  const agentStatus = deal ? getAgentStatus(deal, isSelling) : '';
  const statusText = deal ? getStatusText(deal, isSelling) : '';

  const handleChatPress = () => {
    navigation.navigate('DealChat', { dealId });
  };

  const handleBackPress = () => {
    navigation.goBack();
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

  const handleViewProfile = (userId: string) => {
    navigation.navigate('Profile', { userId });
  };

  // Get counterparty info (the other party in the deal)
  const getCounterpartyInfo = () => {
    if (!deal) return { name: 'Anonymous', id: null };

    const isAccepted = isDealAccepted(deal.status);
    const counterparty = isSelling ? deal.buyer : deal.seller;

    if (isAccepted && counterparty?.display_name) {
      return { name: counterparty.display_name, id: counterparty.id };
    }

    return { name: 'Anonymous', id: null };
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
  const counterparty = getCounterpartyInfo();
  const isAccepted = isDealAccepted(deal.status);

  // Price display logic
  const priceLabel = deal.agreed_price ? 'Agreed price' : 'Your offer';
  const priceValue = deal.agreed_price
    ? `$${deal.agreed_price}`
    : deal.current_offer
      ? `$${deal.current_offer}`
      : 'No offer yet';

  // Chat button text
  const chatButtonText = isSelling ? 'Chat with buyer' : 'Chat with seller';

  // Item details for the right tab
  const itemCondition = itemDetail?.condition || deal.item?.condition || 'Good';
  const itemNotes = itemDetail?.notes || '';
  const itemEstimate = itemDetail?.estimated_value_min && itemDetail?.estimated_value_max
    ? `$${itemDetail.estimated_value_min} – $${itemDetail.estimated_value_max}`
    : null;
  const itemRetailPrice = itemDetail?.retail_price;

  return (
    <SafeAreaView style={styles.screen}>
      {/* Fullscreen Photo Modal */}
      <Modal
        visible={showFullscreenPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullscreenPhoto(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <View style={styles.fullscreenModal}>
          <Pressable
            style={styles.fullscreenCloseArea}
            onPress={() => setShowFullscreenPhoto(false)}
          >
            <Image
              source={{ uri: imageUrl || '' }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={() => setShowFullscreenPhoto(false)}
          >
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

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

        {/* Tabs */}
        <Tabs
          tabs={['Deal Summary', 'Item Details']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab 0: Deal Summary */}
        {activeTab === 0 && (
          <View>
            {/* Item Card */}
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
              {!isSelling && highestOfferOnItem && (
                <View style={styles.agentRow}>
                  <Text variant="body" size="sm" color="secondary">
                    Top offer on item
                  </Text>
                  <Text variant="bodyMedium" size="md" color={
                    deal.buyer_offer === highestOfferOnItem ? 'success' : 'danger'
                  }>
                    ${highestOfferOnItem}{deal.buyer_offer === highestOfferOnItem ? ' (yours)' : ''}
                  </Text>
                </View>
              )}
              <View style={styles.agentRow}>
                <Text variant="body" size="sm" color="secondary">
                  {isSelling ? 'Buyer' : 'Seller'}
                </Text>
                {isAccepted && counterparty.id ? (
                  <Pressable onPress={() => handleViewProfile(counterparty.id!)}>
                    <Text variant="bodyMedium" size="md" style={styles.profileLink}>
                      {counterparty.name} →
                    </Text>
                  </Pressable>
                ) : (
                  <Text variant="bodyMedium" size="md">
                    {counterparty.name}
                  </Text>
                )}
              </View>
              {deal.interested_for && (
                <View style={styles.agentRow}>
                  <Text variant="body" size="sm" color="secondary">
                    Interested for
                  </Text>
                  <Text variant="bodyMedium" size="md">
                    {deal.interested_for}
                  </Text>
                </View>
              )}
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
          </View>
        )}

        {/* Tab 1: Item Details (read-only, no express interest button) */}
        {activeTab === 1 && (
          <View>
            {/* Item Image(s) - Carousel or single */}
            {allImageUrls.length > 1 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={true}
                style={{ marginBottom: spacing.xl }}
              >
                {allImageUrls.map((url, index) => (
                  <Pressable
                    key={index}
                    onPress={() => { setImageUrl(url); setShowFullscreenPhoto(true); }}
                    style={[styles.detailImage, { width: SCREEN_WIDTH - 2 * spacing.xxl, marginRight: spacing.sm }]}
                  >
                    <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Pressable
                style={styles.detailImage}
                onPress={() => imageUrl && setShowFullscreenPhoto(true)}
              >
                {imageUrl ? (
                  <>
                    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
                    <View style={styles.tapToExpandHint}>
                      <Text style={styles.tapToExpandText}>Tap to view full photo</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.imageEmoji}>{emoji}</Text>
                )}
              </Pressable>
            )}

            <Text variant="headingMedium" size="heading3" style={styles.detailTitle}>
              {itemTitle}
            </Text>

            <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
              {itemCategory}
            </Text>

            {/* Notes section */}
            {itemNotes ? (
              <Text variant="body" size="md" color="secondary" style={styles.notesText}>
                {itemNotes}
              </Text>
            ) : null}

            {/* Item Facts */}
            <View style={styles.itemFactsSummary}>
              {itemEstimate && (
                <View style={styles.factRow}>
                  <Text variant="body" size="md" color="secondary">
                    Estimated value
                  </Text>
                  <Text variant="bodyMedium" size="md">
                    {itemEstimate}
                  </Text>
                </View>
              )}
              {itemRetailPrice && (
                <View style={styles.factRow}>
                  <Text variant="body" size="md" color="secondary">
                    Retail price
                  </Text>
                  <Text variant="bodyMedium" size="md">
                    ${itemRetailPrice}
                  </Text>
                </View>
              )}
              <View style={styles.factRow}>
                <Text variant="body" size="md" color="secondary">
                  Condition
                </Text>
                <Text variant="bodyMedium" size="md">
                  {itemCondition}
                </Text>
              </View>
              {(itemDetail?.min_price || itemDetail?.user_min_price) && (
                <View style={styles.factRow}>
                  <Text variant="body" size="md" color="secondary">
                    Minimum price
                  </Text>
                  <Text variant="bodyMedium" size="md">
                    ${itemDetail?.min_price || itemDetail?.user_min_price}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
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
  profileLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  // Item Details tab styles
  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageEmoji: {
    fontSize: 80,
  },
  detailTitle: {
    marginBottom: 4,
  },
  detailCategory: {
    marginBottom: spacing.xl,
  },
  notesText: {
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  itemFactsSummary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tapToExpandHint: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapToExpandText: {
    fontSize: 11,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  // Fullscreen photo modal
  fullscreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
});
