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
  KeyboardAvoidingView,
  Platform,
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

// Build title from user input or category details
function buildTitleFromDetails(draft: ReturnType<typeof useItemsStore.getState>['draft']): string {
  if (!draft) return 'Untitled Item';

  // If user entered/edited a title, use it as the base
  if (draft.title?.trim()) {
    return draft.title.trim();
  }

  // Otherwise, build from category-specific details
  const categoryLower = (draft.category || '').toLowerCase();
  const parts: string[] = [];

  if (categoryLower.includes('clothing') && draft.clothingDetails) {
    const { brand, color, type, size, material } = draft.clothingDetails;
    // Build: "Brand Color Material Type Size" e.g. "Old Navy Blue Denim Jeans Size M"
    if (brand) parts.push(brand);
    if (color) parts.push(color);
    if (material) parts.push(material);
    if (type) parts.push(type);
    if (size) parts.push(`Size ${size}`);
  } else if (categoryLower.includes('electronics') && draft.electronicsDetails) {
    const { brand, model, storage, color } = draft.electronicsDetails;
    if (brand) parts.push(brand);
    if (model) parts.push(model);
    if (storage) parts.push(storage);
    if (color) parts.push(color);
  } else if (categoryLower.includes('furniture') && draft.furnitureDetails) {
    const { material, color, style } = draft.furnitureDetails;
    if (style) parts.push(style);
    if (color) parts.push(color);
    if (material) parts.push(material);
    // Add generic furniture type if nothing else
    if (parts.length > 0) parts.push('Furniture');
  } else if (categoryLower.includes('book') && draft.bookDetails) {
    const { author, subject } = draft.bookDetails;
    if (subject) parts.push(subject);
    parts.push('Book');
    if (author) parts.push(`by ${author}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Untitled Item';
}

export default function PriceReviewScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const commitDraft = useItemsStore((state) => state.commitDraft);
  const clearDraft = useItemsStore((state) => state.clearDraft);
  const user = useAuthStore((state) => state.user);

  // Build title from category details
  const generatedTitle = buildTitleFromDetails(draft);

  // Editable title state - initialized from generated title
  const [editableTitle, setEditableTitle] = useState(generatedTitle);

  const [priceRange, setPriceRange] = useState({ min: 0, max: 0, mid: 0 });
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceConfidence, setPriceConfidence] = useState(0);
  const [priceReasoning, setPriceReasoning] = useState('');
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricingEstimate = async () => {
      if (!generatedTitle || !draft?.category || !draft?.condition) {
        console.warn('[PriceReview] Missing required fields for pricing estimation');
        setLoadingPrice(false);
        return;
      }

      try {
        setLoadingPrice(true);
        console.log('[PriceReview] Fetching price estimation...');

        const result = await estimatePrice({
          title: generatedTitle,
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
          setPriceMinInput(String(result.market_value_min));
          setPriceMaxInput(String(result.market_value_max));
          setPriceConfidence(result.confidence);
          setPriceReasoning(result.reasoning);
          updateDraft({ estimatedPrice: result.estimated_midpoint });
          // Pre-fill retail price with estimated retail (use max as rough retail estimate)
          if (result.market_value_max) {
            setRetailPrice(Math.round(result.market_value_max * 1.5).toString());
          }
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
          setPriceMinInput(String(minPrice));
          setPriceMaxInput(String(maxPrice));
          setPriceConfidence(0.5);
          setPriceReasoning('Estimated based on condition');
          updateDraft({ estimatedPrice: midPrice });
          // Pre-fill retail price with estimated retail
          setRetailPrice(Math.round(maxPrice * 1.5).toString());
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
        // Pre-fill retail price with estimated retail
        setRetailPrice(Math.round(maxPrice * 1.5).toString());
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPricingEstimate();
  }, [generatedTitle, draft?.category, draft?.condition]);

  const handleAddToList = async () => {
    setSubmitting(true);

    try {
      // If user is authenticated, save to Supabase
      if (user) {
        // 1. Upload all images as a group to Supabase Storage (skip if no images)
        const imagesToUpload = (draft?.imageUris || (draft?.imageUri ? [draft.imageUri] : [])).filter(
          (uri) => uri && uri.length > 0
        );

        let photoPaths: string[] = [];
        if (imagesToUpload.length > 0) {
          const uploadResult = await uploadImageGroup(imagesToUpload, user.id);
          photoPaths = uploadResult.paths;
          const { groupId, errors } = uploadResult;

          if (errors.length > 0) {
            console.warn('Some images failed to upload:', errors);
          }

          console.log(`[PriceReview] Uploaded ${photoPaths.length} images with groupId: ${groupId}`);
        } else {
          console.log('[PriceReview] No images to upload, proceeding without photos');
        }

        // 2. Create item in Supabase - use editable title
        const finalTitle = editableTitle.trim() || generatedTitle;
        console.log('[PriceReview] Creating item with data:', {
          title: finalTitle,
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          estimated_value_min: priceRange.min,
          estimated_value_max: priceRange.max,
          min_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
        });

        const { data, error } = await createItem({
          title: finalTitle,
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          estimated_value_min: priceMinInput ? parseFloat(priceMinInput) : priceRange.min,
          estimated_value_max: priceMaxInput ? parseFloat(priceMaxInput) : priceRange.max,
          min_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
          retail_price: retailPrice ? parseFloat(retailPrice) : undefined,
          notes: draft?.notes || undefined,
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
        // Guest mode - save locally - use editable title
        const finalTitle = editableTitle.trim() || generatedTitle;
        updateDraft({
          title: finalTitle,
          category: draft?.category || 'General',
          description: draft?.notes || finalTitle || 'Item from photo',
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

  const images = (draft?.imageUris || (draft?.imageUri ? [draft.imageUri] : [])).filter(
    (uri) => uri && uri.length > 0
  );

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

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
        <Header title="Review & Add" onBack={() => navigation.goBack()} />

        {/* Compact Item Card - horizontal layout */}
        <View style={styles.itemCard}>
          {images.length > 0 && images[0] ? (
            <Pressable onPress={() => openFullscreenPhoto(images[0])}>
              <Image source={{ uri: images[0] }} style={styles.thumbnail} />
            </Pressable>
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.thumbnailPlaceholderText}>
                {(editableTitle || generatedTitle || 'I').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text variant="body" size="xs" color="muted">
              {draft?.condition || 'Good'} • {draft?.category || 'General'}
            </Text>
          </View>
        </View>

        {/* Item Title - editable with wrapping */}
        <View style={styles.titleSection}>
          <Text variant="body" size="xs" color="muted" style={styles.titleLabel}>
            ITEM NAME
          </Text>
          <View style={styles.titleInputWrapper}>
            <TextInput
              style={styles.titleInput}
              value={editableTitle}
              onChangeText={setEditableTitle}
              placeholder="Enter item name"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            {editableTitle.length > 0 && (
              <Pressable style={styles.clearTitleButton} onPress={() => setEditableTitle('')}>
                <Text style={styles.clearTitleText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* AI Reasoning */}
        {loadingPrice ? (
          <View style={styles.priceSection}>
            <Text variant="body" size="base" color="muted">Estimating price...</Text>
          </View>
        ) : priceReasoning ? (
          <View style={styles.reasoningSection}>
            <Text variant="body" size="xs" color="muted">{priceReasoning}</Text>
            {priceConfidence > 0 && (
              <Text variant="body" size="xs" color="muted" style={{ marginTop: spacing.xs }}>
                {(priceConfidence * 100).toFixed(0)}% confidence
              </Text>
            )}
          </View>
        ) : null}

        {/* Price Range - editable */}
        <View style={styles.inputSection}>
          <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
            Price Range
          </Text>
          <View style={styles.priceRangeRow}>
            <View style={[styles.priceInputRow, { flex: 1 }]}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={priceMinInput}
                onChangeText={setPriceMinInput}
                placeholder="Min"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.rangeDash}>–</Text>
            <View style={[styles.priceInputRow, { flex: 1 }]}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={priceMaxInput}
                onChangeText={setPriceMaxInput}
                placeholder="Max"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text variant="body" size="xs" color="muted">
            Auto-filled by AI — edit if needed
          </Text>
        </View>

        {/* Original Purchase Price */}
        <View style={styles.inputSection}>
          <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
            Original Purchase Price
          </Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={retailPrice}
              onChangeText={setRetailPrice}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            {retailPrice.length > 0 && (
              <Pressable style={styles.clearInputButton} onPress={() => setRetailPrice('')}>
                <Text style={styles.clearInputText}>✕</Text>
              </Pressable>
            )}
          </View>
          <Text variant="body" size="xs" color="muted">
            Auto-filled by AI — edit if needed
          </Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoid: {
    flex: 1,
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
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  thumbnailPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  // Title section
  titleSection: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  titleInputWrapper: {
    position: 'relative',
  },
  titleInput: {
    fontFamily: typography?.fonts?.bodyMedium || 'DMSans_500Medium',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
    paddingRight: 32,
    lineHeight: 22,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  clearTitleButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearTitleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  reasoningSection: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rangeDash: {
    fontSize: 18,
    color: colors.textMuted,
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

