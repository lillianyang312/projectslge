import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Image,
  Modal,
  Dimensions,
  StatusBar,
  TextInput,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ListStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Button, Tabs, Badge } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { getItemById, updateItem, deleteItem, Item } from '../../services/itemsService';
import { getSignedUrlCached, uploadImageGroup } from '../../services/imageService';
import { getDealsByItemId, getQuestionsForItem, getDealsWithExpiration, acceptOffer, ItemQuestion } from '../../services/dealsService';
import { sendSystemMessage } from '../../services/chatService';
import { Deal } from '../../types/models';
import OwnerDashboard from './OwnerDashboard';
import { SellIntent } from '../../state/itemsStore';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

type Condition = 'New' | 'Like new' | 'Good' | 'Fair';

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
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [questions, setQuestions] = useState<ItemQuestion[]>([]);

  // Try to get listing from store first
  const storedListing = listings.find((l) => l.id === itemId);

  // Fetch Supabase item if user is authenticated and item not found locally
  useEffect(() => {
    async function fetchItem() {
      if (user && !storedListing && !demoItemsData[itemId]) {
        const { data } = await getItemById(itemId);
        if (data) {
          setSupabaseItem(data);
          // Get signed URLs for all images (using cache)
          if (data.photos && data.photos.length > 0) {
            const urls = await Promise.all(
              data.photos.map((path: string) => getSignedUrlCached(path))
            );
            setAllImageUrls(urls.filter((url): url is string => url !== null));
            setImageUrl(urls[0] || null);
          }
        }
      }
      setLoading(false);
    }
    fetchItem();
  }, [itemId, user, storedListing]);

  // Fetch deals/bids and questions for this item
  const fetchDealsAndQuestions = async () => {
    if (user) {
      setLoadingDeals(true);
      const [itemDeals, itemQuestions] = await Promise.all([
        getDealsWithExpiration(itemId),
        getQuestionsForItem(itemId),
      ]);
      setDeals(itemDeals);
      setQuestions(itemQuestions);
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    fetchDealsAndQuestions();
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
        notes: supabaseItem.notes || '',
        sellIntent: 'Maybe' as SellIntent,
        imageUri: imageUrl,
        allImageUris: allImageUrls,
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
        notes: storedListing.original.notes || '',
        sellIntent: 'Maybe' as SellIntent,
        imageUri: storedListing.original.imageUris?.[0],
        allImageUris: storedListing.original.imageUris || [],
        isSupabase: false,
      }
    : { ...demoItemsData[itemId] || demoItemsData['1'], minPrice: undefined as number | undefined, notes: '', allImageUris: [] as string[], isSupabase: false };

  const [condition, setCondition] = useState<Condition>(itemData.condition);
  const [askingPrice, setAskingPrice] = useState(itemData.minPrice?.toString() || '');
  const [retailPrice, setRetailPrice] = useState(supabaseItem?.retail_price?.toString() || '');
  const [sellIntent, setSellIntent] = useState<SellIntent>(itemData.sellIntent);
  const [editTitle, setEditTitle] = useState(itemData.title || '');
  const [editCategory, setEditCategory] = useState(itemData.category || '');
  const [editNotes, setEditNotes] = useState(itemData.notes || '');
  const [editPhotos, setEditPhotos] = useState<string[]>(
    itemData.allImageUris && itemData.allImageUris.length > 0
      ? itemData.allImageUris
      : (itemData.imageUri ? [itemData.imageUri] : [])
  );
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Buyer Interest, 1 = Item Details
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

  const conditionOptions: Condition[] = ['New', 'Like new', 'Good', 'Fair'];
  const sellIntentOptions: SellIntent[] = ['Maybe', 'If good offer', 'Want gone'];

  // Update all edit fields when supabaseItem loads (async fetch)
  useEffect(() => {
    if (supabaseItem) {
      setEditTitle(supabaseItem.title || '');
      setEditCategory(supabaseItem.category || '');
      setEditNotes(supabaseItem.notes || '');
      setCondition((supabaseItem.condition || 'Good') as Condition);
      setAskingPrice(supabaseItem.min_price?.toString() || '');
      setRetailPrice(supabaseItem.retail_price?.toString() || '');
      // sellIntent might need to be stored in supabase in the future
    }
  }, [supabaseItem]);

  // Update editPhotos when allImageUrls are loaded (async)
  useEffect(() => {
    if (allImageUrls.length > 0) {
      setEditPhotos(allImageUrls);
    }
  }, [allImageUrls]);

  // Photo editing functions
  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera permissions to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      const updatedPhotos = [...editPhotos, newUri].slice(0, 5);
      setEditPhotos(updatedPhotos);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, 5 - editPhotos.length),
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(asset => asset.uri);
      const updatedPhotos = [...editPhotos, ...newUris].slice(0, 5);
      setEditPhotos(updatedPhotos);
    }
  };

  const addMorePhotos = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhotoWithCamera();
          else if (buttonIndex === 2) pickFromGallery();
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhotoWithCamera },
        { text: 'Choose from Library', onPress: pickFromGallery },
      ]);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = editPhotos.filter((_, i) => i !== index);
    setEditPhotos(updatedPhotos);
  };

  const openFullscreenPhoto = (uri: string) => {
    setFullscreenImageUri(uri);
    setShowFullscreenPhoto(true);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (supabaseItem && user) {
        // Track what changed for notification
        const changes: string[] = [];
        if (editTitle.trim() && editTitle.trim() !== supabaseItem.title) {
          changes.push(`Title changed to "${editTitle.trim()}"`);
        }
        if (editCategory.trim() && editCategory.trim() !== supabaseItem.category) {
          changes.push(`Category changed to "${editCategory.trim()}"`);
        }
        if (condition !== supabaseItem.condition) {
          changes.push(`Condition changed to "${condition}"`);
        }
        const newMinPrice = askingPrice ? parseFloat(askingPrice) : undefined;
        if (newMinPrice !== supabaseItem.min_price) {
          if (newMinPrice) {
            changes.push(`Minimum price set to $${newMinPrice}`);
          } else if (supabaseItem.min_price) {
            changes.push('Minimum price removed');
          }
        }
        const newRetailPrice = retailPrice ? parseFloat(retailPrice) : undefined;
        if (newRetailPrice !== supabaseItem.retail_price) {
          if (newRetailPrice) {
            changes.push(`Retail price set to $${newRetailPrice}`);
          } else if (supabaseItem.retail_price) {
            changes.push('Retail price removed');
          }
        }
        if (editNotes.trim() !== (supabaseItem.notes || '')) {
          changes.push('Notes updated');
        }

        // Check if there are new local photos to upload
        const newLocalPhotos = editPhotos.filter(uri => uri.startsWith('file://'));
        let uploadedPaths: string[] = [];

        if (newLocalPhotos.length > 0) {
          // Upload new photos
          const { paths, errors } = await uploadImageGroup(newLocalPhotos, user.id);
          if (errors.length > 0) {
            console.warn('[ItemDetail] Some photos failed to upload:', errors);
          }
          uploadedPaths = paths;
          if (paths.length > 0) {
            changes.push('Photos updated');
          }
        }

        // Keep existing Supabase photos (those not starting with file://)
        const existingPhotoPaths = supabaseItem.photos?.filter(p =>
          editPhotos.some(uri => !uri.startsWith('file://') && uri.includes(p))
        ) || [];

        // Check if photos were removed
        if (existingPhotoPaths.length < (supabaseItem.photos?.length || 0) && !changes.includes('Photos updated')) {
          changes.push('Photos updated');
        }

        // Combine existing and new photo paths
        const allPhotoPaths = [...existingPhotoPaths, ...uploadedPaths].slice(0, 5);

        // Update Supabase item
        const { error } = await updateItem(itemId, {
          title: editTitle.trim() || undefined,
          category: editCategory.trim() || undefined,
          condition,
          min_price: askingPrice ? parseFloat(askingPrice) : undefined,
          retail_price: retailPrice ? parseFloat(retailPrice) : undefined,
          notes: editNotes.trim() || undefined,
          photos: allPhotoPaths.length > 0 ? allPhotoPaths : undefined,
        });

        if (error) {
          Alert.alert('Error', error);
          setSaving(false);
          return;
        }

        // Notify bidders of changes if there are any active deals with offers
        if (changes.length > 0 && deals.length > 0) {
          const activeDealsWithOffers = deals.filter(
            d => d.current_offer != null && d.status === 'negotiating'
          );

          if (activeDealsWithOffers.length > 0) {
            const changeMessage = `📝 The owner has updated this item:\n• ${changes.join('\n• ')}\n\nPlease review the updated listing.`;

            // Send notification to all active deals
            await Promise.all(
              activeDealsWithOffers.map(deal =>
                sendSystemMessage(deal.id, changeMessage, { type: 'item_update', changes })
              )
            );
          }
        }

        // Refresh the item to get updated data
        const { data: refreshedItem } = await getItemById(itemId);
        if (refreshedItem) {
          setSupabaseItem(refreshedItem);
          if (refreshedItem.photos?.[0]) {
            const url = await getSignedUrlCached(refreshedItem.photos[0]);
            setImageUrl(url);
          }
        }
      } else if (storedListing) {
        // Update local stored listing
        updateListing(itemId, {
          original: {
            ...storedListing.original,
            condition,
            notes: editNotes.trim() || undefined,
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

  const handleViewDeal = (dealId: string) => {
    // Navigate to deal details
    tabNavigation.navigate('Deals', { initialMode: 'selling' });
  };

  const handleAcceptOffer = async (dealId: string) => {
    if (!user) return;
    const success = await acceptOffer(dealId, user.id);
    if (success) {
      Alert.alert('Success', 'Offer accepted!');
      fetchDealsAndQuestions();
    } else {
      Alert.alert('Error', 'Failed to accept offer');
    }
  };

  const handleRefresh = () => {
    fetchDealsAndQuestions();
  };

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
              source={{ uri: fullscreenImageUri || itemData.imageUri || '' }}
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
          tabs={['Offers', 'Item Details']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content: Buyer Interest */}
        {activeTab === 0 && supabaseItem && (
          <OwnerDashboard
            item={supabaseItem}
            deals={deals}
            questions={questions}
            onRefresh={handleRefresh}
            onViewDeal={handleViewDeal}
            onAcceptOffer={handleAcceptOffer}
            sellIntent={sellIntent}
          />
        )}
        {activeTab === 0 && !supabaseItem && (
          <View style={styles.loadingContainer}>
            <Text variant="body" color="secondary">
              {loading ? 'Loading item...' : 'Item data not available'}
            </Text>
          </View>
        )}

        {/* Tab Content: Item Details */}
        {activeTab === 1 && (
          <View>
            {/* Show image, title, category only when NOT editing */}
            {!isEditing && (
              <>
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
                        onPress={() => { setFullscreenImageUri(url); setShowFullscreenPhoto(true); }}
                        style={[styles.detailImage, { width: SCREEN_WIDTH - 2 * spacing.xxl, marginRight: spacing.sm, marginBottom: 0 }]}
                      >
                        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
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
                )}

                <Text variant="headingMedium" size="heading3" style={styles.detailTitle}>
                  {itemData.title}
                </Text>

                {/* Category */}
                <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
                  {itemData.category}
                </Text>

                {/* Notes section - inline like BrowseItemDetail */}
                {itemData.notes ? (
                  <Text variant="body" size="md" color="secondary" style={styles.notesText}>
                    {itemData.notes}
                  </Text>
                ) : null}
              </>
            )}

            {/* Show facts (read-only) unless in edit mode */}
            {!isEditing ? (
              <>
                {/* Agent Summary - matching BrowseItemDetail style */}
                <View style={styles.agentSummary}>
                  <View style={styles.agentRow}>
                    <Text variant="body" size="md" color="secondary">Estimated value</Text>
                    <Text variant="bodyMedium" size="md">{itemData.estimatedRange}</Text>
                  </View>
                  {supabaseItem?.retail_price && (
                    <View style={styles.agentRow}>
                      <Text variant="body" size="md" color="secondary">Retail price</Text>
                      <Text variant="bodyMedium" size="md">${supabaseItem.retail_price}</Text>
                    </View>
                  )}
                  <View style={styles.agentRow}>
                    <Text variant="body" size="md" color="secondary">Condition</Text>
                    <Text variant="bodyMedium" size="md">{condition}</Text>
                  </View>
                  <View style={styles.agentRow}>
                    <Text variant="body" size="md" color="secondary">Minimum price</Text>
                    <Text variant="bodyMedium" size="md">
                      {itemData.minPrice ? `$${itemData.minPrice}` : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.agentRow}>
                    <Text variant="body" size="md" color="secondary">Likeliness to sell</Text>
                    <Text variant="bodyMedium" size="md">{sellIntent}</Text>
                  </View>
                </View>

                {/* Edit Button */}
                <Button variant="secondary" onPress={() => setIsEditing(true)} style={styles.editButton}>
                  Edit item
                </Button>
              </>
            ) : (
              <>
                {/* Edit Mode - Compact Layout like Upload */}
                {/* Photo Thumbnails - Compact horizontal scroll */}
                <View style={styles.editPhotoSection}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Photos ({editPhotos.length}/5)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editPhotoScroll}>
                    {editPhotos.map((uri, index) => (
                      <View key={index} style={styles.editPhotoWrapper}>
                        <Pressable onPress={() => openFullscreenPhoto(uri)}>
                          <Image source={{ uri }} style={styles.editThumbnail} />
                        </Pressable>
                        <Pressable style={styles.editRemoveBtn} onPress={() => removePhoto(index)}>
                          <Text style={styles.editRemoveBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    {editPhotos.length < 5 && (
                      <Pressable style={styles.editAddPhotoBtn} onPress={addMorePhotos}>
                        <Text style={styles.editAddPhotoIcon}>+</Text>
                      </Pressable>
                    )}
                  </ScrollView>
                </View>

                {/* Title - Editable */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Title
                  </Text>
                  <TextInput
                    style={styles.editTextInput}
                    placeholder="Item name"
                    placeholderTextColor={colors.textMuted}
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />
                </View>

                {/* Category - Editable */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Category
                  </Text>
                  <TextInput
                    style={styles.editTextInput}
                    placeholder="e.g. Electronics, Furniture"
                    placeholderTextColor={colors.textMuted}
                    value={editCategory}
                    onChangeText={setEditCategory}
                  />
                </View>

                {/* Condition - Compact inline pills */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Condition
                  </Text>
                  <View style={styles.editConditionRow}>
                    {conditionOptions.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[
                          styles.editConditionPill,
                          condition === opt && styles.editConditionPillSelected,
                        ]}
                        onPress={() => setCondition(opt)}
                      >
                        <Text
                          style={[
                            styles.editConditionPillText,
                            condition === opt && styles.editConditionPillTextSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Minimum price - Compact row */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Minimum price
                  </Text>
                  <View style={styles.editPriceRow}>
                    <View style={styles.editPriceInputWrapper}>
                      <Text style={styles.editPricePrefix}>$</Text>
                      <TextInput
                        style={styles.editPriceInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={askingPrice}
                        onChangeText={setAskingPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <Pressable
                      style={styles.editNotSureBtn}
                      onPress={() => setAskingPrice('')}
                    >
                      <Text style={styles.editNotSureBtnText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Retail price - Compact row */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Original retail price
                  </Text>
                  <View style={styles.editPriceRow}>
                    <View style={styles.editPriceInputWrapper}>
                      <Text style={styles.editPricePrefix}>$</Text>
                      <TextInput
                        style={styles.editPriceInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={retailPrice}
                        onChangeText={setRetailPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <Pressable
                      style={styles.editNotSureBtn}
                      onPress={() => setRetailPrice('')}
                    >
                      <Text style={styles.editNotSureBtnText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Likeliness to sell - Compact */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Likeliness to sell
                  </Text>
                  <View style={styles.editConditionRow}>
                    {sellIntentOptions.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[
                          styles.editConditionPill,
                          sellIntent === opt && styles.editConditionPillSelected,
                        ]}
                        onPress={() => setSellIntent(opt)}
                      >
                        <Text
                          style={[
                            styles.editConditionPillText,
                            sellIntent === opt && styles.editConditionPillTextSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Notes - Optional, compact */}
                <View style={styles.editInputGroup}>
                  <Text variant="body" size="sm" color="muted" style={styles.editLabel}>
                    Notes (optional)
                  </Text>
                  <TextInput
                    style={styles.editNotesInput}
                    placeholder="Any details buyers should know..."
                    placeholderTextColor={colors.textMuted}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    multiline
                  />
                </View>

                {/* Save and Cancel - Side by side */}
                <View style={styles.editActions}>
                  <Pressable
                    style={styles.editCancelBtn}
                    onPress={() => {
                      setIsEditing(false);
                      // Reset to actual supabaseItem values if available
                      if (supabaseItem) {
                        setEditTitle(supabaseItem.title || '');
                        setEditCategory(supabaseItem.category || '');
                        setEditNotes(supabaseItem.notes || '');
                        setCondition((supabaseItem.condition || 'Good') as Condition);
                        setAskingPrice(supabaseItem.min_price?.toString() || '');
                        setRetailPrice(supabaseItem.retail_price?.toString() || '');
                        if (allImageUrls.length > 0) {
                          setEditPhotos(allImageUrls);
                        }
                      } else {
                        setEditTitle(itemData.title || '');
                        setEditCategory(itemData.category || '');
                        setEditNotes(itemData.notes || '');
                        setEditPhotos(
                          itemData.allImageUris && itemData.allImageUris.length > 0
                            ? itemData.allImageUris
                            : (itemData.imageUri ? [itemData.imageUri] : [])
                        );
                      }
                    }}
                  >
                    <Text style={styles.editCancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.editSaveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                  </Pressable>
                </View>
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
    borderRadius: radius.sm,
  },
  reputationBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
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
    marginBottom: spacing.md,
  },
  notesText: {
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  tapToExpandHint: {
    position: 'absolute',
    bottom: spacing.md,
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
    backgroundColor: colors.card,
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
    borderRadius: radius.sm,
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
  // Compact Edit Mode Styles
  editPhotoSection: {
    marginBottom: spacing.md,
  },
  editLabel: {
    marginBottom: spacing.xs,
  },
  editPhotoScroll: {
    marginHorizontal: -spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  editPhotoWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  editThumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  editRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editRemoveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  editAddPhotoBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAddPhotoIcon: {
    fontSize: 24,
    color: colors.textMuted,
  },
  editInputGroup: {
    marginBottom: spacing.md,
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  editConditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  editConditionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editConditionPillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  editConditionPillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  editConditionPillTextSelected: {
    color: '#FFFFFF',
  },
  editPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editPriceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
  },
  editPricePrefix: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  editPriceInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
  },
  editNotSureBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  editNotSureBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  editNotesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  editCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  editSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  editSaveBtnDisabled: {
    opacity: 0.5,
  },
  editSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
