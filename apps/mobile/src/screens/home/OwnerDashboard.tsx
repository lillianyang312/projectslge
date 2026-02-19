import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Text, Card, Badge, Button } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { Deal } from '../../types/models';
import { AppTabsParamList } from '../../navigation/types';
import {
  acceptOffer,
} from '../../services/dealsService';
import { updateItem } from '../../services/itemsService';
import { getSignedUrl } from '../../services/imageService';
import {
  getBestOffer,
  countInterestedBuyers,
} from '../../utils/pricingUtils';
import { SellIntent } from '../../state/itemsStore';
import { Item } from '../../services/itemsService';
import { useAuthStore } from '../../state/authStore';
import { broadcastToItemBuyers } from '../../services/broadcastService';

type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

interface OwnerDashboardProps {
  item: Item;
  deals: Deal[];
  onRefresh: () => void;
  onViewDeal: (dealId: string) => void;
  onAcceptOffer: (dealId: string) => void;
  sellIntent: SellIntent;
}


export default function OwnerDashboard({
  item,
  deals,
  onRefresh,
  onViewDeal,
  onAcceptOffer,
  sellIntent,
}: OwnerDashboardProps) {
  const tabNavigation = useNavigation<TabNavProp>();
  const user = useAuthStore((state) => state.user);

  // Check for pending deal (accepted but not yet completed)
  const pendingDeal = deals.find(d => ['agreed', 'logistics'].includes(d.status));
  const hasPendingDeal = !!pendingDeal;

  console.log('📦 [OwnerDashboard] Total deals:', deals.length, 'Pending deal:', hasPendingDeal);

  // When there's a pending deal, collapse offers by default (they become "history")
  const [offersExpanded, setOffersExpanded] = useState(!hasPendingDeal);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingDealImageUrl, setPendingDealImageUrl] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Load pending deal image
  useEffect(() => {
    async function loadPendingDealImage() {
      if (pendingDeal?.item?.photos?.[0]) {
        const url = await getSignedUrl(pendingDeal.item.photos[0]);
        setPendingDealImageUrl(url);
      }
    }
    if (pendingDeal) {
      loadPendingDealImage();
    }
  }, [pendingDeal?.id]);


  // Filter active offers (non-question deals with offers that are still negotiating)
  // Sort by highest offer first
  const activeOffers = deals
    .filter((d) => d.current_offer && !d.is_question && d.status === 'negotiating')
    .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0));

  // All offers for history (includes declined, cancelled etc - excludes the pending deal)
  // Sort by highest offer first
  const allPreviousOffers = deals
    .filter((d) => d.current_offer && !d.is_question && d.id !== pendingDeal?.id)
    .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0));

  // Show history toggle when there's a pending deal and there are previous offers
  const hasHistoryContent = allPreviousOffers.length > 0;

  console.log('📦 [OwnerDashboard] Active offers:', activeOffers.length, 'All previous offers:', allPreviousOffers.length, 'Show history toggle:', hasPendingDeal && hasHistoryContent);

  const topOffer = getBestOffer(activeOffers);
  const buyerCount = countInterestedBuyers(deals);

  const handleBroadcast = async () => {
    if (!broadcastText.trim() || !item?.id || !user?.id) return;
    setBroadcastSending(true);
    try {
      const result = await broadcastToItemBuyers(item.id, user.id, broadcastText.trim());
      if (result.success) {
        Alert.alert('Sent', `Message sent to ${result.recipientsCount} buyer${result.recipientsCount !== 1 ? 's' : ''}.`);
        setBroadcastText('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send broadcast');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleAcceptOffer = async (dealId: string, offerAmount: number) => {
    Alert.alert(
      'Accept Offer',
      `Are you sure you want to accept $${offerAmount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => onAcceptOffer(dealId),
        },
      ]
    );
  };


  const handleNavigateToDeal = (dealId: string) => {
    // Navigate to the Deals tab and then to DealChat
    tabNavigation.navigate('Deals', {
      screen: 'DealChat',
      params: { dealId },
    } as any);
  };

  const getStatusLabel = (status: string, pickupDate?: string | null) => {
    switch (status) {
      case 'agreed': return 'Agreed';
      case 'logistics': return pickupDate ? 'Scheduled' : 'Scheduling';
      case 'completed': return 'Complete';
      default: return status;
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'purple' | 'neutral' => {
    switch (status) {
      case 'agreed': return 'success';
      case 'logistics': return 'warning';
      case 'completed': return 'success';
      default: return 'neutral';
    }
  };

  const renderPendingDealCard = () => {
    if (!pendingDeal) return null;

    console.log('📦 [OwnerDashboard] Pending deal:', pendingDeal.id, 'status:', pendingDeal.status);
    console.log('📦 [OwnerDashboard] Pending deal buyer:', pendingDeal.buyer);
    const buyerName = pendingDeal.buyer?.display_name || 'Buyer';
    console.log('📦 [OwnerDashboard] Display name:', buyerName);
    const agreedPrice = pendingDeal.agreed_price || pendingDeal.current_offer;

    // Format pickup date for display
    const formattedPickupDate = pendingDeal.pickup_date
      ? new Date(pendingDeal.pickup_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <Pressable onPress={() => handleNavigateToDeal(pendingDeal.id)}>
        <Card style={styles.pendingDealCard}>
          <View style={styles.pendingDealHeader}>
            <View style={styles.pendingDealThumb}>
              {pendingDealImageUrl ? (
                <Image
                  source={{ uri: pendingDealImageUrl }}
                  style={styles.pendingDealImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.pendingDealEmoji}>📦</Text>
              )}
            </View>
            <View style={styles.pendingDealInfo}>
              <Text variant="bodyMedium" size="md" numberOfLines={1}>
                Selling to {buyerName}
              </Text>
              <Text variant="body" size="sm" color="success">
                ${agreedPrice}
              </Text>
              {/* Show pickup time when scheduled */}
              {formattedPickupDate && (
                <Text variant="body" size="xs" color="muted">
                  Pickup: {formattedPickupDate}
                </Text>
              )}
            </View>
            <Badge variant={getStatusBadgeVariant(pendingDeal.status)}>
              {getStatusLabel(pendingDeal.status, pendingDeal.pickup_date)}
            </Badge>
          </View>
          <View style={styles.pendingDealAction}>
            <Text variant="body" size="sm" color="accent">
              {pendingDeal.status === 'agreed'
                ? 'Tap to finalize pickup schedule →'
                : formattedPickupDate
                  ? 'Tap to view deal details →'
                  : 'Tap to view pickup details →'}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  const formatOfferTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Yesterday`;
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderOfferCard = (deal: Deal, index: number) => {
    const buyerName = (deal.buyer as any)?.first_name || deal.buyer?.display_name || 'Buyer';
    const buyerYear = deal.buyer?.graduation_year ? `'${String(deal.buyer.graduation_year).slice(-2)}` : '';
    const isTopOffer = index === 0;
    const timeStr = formatOfferTime(deal.updated_at);

    return (
      <View key={deal.id} style={styles.offerTableRow}>
        <View style={styles.offerTableLeft}>
          <Text variant="bodyMedium" size="sm" color="accent" numberOfLines={1}>
            {buyerName} {buyerYear}
          </Text>
        </View>
        <Text variant="body" size="xs" color="muted" style={styles.offerTableTime}>
          {timeStr}
        </Text>
        <Text variant="headingMedium" size="md" style={isTopOffer ? styles.offerAmountTop : styles.offerAmountNormal}>
          ${deal.current_offer}
        </Text>
        <View style={styles.offerTableActions}>
          <Pressable
            style={styles.offerTableChatBtn}
            onPress={() => handleNavigateToDeal(deal.id)}
          >
            <Text variant="bodyMedium" size="xs" color="primary">Chat</Text>
          </Pressable>
          <Pressable
            style={styles.offerTableAcceptBtn}
            onPress={() => handleAcceptOffer(deal.id, deal.current_offer || 0)}
          >
            <Text variant="bodyMedium" size="xs" style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Pending Deal Card - shown at top when deal is accepted */}
      {hasPendingDeal && renderPendingDealCard()}

      {/* Summary Header - only show when no pending deal */}
      {!hasPendingDeal && (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="body" size="sm" color="muted">
                Top Offer
              </Text>
              <Text variant="headingMedium" size="xl" color={topOffer ? 'primary' : 'secondary'}>
                {topOffer ? `$${topOffer}` : 'No offers'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text variant="body" size="sm" color="muted">
                Interested Buyers
              </Text>
              <Text variant="headingMedium" size="xl">
                {buyerCount}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Broadcast to all buyers */}
      {!hasPendingDeal && activeOffers.length > 0 && (
        <Card style={styles.broadcastCard}>
          <Text variant="bodyMedium" size="sm" style={styles.broadcastLabel}>
            Message all {activeOffers.length} interested buyer{activeOffers.length !== 1 ? 's' : ''}
          </Text>
          <TextInput
            style={styles.broadcastInput}
            placeholder="e.g., 'Can you do $25?'"
            placeholderTextColor={colors.textMuted}
            value={broadcastText}
            onChangeText={setBroadcastText}
            multiline
          />
          <Button
            variant="secondary"
            onPress={handleBroadcast}
            disabled={broadcastSending || !broadcastText.trim()}
          >
            {broadcastSending ? 'Sending...' : 'Send to all'}
          </Button>
        </Card>
      )}

      {/* History Toggle - shown when deal is pending and there are previous offers */}
      {hasPendingDeal && hasHistoryContent && (
        <Pressable
          style={styles.historyToggle}
          onPress={() => setShowHistory(!showHistory)}
        >
          <Text variant="body" size="sm" color="accent">
            {showHistory ? 'Hide' : 'Show'} negotiation history ({allPreviousOffers.length} offers)
          </Text>
          <Text style={styles.historyIcon}>{showHistory ? '▲' : '▼'}</Text>
        </Pressable>
      )}

      {/* Offers Section - collapsed into history when pending deal exists */}
      {(!hasPendingDeal || showHistory) && (
        <>
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setOffersExpanded(!offersExpanded)}
          >
            <Text variant="bodyMedium" size="md">
              {offersExpanded ? '▼' : '▶'} {hasPendingDeal ? 'PREVIOUS OFFERS' : 'OFFERS'} ({hasPendingDeal ? allPreviousOffers.length : activeOffers.length})
            </Text>
          </Pressable>

          {offersExpanded && (
            <View style={styles.sectionContent}>
              {(hasPendingDeal ? allPreviousOffers : activeOffers).length === 0 ? (
                <Text variant="body" size="sm" color="muted" style={styles.emptyText}>
                  No offers yet. Share your listing to attract buyers!
                </Text>
              ) : (
                <View style={styles.offerTable}>
                  {(hasPendingDeal ? allPreviousOffers : activeOffers).map((deal, idx) => renderOfferCard(deal, idx))}
                </View>
              )}
            </View>
          )}
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Pending Deal Card Styles
  pendingDealCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.successSoft,
  },
  pendingDealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingDealThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingDealImage: {
    width: '100%',
    height: '100%',
  },
  pendingDealEmoji: {
    fontSize: 20,
  },
  pendingDealInfo: {
    flex: 1,
  },
  pendingDealAction: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  // History Toggle
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },
  historyIcon: {
    fontSize: 10,
    color: colors.accent,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionContent: {
    paddingBottom: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontStyle: 'italic',
  },
  // Offer Table Styles
  offerTable: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  offerTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offerTableLeft: {
    flex: 1,
    minWidth: 0,
  },
  offerTableTime: {
    marginHorizontal: spacing.sm,
  },
  offerAmountTop: {
    color: '#16a34a',
    marginRight: spacing.sm,
  },
  offerAmountNormal: {
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  offerTableActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  offerTableChatBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  offerTableAcceptBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
  },
  acceptBtnText: {
    color: '#FFFFFF',
  },
  // Broadcast Styles
  broadcastCard: {
    marginBottom: spacing.lg,
  },
  broadcastLabel: {
    marginBottom: spacing.sm,
  },
  broadcastInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: colors.card,
  },
});
