import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Card, Header, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useItemsStore, BulkUploadItem } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { createItem } from '../../services/itemsService';
import { uploadImageGroup } from '../../services/imageService';

type Props = NativeStackScreenProps<ListStackParamList, 'BulkSummary'>;

export default function BulkSummaryScreen({ navigation }: Props) {
  const bulkItems = useItemsStore((state) => state.bulkItems);
  const clearBulkUpload = useItemsStore((state) => state.clearBulkUpload);
  const setCurrentItemIndex = useItemsStore((state) => state.setCurrentItemIndex);
  const user = useAuthStore((state) => state.user);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleEditItem = (index: number) => {
    setCurrentItemIndex(index);
    navigation.navigate('ItemVerification', { itemIndex: index });
  };

  const handleAddAllToList = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to add items to your list.');
      return;
    }

    setSubmitting(true);
    setProgress(0);

    try {
      const totalItems = bulkItems.length;
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < bulkItems.length; i++) {
        const item = bulkItems[i];
        setProgress(((i + 1) / totalItems) * 100);

        try {
          // Upload all images as a group
          const { paths: photoPaths, groupId, errors: uploadErrors } = await uploadImageGroup(
            item.imageUris,
            user.id
          );

          if (uploadErrors.length > 0) {
            console.warn(`[BulkSummary] Item ${i + 1} had upload errors:`, uploadErrors);
          }

          console.log(`[BulkSummary] Item ${i + 1} images uploaded with groupId: ${groupId}`);

          // Create item in database
          const { data, error } = await createItem({
            title: item.verifiedTitle || item.title || 'Untitled Item',
            category: item.verifiedCategory || item.category || 'General',
            condition: item.verifiedCondition || item.condition || 'Good',
            photos: photoPaths,
            estimated_value_min: item.estimatedPriceMin,
            estimated_value_max: item.estimatedPriceMax,
            min_price: item.minimumPrice,
            notes: item.notes,
          });

          if (error) {
            console.error(`[BulkSummary] Error creating item ${i + 1}:`, error);
            errors.push(`Item ${i + 1}: ${error}`);
          } else {
            successCount++;
            console.log(`[BulkSummary] Item ${i + 1} created successfully:`, data);
          }
        } catch (itemError) {
          console.error(`[BulkSummary] Exception creating item ${i + 1}:`, itemError);
          errors.push(`Item ${i + 1}: Failed to create`);
        }
      }

      // Show results
      if (successCount === totalItems) {
        Alert.alert(
          'Success!',
          `All ${totalItems} items have been added to your list.`,
          [
            {
              text: 'View My List',
              onPress: () => {
                clearBulkUpload();
                navigation.navigate('MyList');
              },
            },
          ]
        );
      } else if (successCount > 0) {
        Alert.alert(
          'Partial Success',
          `${successCount} of ${totalItems} items were added. ${errors.length} failed:\n\n${errors.join('\n')}`,
          [
            {
              text: 'View My List',
              onPress: () => {
                clearBulkUpload();
                navigation.navigate('MyList');
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Upload Failed',
          `Failed to add items:\n\n${errors.join('\n')}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[BulkSummary] Error in bulk upload:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  const totalEstimatedValue = bulkItems.reduce((sum, item) => {
    const avg = ((item.estimatedPriceMin || 0) + (item.estimatedPriceMax || 0)) / 2;
    return sum + avg;
  }, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header title="Review & Add All" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Stats */}
        <Card style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text variant="heading" size="display" style={styles.statValue}>
                {bulkItems.length}
              </Text>
              <Text variant="body" size="sm" color="muted">
                Items
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text variant="heading" size="display" style={styles.statValue}>
                ${Math.round(totalEstimatedValue)}
              </Text>
              <Text variant="body" size="sm" color="muted">
                Est. Total Value
              </Text>
            </View>
          </View>
        </Card>

        {/* Items List */}
        <View style={styles.itemsList}>
          <Text variant="headingMedium" size="md" style={styles.listTitle}>
            Your Items
          </Text>

          {bulkItems.map((item, index) => (
            <ItemSummaryCard
              key={item.id}
              item={item}
              itemNumber={index + 1}
              onEdit={() => handleEditItem(index)}
            />
          ))}
        </View>

        {/* Progress indicator when submitting */}
        {submitting && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text variant="body" size="sm" color="muted" style={styles.progressText}>
              Adding items... {Math.round(progress)}%
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer with Add All button */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleAddAllToList}
          disabled={submitting || bulkItems.length === 0}
          style={styles.addAllButton}
        >
          {submitting
            ? 'Adding Items...'
            : `Add All ${bulkItems.length} Items to My List`}
        </Button>
      </View>
    </SafeAreaView>
  );
}

interface ItemSummaryCardProps {
  item: BulkUploadItem;
  itemNumber: number;
  onEdit: () => void;
}

function ItemSummaryCard({ item, itemNumber, onEdit }: ItemSummaryCardProps) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemContent}>
        {/* Thumbnail */}
        <Image
          source={{ uri: item.imageUris[0] }}
          style={styles.itemThumbnail}
        />

        {/* Details */}
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text variant="bodyMedium" size="base" numberOfLines={1} style={styles.itemTitle}>
              {item.verifiedTitle || item.title || 'Untitled Item'}
            </Text>
            <Badge
              variant="neutral"
              text={`#${itemNumber}`}
            />
          </View>

          <View style={styles.itemBadges}>
            <Badge
              variant="neutral"
              text={item.verifiedCondition || item.condition || 'Good'}
            />
            <Badge
              variant="neutral"
              text={item.verifiedCategory || item.category || 'General'}
            />
          </View>

          <View style={styles.itemPriceRow}>
            <Text variant="bodyMedium" size="md" style={styles.itemPrice}>
              ${item.estimatedPriceMin || 0} – ${item.estimatedPriceMax || 0}
            </Text>
            {item.minimumPrice && (
              <Text variant="body" size="xs" color="muted">
                Min: ${item.minimumPrice}
              </Text>
            )}
          </View>
        </View>

        {/* Edit button */}
        <Pressable style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      {/* Photo count indicator */}
      {item.imageUris.length > 1 && (
        <View style={styles.photoCount}>
          <Text variant="body" size="xs" color="muted">
            {item.imageUris.length} photos
          </Text>
        </View>
      )}
    </Card>
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
  statsCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  itemsList: {
    marginBottom: spacing.xl,
  },
  listTitle: {
    marginBottom: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  itemThumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  itemDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemTitle: {
    flex: 1,
  },
  itemBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  itemPrice: {
    color: colors.success,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  photoCount: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressContainer: {
    marginTop: spacing.lg,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  progressText: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  addAllButton: {
    width: '100%',
  },
});
