import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Input, Card, Header, Badge } from '../../ui/components';
import { colors, spacing, radius, shadows } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { createItem } from '../../services/itemsService';
import { uploadImage } from '../../services/imageService';

type Props = NativeStackScreenProps<ListStackParamList, 'PriceReview'>;

export default function PriceReviewScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const commitDraft = useItemsStore((state) => state.commitDraft);
  const clearDraft = useItemsStore((state) => state.clearDraft);
  const user = useAuthStore((state) => state.user);

  // Simulated estimated price range (in real app, this would come from API)
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0, mid: 0 });
  const [minimumPrice, setMinimumPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Simulate API call for price estimation
    // In real implementation, this would call your pricing API
    const simulateEstimatedPriceRange = () => {
      // Generate a reasonable price based on condition
      const conditionMultiplier: Record<string, number> = {
        'New': 1.0,
        'Like new': 0.85,
        'Good': 0.65,
        'Fair': 0.45,
        'Poor': 0.25,
      };

      // Base price simulation (would come from API in real app)
      const basePrice = Math.floor(Math.random() * 200) + 50; // $50-$250
      const multiplier = conditionMultiplier[draft?.condition || 'Good'] || 0.65;
      const midPrice = Math.round(basePrice * multiplier);

      // Create range: -20% to +20% of mid price
      const minPrice = Math.round(midPrice * 0.8);
      const maxPrice = Math.round(midPrice * 1.2);

      setPriceRange({ min: minPrice, max: maxPrice, mid: midPrice });
      updateDraft({ estimatedPrice: midPrice });
    };

    simulateEstimatedPriceRange();
  }, []);

  const handleEdit = () => {
    navigation.goBack();
  };

  const handleAddToList = async () => {
    setSubmitting(true);

    try {
      // If user is authenticated, save to Supabase
      if (user) {
        // 1. Upload all images to Supabase Storage
        const photoPaths: string[] = [];
        const imagesToUpload = draft?.imageUris || (draft?.imageUri ? [draft.imageUri] : []);

        for (const imageUri of imagesToUpload) {
          const uploadResult = await uploadImage(imageUri, user.id);
          if (uploadResult.error) {
            console.warn('Image upload failed:', uploadResult.error);
            // Continue without this image - not critical
          } else if (uploadResult.path) {
            photoPaths.push(uploadResult.path);
          }
        }

        // 2. Create item in Supabase
        console.log('[PriceReview] Creating item with data:', {
          title: draft?.title || 'Untitled Item',
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          delivery_pref: draft?.deliveryPref || 'local_only',
          asking_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
        });

        const { data, error } = await createItem({
          title: draft?.title || 'Untitled Item',
          category: draft?.category || 'General',
          condition: draft?.condition || 'Good',
          photos: photoPaths,
          delivery_pref: draft?.deliveryPref || 'local_only',
          asking_price: minimumPrice ? parseFloat(minimumPrice) : undefined,
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

  const getSellIntentLabel = () => {
    const labels: Record<string, string> = {
      'keep': 'Want to keep',
      'might_sell': 'Might sell',
      'sell': 'Ready to sell',
    };
    return labels[draft?.sellIntent || 'might_sell'] || 'Might sell';
  };

  const getDeliveryLabel = () => {
    const labels: Record<string, string> = {
      'local_only': 'Local only',
      'shipping_ok': 'Shipping OK',
      'both': 'Local & Shipping',
    };
    return labels[draft?.deliveryPref || 'local_only'] || 'Local only';
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Header title="Review & Add" onBack={() => navigation.goBack()} />

        {/* Image Preview - show first image or all images */}
        {(draft?.imageUri || (draft?.imageUris && draft.imageUris.length > 0)) && (
          <Card style={styles.imageCard}>
            <Image
              source={{ uri: draft?.imageUris?.[0] || draft?.imageUri || '' }}
              style={styles.image}
            />
            {draft?.imageUris && draft.imageUris.length > 1 && (
              <View style={styles.imageCount}>
                <Text variant="bodyMedium" size="sm" style={styles.imageCountText}>
                  +{draft.imageUris.length - 1} more
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Item Summary Card */}
        <Card style={styles.summaryCard}>
          <Text variant="headingMedium" size="xl" style={styles.itemTitle}>
            {draft?.title || 'Untitled Item'}
          </Text>
          
          <View style={styles.badges}>
            <Badge variant="neutral" text={draft?.condition || 'Good'} />
            <Badge variant="purple" text={getSellIntentLabel()} />
            <Badge variant="blue" text={getDeliveryLabel()} />
          </View>

          {draft?.pricePurchased && (
            <View style={styles.infoRow}>
              <Text variant="body" size="sm" color="muted">
                Price purchased:
              </Text>
              <Text variant="bodyMedium" size="md">
                ${draft.pricePurchased.toFixed(2)}
              </Text>
            </View>
          )}

          {draft?.notes && (
            <View style={styles.notesSection}>
              <Text variant="body" size="sm" color="muted" style={styles.notesLabel}>
                Notes:
              </Text>
              <Text variant="body" size="base" color="secondary">
                {draft.notes}
              </Text>
            </View>
          )}
        </Card>

        {/* Price Section */}
        <Card style={styles.priceCard}>
          <View style={styles.estimatedSection}>
            <Text variant="body" size="sm" color="muted" style={styles.priceLabel}>
              ESTIMATED VALUE RANGE
            </Text>
            <Text variant="heading" size="display" style={styles.priceValue}>
              ${priceRange.min} – ${priceRange.max}
            </Text>
            <Text variant="body" size="xs" color="muted" style={styles.priceHint}>
              Based on condition and market data
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.minimumSection}>
            <Input
              label="Minimum price to sell (optional)"
              placeholder="$0"
              value={minimumPrice}
              onChangeText={setMinimumPrice}
              keyboardType="numeric"
            />
            <Text variant="body" size="xs" color="muted" style={styles.minimumHint}>
              You won't receive offers below this price
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            variant="secondary"
            onPress={handleEdit}
            style={styles.editBtn}
          >
            ← Edit details
          </Button>
          
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
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.accentSoft,
  },
  imageCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  imageCountText: {
    color: '#FFFFFF',
  },
  summaryCard: {
    marginBottom: spacing.xl,
  },
  itemTitle: {
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesLabel: {
    marginBottom: spacing.xs,
  },
  priceCard: {
    marginBottom: spacing.xxl,
  },
  estimatedSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  priceLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  priceValue: {
    color: colors.success,
    marginBottom: spacing.xs,
  },
  priceHint: {
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  minimumSection: {},
  minimumHint: {
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
  editBtn: {},
  addBtn: {},
});

