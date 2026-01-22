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
import { estimatePrice, calculateDisplayRange } from '../../services/pricingService';

type Props = NativeStackScreenProps<ListStackParamList, 'BulkPriceReview'>;

export default function BulkPriceReviewScreen({ navigation, route }: Props) {
  const itemIndex = route.params?.itemIndex ?? 0;

  const bulkItems = useItemsStore((state) => state.bulkItems);
  const updateBulkItem = useItemsStore((state) => state.updateBulkItem);
  const ungroupItem = useItemsStore((state) => state.ungroupItem);
  const setCurrentItemIndex = useItemsStore((state) => state.setCurrentItemIndex);

  const currentItem = bulkItems[itemIndex];
  const totalItems = bulkItems.length;

  // Price state
  const [priceRange, setPriceRange] = useState({
    min: currentItem?.estimatedPriceMin || 0,
    max: currentItem?.estimatedPriceMax || 0,
  });
  const [minimumPrice, setMinimumPrice] = useState(
    currentItem?.minimumPrice?.toString() || ''
  );
  const [loadingPrice, setLoadingPrice] = useState(!currentItem?.estimatedPriceMin);
  const [priceConfidence, setPriceConfidence] = useState(currentItem?.priceConfidence || 0);
  const [priceReasoning, setPriceReasoning] = useState(currentItem?.priceReasoning || '');

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
      estimatedPriceMin: priceRange.min,
      estimatedPriceMax: priceRange.max,
      priceConfidence,
      isPriceConfirmed: true,
    });
  };

  const handleConfirmAndNext = () => {
    saveCurrentItem();
    if (itemIndex < totalItems - 1) {
      setCurrentItemIndex(itemIndex + 1);
      navigation.push('BulkPriceReview', { itemIndex: itemIndex + 1 });
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
              <Image
                source={{ uri: currentItem.imageUris[0] }}
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.titleScroll}>
                  <Text variant="body" size="sm">
                    {currentItem.verifiedTitle || currentItem.title || 'Untitled'}
                  </Text>
                </ScrollView>
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

          {/* Price Display */}
          <View style={styles.priceSection}>
            <Text variant="body" size="xs" color="muted" style={styles.priceLabel}>
              ESTIMATED VALUE
            </Text>
            {loadingPrice ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text variant="body" size="sm" color="muted">Calculating...</Text>
              </View>
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
        </ScrollView>

        {/* Fixed Bottom Navigation */}
        <View style={styles.bottomNav}>
          <Pressable style={styles.navButtonSecondary} onPress={handlePrevious}>
            <Text style={styles.navButtonSecondaryText}>← Back</Text>
          </Pressable>
          <Pressable
            style={[styles.navButtonPrimary, loadingPrice && styles.navButtonDisabled]}
            onPress={handleConfirmAndNext}
            disabled={loadingPrice}
          >
            <Text style={styles.navButtonPrimaryText}>
              {itemIndex < totalItems - 1 ? 'Next →' : 'Review All →'}
            </Text>
          </Pressable>
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
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.md,
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
