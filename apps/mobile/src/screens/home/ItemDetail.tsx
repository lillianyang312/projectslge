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
import { Text, Button, Input, Pill, Tabs, Badge } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { getItemById, updateItem, deleteItem, Item } from '../../services/itemsService';
import { getSignedUrl } from '../../services/imageService';
import { getDealsByItemId } from '../../services/dealsService';
import { Deal } from '../../types/models';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

type Condition = 'New' | 'Like new' | 'Good' | 'Fair';
type SellIntent = 'Maybe' | 'If good offer' | 'Want gone';

// Demo data matching HTML spec
const demoItemsData: Record<string, {
  emoji: string;
  title: string;
  category: string;
  condition: Condition;
  estimatedValue: number;
  estimatedRange: string;
  sellIntent: SellIntent;
}> = {
  '1': {
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    category: 'Furniture → Office Chair',
    condition: 'Like new',
    estimatedValue: 650,
    estimatedRange: '$500 – $800',
    sellIntent: 'If good offer',
  },
  '2': {
    emoji: '📱',
    title: 'iPhone 14 Pro',
    category: 'Electronics → Smartphones',
    condition: 'Good',
    estimatedValue: 800,
    estimatedRange: '$700 – $900',
    sellIntent: 'Maybe',
  },
  '3': {
    emoji: '🎸',
    title: 'Fender Stratocaster',
    category: 'Music → Guitars',
    condition: 'Good',
    estimatedValue: 600,
    estimatedRange: '$500 – $750',
    sellIntent: 'Want gone',
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

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

  // Fetch deals/bids for this item
  useEffect(() => {
    async function fetchDeals() {
      if (user) {
        setLoadingDeals(true);
        const itemDeals = await getDealsByItemId(itemId);
        setDeals(itemDeals);
        setLoadingDeals(false);
      }
    }
    fetchDeals();
  }, [itemId, user]);
  
  // Get item data from various sources
  const itemData = supabaseItem
    ? {
        emoji: '📦',
        title: supabaseItem.title,
        category: supabaseItem.category,
        condition: (supabaseItem.condition || 'Good') as Condition,
        estimatedValue: Math.round(((supabaseItem.estimated_value_min || 50) + (supabaseItem.estimated_value_max || 150)) / 2),
        estimatedRange: supabaseItem.estimated_value_min && supabaseItem.estimated_value_max
          ? `$${supabaseItem.estimated_value_min} – $${supabaseItem.estimated_value_max}`
          : '$50 – $150',
        minPrice: supabaseItem.min_price,
        sellIntent: 'Maybe' as SellIntent,
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
        minPrice: undefined as number | undefined,
        sellIntent: 'Maybe' as SellIntent,
        imageUri: storedListing.original.imageUris?.[0],
        isSupabase: false,
      }
    : { ...demoItemsData[itemId] || demoItemsData['1'], minPrice: undefined as number | undefined, isSupabase: false };

  const [condition, setCondition] = useState<Condition>(itemData.condition);
  const [askingPrice, setAskingPrice] = useState(itemData.estimatedValue?.toString() || '');
  const [sellIntent, setSellIntent] = useState<SellIntent>(itemData.sellIntent);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Buyer Interest, 1 = Item Details

  const conditionOptions: Condition[] = ['New', 'Like new', 'Good', 'Fair'];
  const sellIntentOptions: SellIntent[] = ['Maybe', 'If good offer', 'Want gone'];

  const handleSave = async () => {
    setSaving(true);
    
    try {
      if (supabaseItem) {
        // Update Supabase item
        const { error } = await updateItem(itemId, {
          condition,
          min_price: askingPrice ? parseFloat(askingPrice) : undefined,
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
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle} numberOfLines={1}>
            {itemData.title}
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
                {loadingDeals ? 'Loading...' : `${deals.length} interested buyer${deals.length !== 1 ? 's' : ''}`}
              </Text>
              {deals.length > 0 && (
                <Text variant="body" size="xs" color="secondary" style={styles.buyerSummaryNote}>
                  Review offers and chat with interested buyers
                </Text>
              )}
            </View>

            {/* Agent Recommendation - only show if there are deals with offers */}
            {deals.some(d => d.current_offer) && (
              <View style={styles.agentRecommendation}>
                <Text variant="body" size="xs" color="secondary" style={styles.agentRecLabel}>
                  Agent recommendation
                </Text>
                <Text variant="heading" size="heading3" color="success" style={styles.agentRecValue}>
                  {(() => {
                    const bestOffer = Math.max(...deals.filter(d => d.current_offer).map(d => d.current_offer || 0));
                    return bestOffer > 0 ? `Accept $${bestOffer} offer` : 'Review incoming offers';
                  })()}
                </Text>
              </View>
            )}

            {/* Show real deals/bids */}
            {loadingDeals ? (
              <View style={styles.loadingContainer}>
                <Text variant="body" color="secondary">Loading bids...</Text>
              </View>
            ) : deals.length === 0 ? (
              <View style={styles.emptyBidsContainer}>
                <Text style={styles.emptyBidsEmoji}>💬</Text>
                <Text variant="bodyMedium" size="md" style={styles.emptyBidsTitle}>
                  No bids yet
                </Text>
                <Text variant="body" size="sm" color="secondary" style={styles.emptyBidsText}>
                  When buyers express interest in your item, their bids will appear here.
                </Text>
              </View>
            ) : (
              deals.map((deal, index) => {
                const hasOffer = deal.current_offer && deal.current_offer > 0;
                const isAgreed = deal.status === 'agreed' || deal.status === 'logistics' || deal.status === 'completed';
                const bestOffer = Math.max(...deals.filter(d => d.current_offer).map(d => d.current_offer || 0));
                const isRecommended = hasOffer && deal.current_offer === bestOffer;

                // Get status badge
                const getStatusBadge = () => {
                  switch (deal.status) {
                    case 'negotiating':
                      return hasOffer ? { label: 'Offer received', variant: 'purple' as const } : { label: 'Interest shown', variant: 'secondary' as const };
                    case 'agreed':
                      return { label: 'Deal agreed', variant: 'success' as const };
                    case 'logistics':
                      return { label: 'Scheduling', variant: 'warning' as const };
                    case 'completed':
                      return { label: 'Completed', variant: 'success' as const };
                    default:
                      return { label: 'Active', variant: 'default' as const };
                  }
                };
                const statusBadge = getStatusBadge();

                // Format time ago
                const timeAgo = () => {
                  const updated = new Date(deal.updated_at);
                  const now = new Date();
                  const diffMs = now.getTime() - updated.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins < 60) return `${diffMins}m ago`;
                  const diffHours = Math.floor(diffMins / 60);
                  if (diffHours < 24) return `${diffHours}h ago`;
                  const diffDays = Math.floor(diffHours / 24);
                  return `${diffDays}d ago`;
                };

                return (
                  <View key={deal.id} style={[styles.bidCard, !hasOffer && styles.bidCardLocked]}>
                    <View style={styles.bidHeader}>
                      <Text variant="heading" size="heading3" color={hasOffer ? 'success' : 'secondary'}>
                        {hasOffer ? `$${deal.current_offer}` : 'No offer yet'}
                      </Text>
                      <View style={styles.bidBadges}>
                        {isRecommended && <Badge variant="success">Recommended</Badge>}
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </View>
                    </View>

                    {/* Time indicator */}
                    <View style={styles.timeIndicator}>
                      <Text variant="body" size="xs" color="secondary">
                        ⏰ Active {timeAgo()}
                      </Text>
                    </View>

                    {/* Deal info */}
                    <View style={styles.dealInfoSection}>
                      <View style={styles.buyerDetailRow}>
                        <Text variant="body" size="sm" color="secondary">Status</Text>
                        <Text variant="bodyMedium" size="sm">
                          {deal.status === 'negotiating' ? 'Negotiating' :
                           deal.status === 'agreed' ? `Agreed at $${deal.agreed_price}` :
                           deal.status === 'logistics' ? 'Scheduling pickup' :
                           deal.status === 'completed' ? 'Completed' : deal.status}
                        </Text>
                      </View>
                      {isAgreed && deal.agreed_price && (
                        <View style={styles.buyerDetailRow}>
                          <Text variant="body" size="sm" color="secondary">Final price</Text>
                          <Text variant="bodyMedium" size="sm" color="success">${deal.agreed_price}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.bidActions}>
                      {deal.status === 'negotiating' && hasOffer && (
                        <Button
                          variant="primary"
                          style={styles.bidActionBtn}
                          onPress={() => {
                            tabNavigation.navigate('Deals', { initialMode: 'selling' });
                          }}
                        >
                          Review offer
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        style={styles.bidActionBtn}
                        onPress={() => {
                          tabNavigation.navigate('Deals', { initialMode: 'selling' });
                        }}
                      >
                        View deal
                      </Button>
                    </View>
                  </View>
                );
              })
            )}
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
                    <Text variant="body" size="md" color="secondary">Minimum price to sell</Text>
                    <Text variant="bodyMedium" size="md">
                      {itemData.minPrice ? `$${itemData.minPrice}` : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.factRow}>
                    <Text variant="body" size="md" color="secondary">How likely to sell</Text>
                    <Text variant="bodyMedium" size="md">{sellIntent}</Text>
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

                {/* Minimum price to sell */}
                <View style={styles.inputGroup}>
                  <Text variant="body" size="base" color="secondary" style={styles.label}>
                    Minimum price to sell
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
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyBidsContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  emptyBidsEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyBidsTitle: {
    marginBottom: spacing.sm,
  },
  emptyBidsText: {
    textAlign: 'center',
  },
  dealInfoSection: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bidBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
