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
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Input, Pill } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { getItemById, updateItem, deleteItem, Item } from '../../services/itemsService';
import { getSignedUrl } from '../../services/imageService';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetail'>;

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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with back arrow, title, and edit button */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            {itemData.title}
          </Text>
          <Pressable style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
            <Text variant="bodyMedium" size="md" color="primary">
              {isEditing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        </View>

        {/* Item Image */}
        <View style={styles.detailImage}>
          {itemData.imageUri ? (
            <Image source={{ uri: itemData.imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <Text style={styles.imageEmoji}>{itemData.emoji}</Text>
          )}
        </View>

        {/* Category */}
        <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
          {itemData.category}
        </Text>

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

        {/* Action Buttons - only visible in edit mode */}
        {isEditing && (
          <>
            <Button
              variant="primary"
              onPress={handleSave}
              disabled={saving}
              style={styles.saveBtn}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </Button>

            <Button
              variant="secondary"
              onPress={handleDelete}
              style={styles.deleteBtn}
            >
              Delete item
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
  editBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
});
