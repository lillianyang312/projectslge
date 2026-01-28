import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SwipeStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Button, Input, Card } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { getItemById, Item } from '../../services/itemsService';
import { getSignedUrlCached } from '../../services/imageService';
import { expressInterest } from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<SwipeStackParamList, 'BrowseItemDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

// Demo data matching HTML spec lines 862-900
const demoItems: Record<string, {
  emoji: string;
  title: string;
  category: string;
  distance: string;
  marketEstimate: string;
  condition: string;
  description: string;
}> = {
  '1': {
    emoji: '🛋️',
    title: 'Mid-century Modern Sofa',
    category: 'Furniture',
    distance: '~0.8 mi away',
    marketEstimate: '$600 – $750',
    condition: 'Good',
    description: 'Walnut frame, original cushions, minor wear on armrests. Non-smoking home.',
  },
  '2': {
    emoji: '🖥️',
    title: 'Studio Display',
    category: 'Electronics',
    distance: '~1.2 mi away',
    marketEstimate: '$1000 – $1200',
    condition: 'Like new',
    description: 'Apple Studio Display, barely used, includes original box.',
  },
  '3': {
    emoji: '🚴',
    title: 'Road Bike',
    category: 'Sports',
    distance: '~2.5 mi away',
    marketEstimate: '$400 – $550',
    condition: 'Good',
    description: 'Specialized road bike, well maintained, new tires.',
  },
};

