import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { createItem } from '../../services/itemsService';
import { uploadImageGroup } from '../../services/imageService';
import { estimatePrice, calculateDisplayRange } from '../../services/pricingService';

type Props = NativeStackScreenProps<ListStackParamList, 'BulkPriceReview'>;

export default function BulkPriceReviewScreen({ navigation, route }: Props) {
  const itemIndex = route.params?.itemIndex ?? 0;

  const bulkItems = useItemsStore((state) => state.bulkItems);
  const updateBulkItem = useItemsStore((state) => state.updateBulkItem);
  const ungroupItem = useItemsStore((state) => state.ungroupItem);
  const setCurrentItemIndex = useItemsStore((state) => state.setCurrentItemIndex);
  const user = useAuthStore((state) => state.user);

  const currentItem = bulkItems[itemIndex];
  const totalItems = bulkItems.length;

  // Price state
  const [priceRange, setPriceRange] = useState({
    min: currentItem?.estimatedPriceMin || 0,
    max: currentItem?.estimatedPriceMax || 0,
  });
  const [priceMinInput, setPriceMinInput] = useState(
    currentItem?.estimatedPriceMin ? String(currentItem.estimatedPriceMin) : ''
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    currentItem?.estimatedPriceMax ? String(currentItem.estimatedPriceMax) : ''
  );
  const [minimumPrice, setMinimumPrice] = useState(
    currentItem?.minimumPrice?.toString() || ''
  );
  const [retailPrice, setRetailPrice] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(!currentItem?.estimatedPriceMin);
  const [priceConfidence, setPriceConfidence] = useState(currentItem?.priceConfidence || 0);
  const [priceReasoning, setPriceReasoning] = useState(currentItem?.priceReasoning || '');
  const [publishing, setPublishing] = useState(false);

  // Publish a single item immediately
  const publishSingleItem = async () => {
    if (!user || !currentItem) return;

    setPublishing(true);
    try {
      // Save current item state first
      saveCurrentItem();

      // Upload images (skip if none)
      const validImageUris = currentItem.imageUris.filter((uri) => uri && uri.length > 0);
      let photoPaths: string[] = [];

      if (validImageUris.length > 0) {
        const uploadResult = await uploadImageGroup(validImageUris, user.id);
        photoPaths = uploadResult.paths;

        if (uploadResult.errors.length > 0) {
          console.warn('[BulkPriceReview] Some images failed to upload:', uploadResult.errors);
        }
      }

      // Create item in database
      const { data, error } = await createItem({
        title: currentItem.verifiedTitle || currentItem.title || 'Untitled Item',
        category: currentItem.verifiedCategory || currentItem.category || 'General',
        condition: currentItem.verifiedCondition || currentItem.condition || 'Good',
        photos: photoPaths,
        estimated_value_min: priceMinInput ? parseFloat(priceMinInput) : priceRange.min,
        estimated_value_max: priceMaxInput ? parseFloat(priceMaxInput) : priceRange.max,
        min_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
        notes: currentItem.notes,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      // Remove the item from bulkItems after successful publish
      ungroupItem(currentItem.id);

      const remainingItems = bulkItems.length - 1;

      if (remainingItems <= 0) {
        // Last item published, navigate to MyList
        Alert.alert('Published!', 'Item has been published to your list.', [
          { text: 'View My List', onPress: () => navigation.navigate('MyList') },
        ]);
      } else {
        // Stay in the flow, adjust index if needed
        const newIndex = Math.min(itemIndex, remainingItems - 1);
        Alert.alert('Published!', `Item published. ${remainingItems} item${remainingItems !== 1 ? 's' : ''} remaining.`);
        setCurrentItemIndex(newIndex);
        navigation.replace('ItemVerification', { itemIndex: newIndex });
      }
    } catch (err) {
      console.error('[BulkPriceReview] Error publishing item:', err);
      Alert.alert('Error', 'Failed to publish item. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // Fetch price estimation
  useEffect(() => {
    const fetchPricingEstimate = async () => {
      if (!currentItem || currentItem.estimatedPriceMin) {
        setLoadingPrice(false);
        return;
      }

      const title = currentItem.verifiedTitle || currentItem.title;
      const category = currentItem.verifiedCategory || currentItem.category;
      const condition = currentItem.verifiedCondition || currentItem.condition;

      if (!title || !category || !condition) {
        setLoadingPrice(false);
        return;
      }

      try {
        setLoadingPrice(true);
        const result = await estimatePrice({
          title,
          category,
          condition,
          description: currentItem.notes,
          categoryFields: currentItem.categoryFields,
        });

        if (result) {
          const { displayMin, displayMax } = calculateDisplayRange(
            result.market_value_min,
            result.market_value_max,
            'If good offer'
          );
          setPriceRange({ min: displayMin, max: displayMax });
          setPriceMinInput(String(displayMin));
          setPriceMaxInput(String(displayMax));
          setRetailPrice(String(Math.round(displayMax * 1.5)));
          setPriceConfidence(result.confidence);
          setPriceReasoning(result.reasoning || '');
          updateBulkItem(currentItem.id, {
            estimatedPriceMin: displayMin,
            estimatedPriceMax: displayMax,
            priceConfidence: result.confidence,
            priceReasoning: result.reasoning,
          });
        } else {
          const fallbackPrice = generateFallbackPrice(condition);
          setPriceRange(fallbackPrice);
          setPriceMinInput(String(fallbackPrice.min));
          setPriceMaxInput(String(fallbackPrice.max));
          setRetailPrice(String(Math.round(fallbackPrice.max * 1.5)));
          setPriceConfidence(0.5);
          setPriceReasoning('Estimated based on condition');
          updateBulkItem(currentItem.id, {
            estimatedPriceMin: fallbackPrice.min,
            estimatedPriceMax: fallbackPrice.max,
            priceConfidence: 0.5,
          });
        }
      } catch {
        const fallbackPrice = generateFallbackPrice(
          currentItem.verifiedCondition || currentItem.condition || 'Good'
        );
        setPriceRange(fallbackPrice);
        setPriceMinInput(String(fallbackPrice.min));
        setPriceMaxInput(String(fallbackPrice.max));
        setRetailPrice(String(Math.round(fallbackPrice.max * 1.5)));
        setPriceConfidence(0.5);
        setPriceReasoning('Estimated based on condition');
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPricingEstimate();
  }, [itemIndex, currentItem?.id]);

  const generateFallbackPrice = (condition: string): { min: number; max: number } => {
    const conditionMultiplier: Record<string, number> = {
      'New': 1.0,
      'Like new': 0.85,
      'Good': 0.65,
      'Fair': 0.45,
      'Poor': 0.25,
    };
    const basePrice = Math.floor(Math.random() * 200) + 50;
    const multiplier = conditionMultiplier[condition] || 0.65;
    const midPrice = Math.round(basePrice * multiplier);
    return {
      min: Math.round(midPrice * 0.8),
      max: Math.round(midPrice * 1.2),
    };
  };

  const handleDeleteItem = () => {
    Alert.alert(
      'Delete Item',
      'Remove this item from your upload?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            ungroupItem(currentItem.id);
            if (totalItems <= 1) {
              navigation.navigate('Upload');
            } else if (itemIndex >= totalItems - 1) {
              navigation.goBack();
            } else {
              navigation.replace('BulkPriceReview', { itemIndex });
            }
          },
        },
      ]
    );
  };

  const saveCurrentItem = () => {
    updateBulkItem(currentItem.id, {
      minimumPrice: minimumPrice ? parseFloat(minimumPrice) : undefined,
      estimatedPriceMin: priceMinInput ? parseFloat(priceMinInput) : priceRange.min,
      estimatedPriceMax: priceMaxInput ? parseFloat(priceMaxInput) : priceRange.max,
      retailPrice: retailPrice ? parseFloat(retailPrice) : undefined,
      priceConfidence,
      isPriceConfirmed: true,
    });
  };

  const handleConfirmAndNext = () => {
    saveCurrentItem();
    if (itemIndex < totalItems - 1) {
      // Go to ID (verification) for the next item
      setCurrentItemIndex(itemIndex + 1);
      navigation.push('ItemVerification', { itemIndex: itemIndex + 1 });
    } else {
      navigation.navigate('BulkSummary');
    }
  };

  const handlePrevious = () => {
    saveCurrentItem();
    if (itemIndex > 0) {
      setCurrentItemIndex(itemIndex - 1);
      navigation.goBack();
    } else {
      navigation.navigate('ItemVerification', { itemIndex: totalItems - 1 });
    }
  };

  const handleEditItem = () => {
    saveCurrentItem();
    navigation.navigate('ItemVerification', { itemIndex });
  };

  if (!currentItem) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Text variant="body" size="lg" color="muted">No items to price</Text>
          <Button variant="primary" onPress={() => navigation.navigate('MyList')}>
            Go to My List
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Compact Header with Delete */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Text style={styles.backButton}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text variant="bodyMedium" size="base">
              Price {itemIndex + 1}/{totalItems}
            </Text>
            <View style={styles.miniProgress}>
              {Array.from({ length: totalItems }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.miniDot, i <= itemIndex && styles.miniDotActive]}
                />
              ))}
            </View>
          </View>
          <Pressable onPress={handleDeleteItem} style={styles.headerButton}>
            <Text style={styles.deleteButton}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Compact Item Card */}
          <View style={styles.itemCard}>
            {/* Image + Info Row */}
            <View style={styles.itemRow}>
              {currentItem.imageUris.length > 0 && currentItem.imageUris[0] ? (
                <Image
                  source={{ uri: currentItem.imageUris[0] }}
                  style={styles.itemImage}
                />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                  <Text style={styles.itemImagePlaceholderText}>
                    {(currentItem.verifiedTitle || currentItem.title || 'I').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text variant="body" size="sm" numberOfLines={0}>
                    {currentItem.verifiedTitle || currentItem.title || 'Untitled'}
                </Text>
                <View style={styles.itemMeta}>
                  <Text variant="body" size="xs" color="muted">
                    {currentItem.verifiedCondition || currentItem.condition || 'Good'}
                  </Text>
                  <Text variant="body" size="xs" color="muted">•</Text>
                  <Text variant="body" size="xs" color="muted">
                    {currentItem.verifiedCategory || currentItem.category || 'General'}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.editButton} onPress={handleEditItem}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>
          </View>

          {/* AI Reasoning */}
          {loadingPrice ? (
            <View style={styles.priceSection}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text variant="body" size="sm" color="muted">Estimating price...</Text>
              </View>
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
            <Text variant="body" size="xs" color="muted">
              Offers below this will be flagged as low
            </Text>
          </View>
        </ScrollView>

        {/* Fixed Bottom Navigation */}
        <View style={styles.bottomNav}>
          <Pressable
            style={[styles.publishButton, (loadingPrice || publishing) && styles.navButtonDisabled]}
            onPress={publishSingleItem}
            disabled={loadingPrice || publishing}
          >
            <Text style={styles.publishButtonText}>
              {publishing ? 'Publishing...' : 'Publish This Item'}
            </Text>
          </Pressable>
          <View style={styles.bottomNavRow}>
            <Pressable style={styles.navButtonSecondary} onPress={handlePrevious}>
              <Text style={styles.navButtonSecondaryText}>← Back</Text>
            </Pressable>
            <Pressable
              style={[styles.navButtonPrimary, (loadingPrice || publishing) && styles.navButtonDisabled]}
              onPress={handleConfirmAndNext}
              disabled={loadingPrice || publishing}
            >
              <Text style={styles.navButtonPrimaryText}>
                {itemIndex < totalItems - 1 ? 'Next Item →' : 'Review All →'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  backButton: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  deleteButton: {
    fontSize: 20,
    color: colors.danger || '#E53935',
    fontWeight: '600',
  },
  miniProgress: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  miniDotActive: {
    backgroundColor: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  itemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  itemImagePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceValue: {
    fontSize: 32,
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
  },
  clearInputButton: {
    padding: spacing.sm,
  },
  clearInputText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  bottomNav: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  bottomNavRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  publishButton: {
    backgroundColor: colors.success || '#4CAF50',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    width: '100%',
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  navButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonPrimary: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
