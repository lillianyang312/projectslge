import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ListStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Button, Input, Pill, Tabs, Badge, BroadcastAnnouncement } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { getItemById, updateItem, deleteItem, Item } from '../../services/itemsService';
import { getSignedUrl } from '../../services/imageService';
import { broadcastToItemBuyers } from '../../services/broadcastService';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

type Condition = 'New' | 'Like new' | 'Good' | 'Fair';
type SellIntent = 'Maybe' | 'If good offer' | 'Want gone';
type DeliveryPref = 'Local only' | 'Shipping OK';

// Demo data matching HTML spec
const demoItemsData: Record<string, {
  emoji: string;
  title: string;
  category: string;
  condition: Condition;
  estimatedValue: number;
  estimatedRange: string;
  sellIntent: SellIntent;
  deliveryPref: DeliveryPref;
}> = {
  '1': {
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    category: 'Furniture → Office Chair',
    condition: 'Like new',
    estimatedValue: 650,
    estimatedRange: '$500 – $800',
    sellIntent: 'If good offer',
    deliveryPref: 'Local only',
  },
  '2': {
    emoji: '📱',
    title: 'iPhone 14 Pro',
    category: 'Electronics → Smartphones',
    condition: 'Good',
    estimatedValue: 800,
    estimatedRange: '$700 – $900',
    sellIntent: 'Maybe',
    deliveryPref: 'Shipping OK',
  },
  '3': {
    emoji: '🎸',
    title: 'Fender Stratocaster',
    category: 'Music → Guitars',
    condition: 'Good',
    estimatedValue: 600,
    estimatedRange: '$500 – $750',
    sellIntent: 'Want gone',
    deliveryPref: 'Local only',
  },
};

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const listings = useItemsStore((state) => state.listings);
  const updateListing = useItemsStore((state) => state.updateListing);
  const user = useAuthStore((state) => state.user);
  const tabNavigation = useNavigation<TabNavProp>();
  
  const [supabaseItem, setSupabaseItem] = useState<Item | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Try to get listing from store first
  const storedListing = listings.find((l) => l.id === itemId);
  
  // Fetch Supabase item if user is authenticated and item not found locally
  useEffect(() => {
    async function fetchItem() {
      if (user && !storedListing && !demoItemsData[itemId]) {
        const { data } = await getItemById(itemId);
        if (data) {
          setSupabaseItem(data);
          // Get signed URL for the image if it exists
          if (data.photos?.[0]) {
            const url = await getSignedUrl(data.photos[0]);
            setImageUrl(url);
          }
        }
      }
      setLoading(false);
    }
    fetchItem();
  }, [itemId, user, storedListing]);
  
  // Get item data from various sources
  const itemData = supabaseItem
    ? {
        emoji: '📦',
        title: supabaseItem.title,
        category: supabaseItem.category,
        condition: (supabaseItem.condition || 'Good') as Condition,
        estimatedValue: supabaseItem.asking_price || 100,
        estimatedRange: '$50 – $150',
        sellIntent: 'Maybe' as SellIntent,
        deliveryPref: (supabaseItem.delivery_pref === 'shipping_ok' ? 'Shipping OK' : 'Local only') as DeliveryPref,
        imageUri: imageUrl,
        isSupabase: true,
      }
    : storedListing
    ? {
        emoji: '📦',
        title: storedListing.original.title,
        category: storedListing.original.category,
        condition: (storedListing.original.condition || 'Good') as Condition,
        estimatedValue: 100,
        estimatedRange: '$50 – $150',
        sellIntent: 'Maybe' as SellIntent,
        deliveryPref: 'Local only' as DeliveryPref,
        imageUri: storedListing.original.imageUris?.[0],
        isSupabase: false,
      }
    : { ...demoItemsData[itemId] || demoItemsData['1'], isSupabase: false };
  
  const [condition, setCondition] = useState<Condition>(itemData.condition);
  const [askingPrice, setAskingPrice] = useState(itemData.estimatedValue?.toString() || '');
  const [sellIntent, setSellIntent] = useState<SellIntent>(itemData.sellIntent);
  const [deliveryPref, setDeliveryPref] = useState<DeliveryPref>(itemData.deliveryPref);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Buyer Interest, 1 = Item Details

  const conditionOptions: Condition[] = ['New', 'Like new', 'Good', 'Fair'];
  const sellIntentOptions: SellIntent[] = ['Maybe', 'If good offer', 'Want gone'];
  const deliveryOptions: DeliveryPref[] = ['Local only', 'Shipping OK'];

  const handleSave = async () => {
    setSaving(true);
    
    try {
      if (supabaseItem) {
        // Update Supabase item
        const { error } = await updateItem(itemId, {
          condition,
          delivery_pref: deliveryPref === 'Shipping OK' ? 'shipping_ok' : 'local_only',
          asking_price: askingPrice ? parseFloat(askingPrice) : undefined,
        });
        
        if (error) {
          Alert.alert('Error', error);
          setSaving(false);
          return;
        }
      } else if (storedListing) {
        // Update local stored listing
        updateListing(itemId, {
          original: {
            ...storedListing.original,
            condition,
          },
        });
      }
      
      setSaving(false);
      setIsEditing(false);
      Alert.alert('Saved', 'Your changes have been saved.');
    } catch (error) {
      console.error('Save error:', error);
      setSaving(false);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (supabaseItem) {
              // Delete from Supabase
              const { error } = await deleteItem(itemId);
              if (error) {
                Alert.alert('Error', error);
                return;
              }
            } else if (storedListing) {
              // Mark local listing as inactive
              updateListing(itemId, { isActive: false });
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleSellItem = (price: number) => {
    // Navigate directly to Deals tab
    tabNavigation.navigate('Deals');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with back arrow and title */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            Item
          </Text>
        </View>

        {/* Tabs */}
        <Tabs
          tabs={['Buyer Interest', 'Item Details']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content: Buyer Interest */}
        {activeTab === 0 && (
          <View>
            {/* Summary of interested buyers */}
            <View style={styles.buyerSummaryCard}>
              <Text variant="body" size="xs" color="secondary" style={styles.buyerSummaryLabel}>
                Buyer interest
              </Text>
              <Text variant="heading" size="heading3" style={styles.buyerSummaryValue}>
                3 interested buyers
              </Text>
              <Text variant="body" size="xs" color="secondary" style={styles.buyerSummaryNote}>
                Answer their questions in your Inbox to see full bid details
              </Text>
            </View>

            {/* Agent Recommendation */}
            <View style={styles.agentRecommendation}>
              <Text variant="body" size="xs" color="secondary" style={styles.agentRecLabel}>
                Agent recommendation
              </Text>
              <Text variant="heading" size="heading3" color="success" style={styles.agentRecValue}>
                Accept $550 offer
              </Text>
            </View>

            {/* Broadcast Announcement */}
            <BroadcastAnnouncement
              onSend={async (message) => {
                if (!user) {
                  Alert.alert('Error', 'You must be logged in to broadcast messages.');
                  return;
                }

                const result = await broadcastToItemBuyers(itemId, user.id, message);
                
                if (result.success) {
                  Alert.alert(
                    'Message Sent',
                    `Your announcement has been sent to ${result.recipientsCount} interested buyer${result.recipientsCount !== 1 ? 's' : ''}.`
                  );
                } else {
                  Alert.alert('Error', result.error || 'Failed to send broadcast message.');
                }
              }}
            />

            {/* Bids - Demo data matching HTML spec lines 763-801 */}
            {/* Bid #1: Answered questions - show full details */}
            <View style={styles.bidCard}>
              <View style={styles.bidHeader}>
                <Text variant="heading" size="heading3" color="success">
                  $550
                </Text>
                <Badge variant="success">Recommended</Badge>
              </View>

              {/* Time indicator */}
              <View style={styles.timeIndicator}>
                <Text variant="body" size="xs" color="secondary">
                  ⏰ 4d left · Active 2h ago
                </Text>
              </View>

              {/* Buyer Information Section */}
              <View style={styles.buyerInfo}>
                <Text variant="bodyMedium" size="sm" style={styles.buyerInfoTitle}>
                  Buyer Profile
                </Text>

                {/* Reputation Section */}
                <View style={styles.reputationSection}>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Name</Text>
                    <Text variant="bodyMedium" size="sm">Sarah M.</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Member since</Text>
                    <Text variant="bodyMedium" size="sm">Jan 2024</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Reputation</Text>
                    <View style={styles.reputationBadge}>
                      <Text variant="bodyMedium" size="xs" style={styles.reputationText}>
                        ⭐ Verified · 12 deals
                      </Text>
                    </View>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Rating</Text>
                    <Text variant="bodyMedium" size="sm">4.9/5.0 (12 reviews)</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Items sold</Text>
                    <Text variant="bodyMedium" size="sm">8 items</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Items purchased</Text>
                    <Text variant="bodyMedium" size="sm">4 items</Text>
                  </View>
                </View>

                {/* Bid Details Section */}
                <View style={styles.bidDetailsSection}>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Location</Text>
                    <Text variant="bodyMedium" size="sm">1.2 mi away</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary">Payment</Text>
                    <Text variant="bodyMedium" size="sm">Cash on pickup</Text>
                  </View>
                  <View style={styles.buyerDetailRow}>
                    <Text variant="body" size="sm" color="secondary" style={styles.availabilityLabel}>Pickup availability</Text>
                    <View style={styles.availabilityPills}>
                      <View style={styles.availabilityPill}>
                        <Text variant="bodyMedium" size="xs">Weekdays</Text>
                      </View>
                      <View style={styles.availabilityPill}>
                        <Text variant="bodyMedium" size="xs">Weekends</Text>
                      </View>
                      <View style={styles.availabilityPill}>
                        <Text variant="bodyMedium" size="xs">Evenings</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.bidActions}>
                <Button variant="primary" style={styles.bidActionBtn} onPress={() => handleSellItem(550)}>
                  Sell for $550
                </Button>
                <Button
                  variant="secondary"
                  style={styles.bidActionBtn}
                  onPress={() => navigation.navigate('ChatThread', { conversationId: 'buyer-sarah-1' })}
                >
                  Chat with Sarah
                </Button>
              </View>
            </View>

            {/* Bid #2: Questions not answered - show limited info */}
            <View style={[styles.bidCard, styles.bidCardLocked]}>
              <View style={styles.bidHeader}>
                <Text variant="heading" size="heading3" color="secondary">
                  $???
                </Text>
                <Badge variant="secondary">Pending questions</Badge>
              </View>

              <View style={styles.lockedBidInfo}>
                <Text variant="body" size="sm" color="secondary" style={styles.lockedBidText}>
                  Asked about shipping options
                </Text>
              </View>

              <View style={styles.bidActions}>
                <Button
                  variant="secondary"
                  style={styles.bidActionBtn}
                  onPress={() => navigation.navigate('ChatThread', { conversationId: 'buyer-question-1' })}
                >
                  Answer Mike
                </Button>
              </View>
            </View>

            {/* Bid #3: Questions not answered - show limited info */}
            <View style={[styles.bidCard, styles.bidCardLocked]}>
              <View style={styles.bidHeader}>
                <Text variant="heading" size="heading3" color="secondary">
                  $???
                </Text>
                <Badge variant="secondary">Pending questions</Badge>
              </View>

              <View style={styles.lockedBidInfo}>
                <Text variant="body" size="sm" color="secondary" style={styles.lockedBidText}>
                  Asked about condition details
                </Text>
              </View>

              <View style={styles.bidActions}>
                <Button
                  variant="secondary"
                  style={styles.bidActionBtn}
                  onPress={() => navigation.navigate('ChatThread', { conversationId: 'buyer-question-2' })}
                >
                  Answer Alex
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* Tab Content: Item Details */}
        {activeTab === 1 && (
          <View>
            {/* Item Image */}
            <View style={styles.detailImage}>
              {itemData.imageUri ? (
                <Image source={{ uri: itemData.imageUri }} style={styles.image} resizeMode="cover" />
              ) : (
                <Text style={styles.imageEmoji}>{itemData.emoji}</Text>
              )}
            </View>

            <Text variant="headingMedium" size="heading3" style={styles.detailTitle}>
              {itemData.title}
            </Text>

            {/* Category */}
            <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
              {itemData.category}
            </Text>

            {/* Show facts (read-only) unless in edit mode */}
            {!isEditing ? (
              <>
                {/* Item Facts */}
                <View style={styles.factsSection}>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">Condition</Text>
                    <Text variant="bodyMedium" size="md">{condition}</Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">Would let go for</Text>
                    <Text variant="bodyMedium" size="md">
                      {askingPrice ? `$${askingPrice}` : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">How likely to sell</Text>
                    <Text variant="bodyMedium" size="md">{sellIntent}</Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">Delivery preference</Text>
                    <Text variant="bodyMedium" size="md">{deliveryPref}</Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">Interested buyers</Text>
                    <Text variant="bodyMedium" size="md">3</Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">Market estimate</Text>
                    <Text variant="bodyMedium" size="md">{itemData.estimatedRange}</Text>
                  </View>
                </View>

                {/* Notes/Description Section */}
                <View style={styles.notesSection}>
                  <Text variant="bodyMedium" size="md" style={styles.notesSectionLabel}>
                    Notes
                  </Text>
                  <Text variant="body" size="md" color="secondary" style={styles.notesSectionText}>
                    Size B, all original parts, minor wear on armrests
                  </Text>
                </View>

                {/* Edit Button */}
                <Button variant="secondary" onPress={() => setIsEditing(true)} style={styles.editButton}>
                  Edit item
                </Button>
              </>
            ) : (
              <>
                {/* Edit Mode */}
                {/* Condition Pills */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    Condition
                  </Text>
                  <View style={styles.pills}>
                    {conditionOptions.map((opt) => (
                      <Pill
                        key={opt}
                        label={opt}
                        selected={condition === opt}
                        onPress={() => setCondition(opt)}
                      />
                    ))}
                  </View>
                </View>

                {/* Estimate Box */}
                <View style={styles.estimateBox}>
                  <Text variant="body" size="sm" color="secondary" style={styles.estimateLabel}>
                    ESTIMATED MARKET VALUE
                  </Text>
                  <Text variant="heading" size="heading1" style={styles.estimateValue}>
                    ${itemData.estimatedValue}
                  </Text>
                  <Text variant="body" size="base" color="secondary" style={styles.estimateRange}>
                    Range: {itemData.estimatedRange}
                  </Text>
                </View>

                {/* Would let go for */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    Would let go for
                  </Text>
                  <View style={styles.priceInputRow}>
                    <Input
                      placeholder="$0"
                      value={askingPrice}
                      onChangeText={setAskingPrice}
                      keyboardType="numeric"
                      style={styles.priceInput}
                    />
                    <Button
                      variant="secondary"
                      onPress={() => setAskingPrice('')}
                      style={styles.notSureBtn}
                    >
                      Not sure
                    </Button>
                  </View>
                </View>

                {/* How likely to sell */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    How likely to sell?
                  </Text>
                  <View style={styles.pills}>
                    {sellIntentOptions.map((opt) => (
                      <Pill
                        key={opt}
                        label={opt}
                        selected={sellIntent === opt}
                        onPress={() => setSellIntent(opt)}
                      />
                    ))}
                  </View>
                </View>

                {/* Delivery preference */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    Delivery preference
                  </Text>
                  <View style={styles.pills}>
                    {deliveryOptions.map((opt) => (
                      <Pill
                        key={opt}
                        label={opt}
                        selected={deliveryPref === opt}
                        onPress={() => setDeliveryPref(opt)}
                      />
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    Notes
                  </Text>
                  <Input
                    placeholder="Any updates about this item..."
                    multiline
                    numberOfLines={3}
                    style={styles.notesInput}
                    defaultValue="Size B, all original parts, minor wear on armrests"
                  />
                </View>

                {/* Save and Cancel buttons */}
                <Button
                  variant="primary"
                  onPress={handleSave}
                  disabled={saving}
                  style={styles.saveBtn}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
                <Button variant="secondary" onPress={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
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
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
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
    marginLeft: spacing.md,
  },
  agentRecommendation: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  agentRecLabel: {
    marginBottom: 2,
  },
  agentRecValue: {},
  bidCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bidUser: {
    marginBottom: 4,
  },
  bidDetails: {
    marginBottom: spacing.md,
  },
  bidActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bidActionBtn: {
    flex: 1,
  },
  buyerInfo: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  buyerInfoTitle: {
    marginBottom: spacing.sm,
  },
  buyerDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  buyerQuestion: {
    flex: 1,
    fontStyle: 'italic',
    textAlign: 'right',
    maxWidth: '65%',
  },
  reputationSection: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  bidDetailsSection: {
    marginTop: spacing.sm,
  },
  availabilityLabel: {
    alignSelf: 'flex-start',
  },
  availabilityPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    maxWidth: '60%',
  },
  availabilityPill: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.xs,
  },
  reputationBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  reputationText: {
    color: colors.success,
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
  detailTitle: {
    marginBottom: 4,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageEmoji: {
    fontSize: 48,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCategory: {
    marginBottom: spacing.xxl,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: 6,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  estimateBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  estimateLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  estimateValue: {
    fontFamily: typography?.fonts?.heading || 'Fraunces_400Regular',
  },
  estimateRange: {
    marginTop: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priceInput: {
    flex: 1,
  },
  notSureBtn: {
    paddingHorizontal: spacing.lg,
  },
  saveBtn: {
    marginBottom: spacing.md,
  },
  deleteBtn: {},
  notesInput: {
    minHeight: 80,
  },
  factsSection: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  editButton: {
    marginBottom: spacing.xl,
  },
  notesSection: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  notesSectionLabel: {
    marginBottom: spacing.sm,
  },
  notesSectionText: {
    lineHeight: 22,
  },
  buyerSummaryCard: {
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  buyerSummaryLabel: {
    marginBottom: 2,
  },
  buyerSummaryValue: {
    marginBottom: spacing.xs,
  },
  buyerSummaryNote: {
    textAlign: 'center',
  },
  bidCardLocked: {
    opacity: 0.7,
    backgroundColor: colors.cardMuted,
  },
  lockedBidInfo: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  lockedBidText: {
    textAlign: 'center',
    marginBottom: 2,
  },
  lockedBidSubtext: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  timeIndicator: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: radius.xs,
    marginBottom: spacing.sm,
  },
});