export default function BrowseItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const tabNavigation = useNavigation<TabNavProp>();
  const user = useAuthStore((state) => state.user);

  const [showBidForm, setShowBidForm] = useState(false);
  const [maxBid, setMaxBid] = useState('');
  const [interestedFor, setInterestedFor] = useState<'1 week' | '2 weeks' | '1 month' | 'Flexible'>('2 weeks');
  const [supabaseItem, setSupabaseItem] = useState<Item | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);

  // Fetch item data from Supabase
  useEffect(() => {
    async function fetchItem() {
      const { data } = await getItemById(itemId);
      if (data) {
        setSupabaseItem(data);
        if (data.photos?.[0]) {
          const url = await getSignedUrlCached(data.photos[0]);
          setImageUrl(url);
        }
      }
      setLoading(false);
    }
    fetchItem();
  }, [itemId]);

  // Build item data from Supabase or fall back to demo
  const demoItem = demoItems[itemId] || demoItems['1'];
  const itemData = supabaseItem
    ? {
        emoji: '📦',
        title: supabaseItem.title,
        category: supabaseItem.category,
        marketEstimate: supabaseItem.estimated_value_min && supabaseItem.estimated_value_max
          ? `$${supabaseItem.estimated_value_min} – $${supabaseItem.estimated_value_max}`
          : '$50 – $150',
        condition: supabaseItem.condition || 'Good',
        notes: supabaseItem.notes || '',
        minPrice: supabaseItem.min_price,
        retailPrice: supabaseItem.retail_price,
        estimatedValueMax: supabaseItem.estimated_value_max,
        imageUri: imageUrl,
      }
    : { ...demoItem, minPrice: undefined as number | undefined, retailPrice: undefined as number | undefined, estimatedValueMax: undefined as number | undefined, imageUri: null as string | null, notes: demoItem.description };

  // Calculate the likely offer range the seller will accept
  const getLikelyOfferRange = () => {
    if (itemData.minPrice && itemData.estimatedValueMax) {
      return `$${itemData.minPrice} – $${itemData.estimatedValueMax}`;
    } else if (itemData.minPrice) {
      return `$${itemData.minPrice}+`;
    }
    return null;
  };

  const likelyOfferRange = getLikelyOfferRange();

  const handleSendInterest = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to express interest');
      return;
    }

    const bidAmount = maxBid ? parseInt(maxBid.replace(/[^0-9]/g, ''), 10) : undefined;

    if (!bidAmount || bidAmount <= 0) {
      Alert.alert('Bid Required', 'Please enter a bid amount to express interest');
      return;
    }

    setSubmitting(true);
    try {

      console.log('📤 Submitting bid:', { itemId, bidAmount, interestedFor });

      const { deal, error } = await expressInterest(
        user.id,
        itemId,
        bidAmount,
        interestedFor
      );

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      if (deal) {
        Alert.alert(
          'Success!',
          `Your bid of $${bidAmount} has been submitted. The seller will be notified.`,
          [
            {
              text: 'View Deals',
              onPress: () => tabNavigation.navigate('Deals', { initialMode: 'buying' }),
            },
          ]
        );
        setShowBidForm(false);
        setMaxBid('');
      }
    } catch (err) {
      console.error('Error submitting bid:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to ask a question');
      return;
    }

    // Create a deal first (without a bid), then navigate to chat
    setSubmitting(true);
    try {
      const { deal, error } = await expressInterest(user.id, itemId);

      if (error) {
        // If deal already exists, navigate to deals tab
        if (error === 'You already have a pending bid on this item') {
          Alert.alert(
            'Existing Conversation',
            'You already have an active conversation with this seller.',
            [
              {
                text: 'View Deals',
                onPress: () => tabNavigation.navigate('Deals', { initialMode: 'buying' }),
              },
            ]
          );
        } else {
          Alert.alert('Error', error);
        }
        return;
      }

      if (deal) {
        Alert.alert(
          'Question Sent',
          'The seller has been notified. You can continue the conversation in your Deals.',
          [
            {
              text: 'View Deals',
              onPress: () => tabNavigation.navigate('Deals', { initialMode: 'buying' }),
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error asking question:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showBidForm) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => setShowBidForm(false)} style={styles.backBtn}>
              <Text size="xl">←</Text>
            </Pressable>
            <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
              Express Interest
            </Text>
          </View>

          {/* Scrollable Form */}
          <ScrollView style={styles.compactForm} contentContainerStyle={styles.compactFormContent}>
            {/* Item Summary - Smaller */}
            <Card style={styles.compactItemCard}>
              <View style={styles.compactItemRow}>
                <Text style={styles.compactEmoji}>{itemData.emoji}</Text>
                <View style={styles.compactItemInfo}>
                  <Text variant="bodyMedium" size="md" style={styles.compactItemName}>
                    {itemData.title}
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    Est. {itemData.marketEstimate}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Bid - Compact */}
            <View style={styles.compactInputGroup}>
              <Text variant="body" size="sm" color="secondary" style={styles.compactLabel}>
                Your bid
              </Text>
              <Input
                placeholder="$0"
                value={maxBid}
                onChangeText={setMaxBid}
                keyboardType="numeric"
                style={styles.compactInput}
              />
              <Text variant="body" size="xs" color="muted" style={styles.compactHint}>
                Enter the price you're willing to pay
              </Text>
            </View>

            {/* Interested For - NEW */}
            <View style={styles.compactInputGroup}>
              <Text variant="body" size="sm" color="secondary" style={styles.compactLabel}>
                Interested for
              </Text>
              <View style={styles.compactPills}>
                {(['1 week', '2 weeks', '1 month', 'Flexible'] as const).map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.compactPill, interestedFor === option && styles.compactPillActive]}
                    onPress={() => setInterestedFor(option)}
                  >
                    <Text
                      variant="bodyMedium"
                      size="xs"
                      color={interestedFor === option ? undefined : 'secondary'}
                      style={interestedFor === option && styles.compactPillTextActive}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {interestedFor === 'Flexible' && (
                <Text variant="body" size="xs" color="muted" style={styles.compactHint}>
                  Indefinite until manually removed
                </Text>
              )}
            </View>

          </ScrollView>

          {/* Buttons at bottom */}
          <View style={styles.compactButtonArea}>
            <Button variant="primary" onPress={handleSendInterest} disabled={submitting || !maxBid}>
              {submitting ? 'Submitting...' : 'Submit bid'}
            </Button>
            <Button variant="secondary" onPress={handleAskQuestion} disabled={submitting}>
              Ask question
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
              source={{ uri: itemData.imageUri || '' }}
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

      {/* Header - outside ScrollView to match Express Interest */}
      <View style={styles.header}>
        <Pressable onPress={() => {
          // Check if we can go back, otherwise navigate to SwipeMain (browse grid)
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('SwipeMain');
          }
        }} style={styles.backBtn}>
          <Text size="xl">←</Text>
        </Pressable>
        <Text variant="headingMedium" size="heading3" style={styles.headerTitle} numberOfLines={1}>
          {loading ? 'Loading...' : itemData.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Item Image - Tappable for fullscreen */}
        <Pressable
          style={styles.detailImage}
          onPress={() => itemData.imageUri && setShowFullscreenPhoto(true)}
        >
          {itemData.imageUri ? (
            <>
              <Image source={{ uri: itemData.imageUri }} style={styles.image} resizeMode="cover" />
              <View style={styles.tapToExpandHint}>
                <Text style={styles.tapToExpandText}>Tap to view full photo</Text>
              </View>
            </>
          ) : (
            <Text style={styles.imageEmoji}>{itemData.emoji}</Text>
          )}
        </Pressable>

        <Text variant="headingMedium" size="heading3" style={styles.detailTitle}>
          {itemData.title}
        </Text>

        <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
          {itemData.category}
        </Text>

        {/* Notes section */}
        {itemData.notes ? (
          <Text variant="body" size="md" color="secondary" style={styles.notesText}>
            {itemData.notes}
          </Text>
        ) : null}

        {/* Agent Summary */}
        <View style={styles.agentSummary}>
          <View style={styles.agentRow}>
            <Text variant="body" size="md" color="secondary">
              Estimated value
            </Text>
            <Text variant="bodyMedium" size="md">
              {itemData.marketEstimate}
            </Text>
          </View>
          {itemData.retailPrice && (
            <View style={styles.agentRow}>
              <Text variant="body" size="md" color="secondary">
                Retail price
              </Text>
              <Text variant="bodyMedium" size="md">
                ${itemData.retailPrice}
              </Text>
            </View>
          )}
          {likelyOfferRange && (
            <View style={styles.agentRow}>
              <Text variant="body" size="md" color="secondary">
                Likely to accept
              </Text>
              <Text variant="bodyMedium" size="md" color="success">
                {likelyOfferRange}
              </Text>
            </View>
          )}
          <View style={styles.agentRow}>
            <Text variant="body" size="md" color="secondary">
              Condition
            </Text>
            <Text variant="bodyMedium" size="md">
              {itemData.condition}
            </Text>
          </View>
        </View>

        <Button variant="primary" onPress={() => setShowBidForm(true)}>
          Express Interest
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
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  imageEmoji: {
    fontSize: 80,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  detailTitle: {
    marginBottom: 4,
  },
  detailCategory: {
    marginBottom: spacing.xl,
  },
  agentSummary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  agentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notesText: {
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  itemSummaryCard: {
    marginBottom: spacing.xl,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  interestCard: {
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  interestTitle: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Compact form styles
  container: {
    flex: 1,
  },
  compactForm: {
    flex: 1,
  },
  compactFormContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  compactItemCard: {
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  compactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactEmoji: {
    fontSize: 32,
  },
  compactItemInfo: {
    flex: 1,
  },
  compactItemName: {
    marginBottom: 2,
  },
  compactInputGroup: {
    marginBottom: spacing.md,
  },
  compactLabel: {
    marginBottom: spacing.xs,
  },
  compactInput: {
    height: 40,
  },
  compactHint: {
    marginTop: spacing.xs,
  },
  compactPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  compactPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  compactPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  compactPillTextActive: {
    color: '#FFFFFF',
  },
  compactTextarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  compactButtonArea: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  // Fullscreen photo modal styles
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
});
