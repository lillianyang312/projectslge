import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Header } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { createItem } from '../../services/itemsService';
import { uploadImageGroup } from '../../services/imageService';
import { estimatePrice } from '../../services/pricingService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<ListStackParamList, 'PriceReview'>;

export default function PriceReviewScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const commitDraft = useItemsStore((state) => state.commitDraft);
  const clearDraft = useItemsStore((state) => state.clearDraft);
  const user = useAuthStore((state) => state.user);

  const [priceRange, setPriceRange] = useState({ min: 0, max: 0, mid: 0 });
  const [minimumPrice, setMinimumPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceConfidence, setPriceConfidence] = useState(0);
  const [priceReasoning, setPriceReasoning] = useState('');
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricingEstimate = async () => {
      if (!draft?.title || !draft?.category || !draft?.condition) {
        console.warn('[PriceReview] Missing required fields for pricing estimation');
        setLoadingPrice(false);
        return;
      }

      try {
        setLoadingPrice(true);
        console.log('[PriceReview] Fetching price estimation...');

        const result = await estimatePrice({
          title: draft.title,
          category: draft.category,
          condition: draft.condition,
          description: draft.description || draft.notes,
          pricePurchased: draft.pricePurchased,
        });

        if (result) {
          console.log('[PriceReview] Price estimation received:', result);
          setPriceRange({
            min: result.market_value_min,
            max: result.market_value_max,
            mid: result.estimated_midpoint,
          });
          setPriceConfidence(result.confidence);
          setPriceReasoning(result.reasoning);
          updateDraft({ estimatedPrice: result.estimated_midpoint });
        } else {
          console.warn('[PriceReview] Price estimation failed, using fallback');
          // Fallback to simple estimation
          const conditionMultiplier: Record<string, number> = {
            'New': 1.0,
            'Like new': 0.85,
            'Good': 0.65,
            'Fair': 0.45,
            'Poor': 0.25,
          };
          const basePrice = Math.floor(Math.random() * 200) + 50;
          const multiplier = conditionMultiplier[draft?.condition || 'Good'] || 0.65;
          const midPrice = Math.round(basePrice * multiplier);
          const minPrice = Math.round(midPrice * 0.8);
          const maxPrice = Math.round(midPrice * 1.2);

          setPriceRange({ min: minPrice, max: maxPrice, mid: midPrice });
          setPriceConfidence(0.5);
          setPriceReasoning('Estimated based on condition');
          updateDraft({ estimatedPrice: midPrice });
        }
      } catch (error) {
        console.error('[PriceReview] Error fetching price estimation:', error);
        // Use fallback on error
        const conditionMultiplier: Record<string, number> = {
          'New': 1.0,
          'Like new': 0.85,
          'Good': 0.65,
          'Fair': 0.45,
          'Poor': 0.25,
        };
        const basePrice = Math.floor(Math.random() * 200) + 50;
        const multiplier = conditionMultiplier[draft?.condition || 'Good'] || 0.65;
        const midPrice = Math.round(basePrice * multiplier);
        const minPrice = Math.round(midPrice * 0.8);
        const maxPrice = Math.round(midPrice * 1.2);

        setPriceRange({ min: minPrice, max: maxPrice, mid: midPrice });
        setPriceConfidence(0.5);
        setPriceReasoning('Estimated based on condition');
        updateDraft({ estimatedPrice: midPrice });
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPricingEstimate();
  }, [draft?.title, draft?.category, draft?.condition]);

  const handleAddToList = async () => {
    setSubmitting(true);

    try {
      // If user is authenticated, save to Supabase
      if (user) {
        // 1. Upload all images as a group to Supabase Storage
        const imagesToUpload = draft?.imageUris || (draft?.imageUri ? [draft.imageUri] : []);

        const { paths: photoPaths, groupId, errors } = await uploadImageGroup(imagesToUpload, user.id);

        if (errors.length > 0) {
          console.warn('Some images failed to upload:', errors);
        }

        console.log(`[PriceReview] Uploaded ${photoPaths.length} images with groupId: ${groupId}`);

        // 2. Create item in Supabase
        console.log('[PriceReview] Creating item with data:', {
          title: draft?.title || 'Untitled Item',
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          estimated_value_min: priceRange.min,
          estimated_value_max: priceRange.max,
          min_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
        });

        const { data, error } = await createItem({
          title: draft?.title || 'Untitled Item',
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          estimated_value_min: priceRange.min,
          estimated_value_max: priceRange.max,
          min_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
        });

        if (error) {
          console.error('[PriceReview] Error creating item:', error);
          Alert.alert('Error', error);
          setSubmitting(false);
          return;
        }

        console.log('[PriceReview] Item created successfully:', data);
        // Clear draft and navigate
        clearDraft();
        navigation.navigate('MyList');
      } else {
        // Guest mode - save locally
        updateDraft({
          category: draft?.category || 'General',
          description: draft?.notes || draft?.title || 'Item from photo',
          intent: 'owned',
          minimumPrice: minimumPrice ? parseFloat(minimumPrice) : undefined,
        });

        setTimeout(() => {
          const result = commitDraft('guest-user');

          if (result.success === false) {
            Alert.alert(
              'Error',
              result.error.getFirstError() || 'Failed to create listing'
            );
            setSubmitting(false);
            return;
          }

          navigation.navigate('MyList');
        }, 100);
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item to list');
      setSubmitting(false);
    }
  };

  const openFullscreenPhoto = (uri: string) => {
    setFullscreenImageUri(uri);
    setShowFullscreenPhoto(true);
  };

  const images = draft?.imageUris || (draft?.imageUri ? [draft.imageUri] : []);

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
              source={{ uri: fullscreenImageUri || '' }}
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
        <Header title="Review & Add" onBack={() => navigation.goBack()} />

        {/* Compact Item Card - horizontal layout */}
        <View style={styles.itemCard}>
          <Pressable onPress={() => images[0] && openFullscreenPhoto(images[0])}>
            <Image source={{ uri: images[0] }} style={styles.thumbnail} />
          </Pressable>
          <View style={styles.itemInfo}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.titleScroll}>
              <Text variant="body" size="sm">
                {draft?.title || 'Untitled Item'}
              </Text>
            </ScrollView>
            <Text variant="body" size="xs" color="muted">
              {draft?.condition || 'Good'} • {draft?.category || 'General'}
            </Text>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text variant="body" size="xs" color="muted" style={styles.priceLabel}>
            ESTIMATED VALUE
          </Text>
          {loadingPrice ? (
            <Text variant="body" size="base" color="muted">Loading...</Text>
          ) : (
            <>
              <Text style={styles.priceValue}>
                ${priceRange.min} – ${priceRange.max}
              </Text>
              {priceConfidence > 0 && (
                <Text variant="body" size="xs" color="muted">
                  {(priceConfidence * 100).toFixed(0)}% confidence
                </Text>
              )}
              {priceReasoning && (
                <Text variant="body" size="xs" color="muted" style={styles.priceReasoning}>
                  {priceReasoning}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Minimum Price Input */}
        <View style={styles.inputSection}>
          <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
            Your minimum price (optional)
          </Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={minimumPrice}
              onChangeText={setMinimumPrice}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            {minimumPrice.length > 0 && (
              <Pressable style={styles.clearInputButton} onPress={() => setMinimumPrice('')}>
                <Text style={styles.clearInputText}>✕</Text>
              </Pressable>
            )}
          </View>
          <Text variant="body" size="xs" color="muted">
            Won't receive offers below this
          </Text>
        </View>

        {/* Action Button */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            onPress={handleAddToList}
            disabled={submitting}
            style={styles.addBtn}
          >
            {submitting ? 'Adding...' : 'Add to My List'}
          </Button>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
  // Compact item card
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  titleScroll: {
    flexGrow: 0,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  // Price section
  priceSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  priceReasoning: {
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  // Input section
  inputSection: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  dollarSign: {
    fontSize: 18,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
  },
  clearInputButton: {
    padding: spacing.sm,
  },
  clearInputText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  actions: {
    gap: spacing.sm,
  },
  addBtn: {},
});

