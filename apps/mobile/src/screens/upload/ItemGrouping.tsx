import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Header, Card } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useItemsStore, BulkUploadItem } from '../../state/itemsStore';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemGrouping'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STRIP_PHOTO_SIZE = 80;
const GROUP_THUMBNAIL_SIZE = 60;

export default function ItemGroupingScreen({ navigation }: Props) {
  const bulkPhotos = useItemsStore((state) => state.bulkPhotos);
  const bulkItems = useItemsStore((state) => state.bulkItems);
  const createItemGroup = useItemsStore((state) => state.createItemGroup);
  const ungroupItem = useItemsStore((state) => state.ungroupItem);
  const setCurrentItemIndex = useItemsStore((state) => state.setCurrentItemIndex);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const togglePhotoSelection = (uri: string) => {
    if (selectedPhotos.includes(uri)) {
      setSelectedPhotos(selectedPhotos.filter((p) => p !== uri));
    } else {
      setSelectedPhotos([...selectedPhotos, uri]);
    }
  };

  const handleCreateGroup = () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('No photos selected', 'Select at least one photo to create an item.');
      return;
    }

    createItemGroup(selectedPhotos);
    setSelectedPhotos([]);
  };

  const handleUngroupItem = (itemId: string) => {
    ungroupItem(itemId);
    setExpandedGroupId(null);
  };

  const handleContinue = () => {
    if (bulkItems.length === 0) {
      Alert.alert('No items', 'Create at least one group to continue.');
      return;
    }

    // Navigate to item verification (unassigned photos are ignored)
    setCurrentItemIndex(0);
    navigation.navigate('ItemVerification', { itemIndex: 0 });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header
        title="Group Photos"
        onBack={() => navigation.goBack()}
        style={styles.header}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Unassigned Photos Strip */}
        <View style={styles.section}>
          <Text variant="headingMedium" size="md" style={styles.sectionTitle}>
            Unassigned Photos ({bulkPhotos.length})
          </Text>
          <Text variant="body" size="sm" color="muted" style={styles.sectionSubtitle}>
            Tap to select, then "Create Group" to combine into one item
          </Text>

          {bulkPhotos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              contentContainerStyle={styles.photoStripContent}
            >
              {bulkPhotos.map((uri) => (
                <Pressable
                  key={uri}
                  style={[
                    styles.stripPhoto,
                    selectedPhotos.includes(uri) && styles.stripPhotoSelected,
                  ]}
                  onPress={() => togglePhotoSelection(uri)}
                >
                  <Image source={{ uri }} style={styles.stripPhotoImage} />
                  {selectedPhotos.includes(uri) && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyStrip}>
              <Text variant="body" size="sm" color="muted">
                All photos have been grouped into items
              </Text>
            </View>
          )}

          {/* Create Group Button */}
          {selectedPhotos.length > 0 && (
            <Button
              variant="primary"
              onPress={handleCreateGroup}
              style={styles.createGroupButton}
            >
              Create Group ({selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''})
            </Button>
          )}
        </View>

        {/* Grouped Items */}
        <View style={styles.section}>
          <Text variant="headingMedium" size="md" style={styles.sectionTitle}>
            Items ({bulkItems.length})
          </Text>

          {bulkItems.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text variant="body" size="base" color="muted" style={styles.emptyText}>
                No items created yet. Select photos above and tap "Create Group" to create an item.
              </Text>
            </Card>
          ) : (
            <View style={styles.itemsList}>
              {bulkItems.map((item, index) => (
                <ItemGroupCard
                  key={item.id}
                  item={item}
                  itemNumber={index + 1}
                  isExpanded={expandedGroupId === item.id}
                  onToggleExpand={() =>
                    setExpandedGroupId(expandedGroupId === item.id ? null : item.id)
                  }
                  onUngroup={() => handleUngroupItem(item.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info about unassigned photos */}
        {bulkPhotos.length > 0 && bulkItems.length > 0 && (
          <Card style={styles.infoCard}>
            <Text variant="body" size="sm" color="secondary">
              {bulkPhotos.length} unassigned photo{bulkPhotos.length !== 1 ? 's' : ''} will not be included. Group them or they'll be skipped.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleContinue}
          disabled={bulkItems.length === 0}
        >
          Continue with {bulkItems.length} item{bulkItems.length !== 1 ? 's' : ''} →
        </Button>
      </View>
    </SafeAreaView>
  );
}

interface ItemGroupCardProps {
  item: BulkUploadItem;
  itemNumber: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUngroup: () => void;
}

function ItemGroupCard({
  item,
  itemNumber,
  isExpanded,
  onToggleExpand,
  onUngroup,
}: ItemGroupCardProps) {
  return (
    <Card style={styles.itemCard}>
      <Pressable style={styles.itemCardHeader} onPress={onToggleExpand}>
        <View style={styles.itemBadge}>
          <Text style={styles.itemBadgeText}>Item {itemNumber}</Text>
        </View>
        <View style={styles.itemThumbnails}>
          {item.imageUris.slice(0, 4).map((uri, index) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[
                styles.itemThumbnail,
                index > 0 && styles.itemThumbnailOverlap,
              ]}
            />
          ))}
          {item.imageUris.length > 4 && (
            <View style={[styles.itemThumbnail, styles.itemThumbnailOverlap, styles.moreIndicator]}>
              <Text style={styles.moreText}>+{item.imageUris.length - 4}</Text>
            </View>
          )}
        </View>
        <Text variant="body" size="sm" color="muted">
          {item.imageUris.length} photo{item.imageUris.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.expandedPhotos}
          >
            {item.imageUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.expandedPhoto} />
            ))}
          </ScrollView>
          <Button
            variant="secondary"
            onPress={onUngroup}
            style={styles.ungroupButton}
          >
            Ungroup photos
          </Button>
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
  header: {
    paddingHorizontal: spacing.xxl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    marginBottom: spacing.md,
  },
  photoStrip: {
    marginHorizontal: -spacing.xxl,
  },
  photoStripContent: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  stripPhoto: {
    width: STRIP_PHOTO_SIZE,
    height: STRIP_PHOTO_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  stripPhotoSelected: {
    borderColor: colors.accent,
  },
  stripPhotoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentSoft,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyStrip: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  createGroupButton: {
    marginTop: spacing.lg,
  },
  itemsList: {
    gap: spacing.md,
  },
  itemCard: {
    padding: 0,
    overflow: 'hidden',
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  itemBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  itemBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  itemThumbnails: {
    flexDirection: 'row',
    flex: 1,
  },
  itemThumbnail: {
    width: GROUP_THUMBNAIL_SIZE,
    height: GROUP_THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.accentSoft,
  },
  itemThumbnailOverlap: {
    marginLeft: -20,
  },
  moreIndicator: {
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  expandedPhotos: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.md,
  },
  expandedPhoto: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.accentSoft,
  },
  ungroupButton: {
    marginTop: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
