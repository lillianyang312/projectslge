import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge, BroadcastAnnouncement } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppTabsParamList } from '../../navigation/types';
import { Deal } from '../../types/models';
import { getDealById } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { broadcastToDealBuyer } from '../../services/broadcastService';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

// Demo deal details data matching HTML spec lines 1093-1136
const demoDeals: Record<string, {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  status: string;
  badgeVariant: 'warning' | 'success' | 'purple' | undefined;
  agreedPrice: string | undefined;
  otherParty: string | undefined;
  delivery: string;
  statusText: string;
  agentStatus: string;
  chatButtonText: string;
  isSelling: boolean;
}> = {
  '1': {
    id: '1',
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    subtitle: "You're selling",
    status: 'Scheduling',
    badgeVariant: 'warning',
    agreedPrice: '$550',
    otherParty: 'Anonymous · 1.2 mi',
    delivery: 'Local pickup',
    statusText: 'Coordinating time',
    agentStatus: 'Finding a time that works',
    chatButtonText: 'Chat with buyer',
    isSelling: true,
  },
  '2': {
    id: '2',
    emoji: '🎸',
    title: 'Fender Stratocaster',
    subtitle: "You're selling",
    status: 'Complete',
    badgeVariant: 'success',
    agreedPrice: '$425',
    otherParty: 'Mike Johnson · 2.5 mi',
    delivery: 'Local pickup',
    statusText: 'Deal completed',
    agentStatus: 'Payment received, item picked up',
    chatButtonText: 'Chat with buyer',
    isSelling: true,
  },
  '3': {
    id: '3',
    emoji: '🛋️',
    title: 'Mid-century Sofa',
    subtitle: "You're buying",
    status: 'Pending',
    badgeVariant: 'purple',
    agreedPrice: '$580',
    otherParty: 'Emma Wilson · 0.8 mi',
    delivery: 'Local pickup',
    statusText: 'Waiting for seller response',
    agentStatus: 'Bid sent, awaiting response',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
  '4': {
    id: '4',
    emoji: '🖥️',
    title: 'Studio Display',
    subtitle: "You're buying",
    status: 'Pending',
    badgeVariant: 'purple',
    agreedPrice: '$1,050',
    otherParty: 'Tech Seller · 3.1 mi',
    delivery: 'Shipping OK',
    statusText: 'Waiting for seller response',
    agentStatus: 'Bid sent, awaiting response',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
  '5': {
    id: '5',
    emoji: '🚴',
    title: 'Road Bike',
    subtitle: "You're buying",
    status: 'Scheduling',
    badgeVariant: 'warning',
    agreedPrice: '$420',
    otherParty: 'Bike Shop · 1.5 mi',
    delivery: 'Local pickup',
    statusText: 'Coordinating pickup',
    agentStatus: 'Bid accepted, scheduling pickup',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
  '6': {
    id: '6',
    emoji: '📷',
    title: 'Vintage Camera',
    subtitle: "You're buying",
    status: 'Open',
    badgeVariant: undefined,
    agreedPrice: undefined,
    otherParty: undefined,
    delivery: 'Local pickup',
    statusText: 'Listing open for bids',
    agentStatus: 'No bids yet, place your bid',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
};

export default function DealDetailScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const demoDeal = demoDeals[dealId] || demoDeals['1'];
  const tabNavigation = useNavigation<TabNavProp>();
  const user = useAuthStore((state) => state.user);
  const [realDeal, setRealDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [hasSubmittedBid, setHasSubmittedBid] = useState<boolean>(false);
  const [currentBidPrice, setCurrentBidPrice] = useState<string | undefined>(demoDeal.agreedPrice);

  // Use real deal if available, otherwise fall back to demo
  const deal = realDeal 
    ? {
        ...demoDeal,
        isSelling: realDeal.seller_id === user?.id,
        agreedPrice: realDeal.agreed_price ? `$${realDeal.agreed_price}` : undefined,
        status: realDeal.status,
      }
    : demoDeal;

  const isSeller = deal.isSelling;
  const isDealOpen = !deal.agreedPrice && !deal.isSelling;
  const isDealPending = deal.status === 'Pending' && !deal.isSelling;
  const canShowBidForm = isDealOpen || isDealPending;

  useEffect(() => {
    loadDeal();
  }, []);

  async function loadDeal() {
    const dealData = await getDealById(dealId);
    setRealDeal(dealData);
    setLoading(false);
  }

  const handleChatPress = () => {
    navigation.navigate('ChatThread', { conversationId: dealId });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleItemPress = () => {
    // Navigate to List tab and open ItemDetail
    tabNavigation.navigate('List');
    // Note: In a real implementation, we'd pass the itemId and navigate to ItemDetail
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
          onPress: () => {
            // Navigate back to deals list
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleBidSubmit = () => {
    if (bidAmount && parseFloat(bidAmount) > 0) {
      const newBidAmount = parseFloat(bidAmount);
      
      // For pending deals, check if new bid is higher than current bid
      if (isDealPending && currentBidPrice) {
        const currentAmount = parseFloat(currentBidPrice.replace(/[^0-9.]/g, ''));
        if (newBidAmount <= currentAmount) {
          Alert.alert(
            'Invalid Bid',
            `Your new bid must be higher than your current bid of ${currentBidPrice}.`,
            [{ text: 'OK' }]
          );
          return;
        }

        // Show confirmation alert for updating existing bid
        Alert.alert(
          'Update Bid?',
          `Update your bid from ${currentBidPrice} to $${bidAmount}?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Update Bid',
              onPress: () => {
                submitBid(newBidAmount);
              },
            },
          ]
        );
      } else {
        // For open deals, submit directly
        submitBid(newBidAmount);
      }
    }
  };

  const submitBid = (amount: number) => {
    console.log(`Submitting bid of $${amount} for deal ${dealId}`);
    
    // Update UI state
    setHasSubmittedBid(true);
    setCurrentBidPrice(`$${amount.toLocaleString()}`);
    setBidAmount(''); // Clear input
    
    // TODO: Implement actual bid submission logic
  };

  const handleBroadcastSubmit = (message: string) => {
    Alert.alert(
      'Broadcast Message',
      `Send this message to the buyer?\n\n"${message}"`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send',
          onPress: async () => {
            const result = await broadcastToDealBuyer(dealId, message);
            
            if (result.success) {
              Alert.alert(
                'Message Sent',
                `Your announcement has been sent to the buyer.`
              );
            } else {
              Alert.alert('Error', result.error || 'Failed to send broadcast message.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading2">
            Deal
          </Text>
        </View>

        {/* Item Card - matching HTML lines 1099-1108 */}
        <Pressable onPress={handleItemPress}>
          <Card style={styles.itemCard}>
            <View style={styles.itemContent}>
              <View style={styles.itemThumb}>
                <Text style={styles.itemEmoji}>{deal.emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                  {deal.title}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  {deal.subtitle}
                </Text>
              </View>
              {hasSubmittedBid && !deal.badgeVariant ? (
                <Badge variant="purple">Pending</Badge>
              ) : deal.badgeVariant ? (
                <Badge variant={deal.badgeVariant}>{deal.status}</Badge>
              ) : null}
            </View>
          </Card>
        </Pressable>

        {/* Agent Summary - matching HTML lines 1110-1127 */}
        <View style={styles.agentSummary}>
          {(currentBidPrice || deal.agreedPrice) && (
            <View style={styles.agentRow}>
              <Text variant="body" size="sm" color="secondary">
                {hasSubmittedBid || isDealPending ? 'Your bid' : 'Agreed price'}
              </Text>
              <Text variant="bodyMedium" size="md">
                {currentBidPrice || deal.agreedPrice}
              </Text>
            </View>
          )}
          {deal.otherParty && (
            <View style={styles.agentRow}>
              <Text variant="body" size="sm" color="secondary">
                {deal.isSelling ? 'Buyer' : 'Seller'}
              </Text>
              <Text variant="bodyMedium" size="md">
                {deal.otherParty}
              </Text>
            </View>
          )}
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Delivery
            </Text>
            <Text variant="bodyMedium" size="md">
              {deal.delivery}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Status
            </Text>
            <Text variant="bodyMedium" size="md">
              {hasSubmittedBid && !isDealPending 
                ? 'Waiting for seller response' 
                : deal.statusText}
            </Text>
          </View>
        </View>

        {/* Agent Recommendation - matching HTML lines 1129-1132 */}
        <View style={styles.agentRecommendation}>
          <Text variant="body" size="sm" color="secondary" style={styles.agentRecLabel}>
            Agent status
          </Text>
          <Text variant="bodyMedium" size="md" style={styles.agentRecValue}>
            {hasSubmittedBid && !isDealPending 
              ? 'Bid sent, awaiting response' 
              : deal.agentStatus}
          </Text>
        </View>

        {/* Broadcast Announcement for Sellers */}
        {isSeller && (
          <BroadcastAnnouncement onSend={handleBroadcastSubmit} />
        )}

        {/* Bid Form for Open Listings and Pending Deals (Buyer Side Only) */}
        {canShowBidForm && (
          <Card style={styles.bidFormCard}>
            <Text variant="bodyMedium" size="base" style={styles.bidFormLabel}>
              {isDealPending ? 'Update your bid' : 'Place your bid'}
            </Text>
            {isDealPending && currentBidPrice && (
              <Text variant="body" size="sm" color="secondary" style={styles.currentBidText}>
                Current bid: {currentBidPrice}
              </Text>
            )}
            <View style={styles.bidForm}>
              <View style={styles.bidInputContainer}>
                <Text variant="headingMedium" size="heading3" style={styles.dollarSign}>
                  $
                </Text>
                <TextInput
                  style={styles.bidInput}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.bidButton,
                  pressed && styles.bidButtonPressed,
                  (!bidAmount || parseFloat(bidAmount || '0') <= 0) && styles.bidButtonDisabled,
                  isDealPending && currentBidPrice && parseFloat(bidAmount || '0') <= parseFloat(currentBidPrice.replace(/[^0-9.]/g, '') || '0') && styles.bidButtonDisabled,
                ]}
                onPress={handleBidSubmit}
                disabled={
                  !bidAmount || 
                  parseFloat(bidAmount || '0') <= 0 ||
                  (isDealPending && currentBidPrice && parseFloat(bidAmount || '0') <= parseFloat(currentBidPrice.replace(/[^0-9.]/g, '') || '0'))
                }
              >
                <Text style={styles.bidIcon}>💵</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Buttons - matching HTML lines 1134-1135 */}
        {!canShowBidForm && (
          <>
            <Button variant="primary" onPress={handleChatPress}>
              {deal.chatButtonText}
            </Button>

            <Button variant="secondary" onPress={handleCancelDeal} style={styles.cancelButton}>
              Cancel deal
            </Button>
          </>
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
  bidFormCard: {
    marginBottom: spacing.xl,
  },
  bidFormLabel: {
    marginBottom: spacing.sm,
  },
  currentBidText: {
    marginBottom: spacing.md,
  },
  bidForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bidInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  dollarSign: {
    marginRight: spacing.xs,
    color: colors.textSecondary,
  },
  bidInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.textPrimary,
  },
  bidButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidButtonPressed: {
    opacity: 0.8,
  },
  bidButtonDisabled: {
    opacity: 0.4,
  },
  bidIcon: {
    fontSize: 20,
  },
});
