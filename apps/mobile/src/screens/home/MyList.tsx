import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ListStackParamList } from '../../navigation/types';
import { Text, Card, Badge, FAB } from '../../ui/components';
import { colors, spacing, radius, typography, shadows } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { getMyActiveItems, getMyGoneItems, deleteItem, markItemAsSold, markItemAsRemoved, restoreItem, Item, ItemStatus } from '../../services/itemsService';
import { getSignedUrlCached } from '../../services/imageService';
import { getTopBidsForItems } from '../../services/dealsService';

type Props = NativeStackScreenProps<ListStackParamList, 'MyList'>;

// No demo items - start with empty list
const initialDemoItems: { id: string; emoji: string; title: string; category: string; interestedCount: number; topBid: number | undefined }[] = [];

type ListTab = 'live' | 'gone';

export default function MyListScreen({ navigation }: Props) {
  const listings = useItemsStore((state) => state.listings);
  const seedDemoListings = useItemsStore((state) => state.seedDemoListings);
  const user = useAuthStore((state) => state.user);

  const [demoItems, setDemoItems] = useState(initialDemoItems);
  const [supabaseItems, setSupabaseItems] = useState<Item[]>([]);
  const [goneItems, setGoneItems] = useState<Item[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [topBidsMap, setTopBidsMap] = useState<Record<string, { topBid: number | undefined; interestedCount: number }>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListTab>('live');
  const [dbFetchFailed, setDbFetchFailed] = useState(false);

  // Fetch items from Supabase
  const fetchItems = useCallback(async () => {
    if (user) {
      console.log('[MyList] Fetching items from Supabase...');

      // Fetch both active and gone items
      const [activeResult, goneResult] = await Promise.all([
        getMyActiveItems(),
        getMyGoneItems(),
      ]);

      // Check if database fetch failed (only check active items - gone items failure is non-critical)
      const fetchFailed = activeResult.error !== null;
      setDbFetchFailed(fetchFailed);

      if (fetchFailed) {
        console.error('[MyList] Database fetch failed. Active error:', activeResult.error);
        // Only seed demo listings if database fetch failed
        seedDemoListings();
      }

      if (!activeResult.error && activeResult.data) {
        console.log('[MyList] Successfully fetched active items:', activeResult.data.length);
        setSupabaseItems(activeResult.data);

        // Fetch signed URLs for thumbnails (using cached URLs)
        const urlMap: Record<string, string> = { ...thumbnailUrls };
        for (const item of activeResult.data) {
          if (item.photos?.[0] && !urlMap[item.id]) {
            const url = await getSignedUrlCached(item.photos[0]);
            if (url) {
              urlMap[item.id] = url;
            }
          }
        }

        // Fetch top bids for all active items
        if (activeResult.data.length > 0) {
          const itemIds = activeResult.data.map(item => item.id);
          const bidsData = await getTopBidsForItems(itemIds);
          setTopBidsMap(bidsData);
          console.log('[MyList] Top bids fetched:', bidsData);
        }

        // Also fetch thumbnails for gone items
        if (!goneResult.error && goneResult.data) {
          for (const item of goneResult.data) {
            if (item.photos?.[0] && !urlMap[item.id]) {
              const url = await getSignedUrlCached(item.photos[0]);
              if (url) {
                urlMap[item.id] = url;
              }
            }
          }
        }

        setThumbnailUrls(urlMap);
      } else if (activeResult.error) {
        console.error('[MyList] Error fetching active items:', activeResult.error);
      }

      if (!goneResult.error && goneResult.data) {
        console.log('[MyList] Successfully fetched gone items:', goneResult.data.length);
        setGoneItems(goneResult.data);
      } else if (goneResult.error) {
        console.error('[MyList] Error fetching gone items:', goneResult.error);
      }
    } else {
      console.log('[MyList] No user, skipping fetch');
      setDbFetchFailed(false);
    }
  }, [user, seedDemoListings]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Refresh items when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  // Navigate to Upload within this stack (not to another tab)
  const navigateToUpload = () => {
    navigation.navigate('Upload');
  };

  // Handle slideshow upload - picks a PDF file
  const handleSlideshowUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pdfUri = result.assets[0].uri;
        const pdfName = result.assets[0].name;
        console.log('[MyList] PDF selected:', pdfName, pdfUri);
        // Navigate to Upload flow with the PDF
        navigation.navigate('Upload');
      }
    } catch (error) {
      console.error('[MyList] Error picking PDF:', error);
      Alert.alert('Error', 'Failed to pick PDF file.');
    }
  };

  const fabMenuItems = useMemo(() => [
    {
      label: 'Upload slideshow',
      icon: '📄',
      onPress: handleSlideshowUpload,
    },
  ], []);

  // Get user-added listings from local store (filter out demo seed data)
  const localListings = listings
    .filter((l) => l.isActive && l.original.intent === 'owned' && !l.id.startsWith('demo-') && !l.id.startsWith('listing-') && !l.id.startsWith('clarification-'))
    .map((l) => ({
      id: l.id,
      emoji: '📦',
      title: l.original.title,
      category: l.original.category,
      interestedCount: 0,
      topBid: undefined,
      imageUri: l.original.imageUris?.[0],
      isLocal: true,
    }));

  // Convert Supabase items to display format
  const supabaseDisplayItems = supabaseItems.map((item) => {
    const bidInfo = topBidsMap[item.id];
    return {
      id: item.id,
      emoji: '📦',
      title: item.title,
      category: item.category,
      interestedCount: bidInfo?.interestedCount || 0,
      topBid: bidInfo?.topBid,
      imageUri: thumbnailUrls[item.id] || null,
      isLocal: false,
      status: item.status || 'active',
    };
  });

  // Convert gone items to display format
  const goneDisplayItems = goneItems.map((item) => ({
    id: item.id,
    emoji: '📦',
    title: item.title,
    category: item.category,
    interestedCount: 0,
    topBid: undefined,
    imageUri: thumbnailUrls[item.id] || null,
    isLocal: false,
    status: item.status as ItemStatus,
  }));

  // Combine all items: Supabase items first, then local items
  // Only show demo items if database fetch failed (not just if empty)
  const hasRealItems = supabaseDisplayItems.length > 0 || localListings.length > 0;
  const combinedItems = dbFetchFailed
    ? [...supabaseDisplayItems, ...localListings, ...demoItems]
    : [...supabaseDisplayItems, ...localListings];

  // Sort: items with bids float to the top, then by bid amount descending
  const displayItems = [...combinedItems].sort((a, b) => {
    const aBid = a.topBid ?? 0;
    const bBid = b.topBid ?? 0;
    if (aBid > 0 && bBid === 0) return -1;
    if (aBid === 0 && bBid > 0) return 1;
    if (aBid > 0 && bBid > 0) return bBid - aBid;
    return 0;
  });

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete from Supabase
            for (const id of selectedIds) {
              const isSupabaseItem = supabaseItems.some(item => item.id === id);
              if (isSupabaseItem) {
                await deleteItem(id);
              }
            }

            // Delete demo items locally
            setDemoItems(prev => prev.filter(item => !selectedIds.has(item.id)));

            // Refresh Supabase items
            await fetchItems();

            setSelectedIds(new Set());
            setIsEditMode(false);
          },
        },
      ]
    );
  };

  const handleMarkAsSold = async (id: string) => {
    Alert.alert(
      'Mark as Sold',
      'This will move the item to your "Gone" section.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Sold',
          onPress: async () => {
            await markItemAsSold(id);
            await fetchItems();
          },
        },
      ]
    );
  };

  const handleMarkAsRemoved = async (id: string) => {
    Alert.alert(
      'Mark as Removed',
      'This will move the item to your "Gone" section.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Removed',
          onPress: async () => {
            await markItemAsRemoved(id);
            await fetchItems();
          },
        },
      ]
    );
  };

  const handleRestoreItem = async (id: string) => {
    await restoreItem(id);
    await fetchItems();
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedIds(new Set());
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="headingMedium" size="heading2">
            My List
          </Text>
          <Text variant="body" size="md" color="secondary">
            Your items and top bids
          </Text>
        </View>

        {/* Three dots menu button */}
        <Pressable
          style={styles.menuButton}
          onPress={() => setShowMenu(true)}
        >
          <Text style={styles.menuDots}>⋯</Text>
        </Pressable>
      </View>

      {/* Tab switcher - Live / Gone */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'live' && styles.tabBtnActive]}
          onPress={() => setActiveTab('live')}
        >
          <Text
            variant="bodyMedium"
            size="sm"
            color={activeTab === 'live' ? undefined : 'secondary'}
            style={activeTab === 'live' ? styles.tabBtnTextActive : undefined}
          >
            Live ({displayItems.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'gone' && styles.tabBtnGone]}
          onPress={() => setActiveTab('gone')}
        >
          <Text
            variant="bodyMedium"
            size="sm"
            color={activeTab === 'gone' ? undefined : 'secondary'}
            style={activeTab === 'gone' ? styles.tabBtnTextGone : undefined}
          >
            Gone ({goneDisplayItems.length})
          </Text>
        </Pressable>
      </View>

      {/* Edit mode header */}
      {isEditMode && (
        <View style={styles.editHeader}>
          <Pressable onPress={exitEditMode} style={styles.cancelBtn}>
            <Text variant="bodyMedium" size="md" color="secondary">Cancel</Text>
          </Pressable>
          <Text variant="bodyMedium" size="md">
            {selectedIds.size} selected
          </Text>
          <Pressable
            onPress={handleDeleteSelected}
            style={[styles.deleteBtn, selectedIds.size === 0 && styles.deleteBtnDisabled]}
            disabled={selectedIds.size === 0}
          >
            <Text
              variant="bodyMedium"
              size="md"
              color={selectedIds.size > 0 ? 'danger' : 'muted'}
            >
              Delete
            </Text>
          </Pressable>
        </View>
      )}

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setIsEditMode(true);
              }}
            >
              <Text variant="bodyMedium" size="lg">Edit</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Live Tab Content */}
      {activeTab === 'live' && (
        displayItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="heading" size="xxxl" style={styles.emptyIcon}>
              📦
            </Text>
            <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
              No items yet
            </Text>
            <Text
              variant="body"
              size="lg"
              color="secondary"
              style={styles.emptyMessage}
            >
              Tap the + button to upload your first item
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {displayItems.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (isEditMode) {
                      toggleSelection(item.id);
                    } else {
                      navigation.navigate('ItemDetail', { itemId: item.id });
                    }
                  }}
                  onLongPress={() => {
                    if (!isEditMode) {
                      Alert.alert(
                        item.title,
                        'What would you like to do?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Mark as Sold', onPress: () => handleMarkAsSold(item.id) },
                          { text: 'Mark as Removed', onPress: () => handleMarkAsRemoved(item.id) },
                        ]
                      );
                    }
                  }}
                >
                  <Card style={[styles.card, isSelected && styles.cardSelected]}>
                    <View style={styles.itemCard}>
                      {/* Delete X button in edit mode */}
                      {isEditMode && (
                        <Pressable
                          style={[
                            styles.deleteCircle,
                            isSelected && styles.deleteCircleSelected,
                          ]}
                          onPress={() => toggleSelection(item.id)}
                        >
                          <Text style={[
                            styles.deleteX,
                            isSelected && styles.deleteXSelected,
                          ]}>
                            {isSelected ? '✓' : ''}
                          </Text>
                        </Pressable>
                      )}
                      <View style={styles.itemThumb}>
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
                        ) : (
                          <Text style={styles.itemIcon}>{item.emoji}</Text>
                        )}
                      </View>
                      <View style={styles.itemInfo}>
                        <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                          {item.title}
                        </Text>
                        <Text variant="body" size="base" color="secondary">
                          {item.category} · {item.interestedCount} interested
                        </Text>
                      </View>
                      {!isEditMode && (
                        <View style={styles.itemBid}>
                          <Text variant="body" size="xs" color="muted" style={styles.itemBidLabel}>
                            Top bid
                          </Text>
                          <Text
                            variant="heading"
                            size="xxl"
                            color={item.topBid ? undefined : 'muted'}
                            style={styles.itemBidValue}
                          >
                            {item.topBid ? `$${item.topBid}` : '—'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Gone Tab Content */}
      {activeTab === 'gone' && (
        goneDisplayItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="heading" size="xxxl" style={styles.emptyIcon}>
              🏷️
            </Text>
            <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
              No gone items
            </Text>
            <Text
              variant="body"
              size="lg"
              color="secondary"
              style={styles.emptyMessage}
            >
              Sold or removed items will appear here
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {goneDisplayItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                onLongPress={() => {
                  Alert.alert(
                    item.title,
                    'Would you like to restore this item?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Restore to Live', onPress: () => handleRestoreItem(item.id) },
                    ]
                  );
                }}
              >
                <Card style={[styles.card, styles.goneCard]}>
                  <View style={styles.itemCard}>
                    <View style={[styles.itemThumb, styles.goneThumb]}>
                      {item.imageUri ? (
                        <Image source={{ uri: item.imageUri }} style={[styles.itemImage, styles.goneImage]} />
                      ) : (
                        <Text style={styles.itemIcon}>{item.emoji}</Text>
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text variant="bodyMedium" size="lg" style={styles.itemName} color="secondary">
                        {item.title}
                      </Text>
                      <Text variant="body" size="base" color="muted">
                        {item.category} · {item.status === 'sold' ? 'Sold' : 'Removed'}
                      </Text>
                    </View>
                    <Badge variant={item.status === 'sold' ? 'success' : 'default'}>
                      {item.status === 'sold' ? 'Sold' : 'Gone'}
                    </Badge>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )
      )}

      {/* Floating Action Button - with scroll-up menu for slideshow upload */}
      {!isEditMode && <FAB onPress={navigateToUpload} menuItems={fabMenuItems} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  menuDots: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabBtnGone: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  tabBtnTextGone: {
    color: '#FFFFFF',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: spacing.xxl,
  },
  menuContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    ...shadows.lg,
    minWidth: 120,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  list: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: 120, // Space for FAB and tab bar
  },
  card: {
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
  emptyMessage: {
    textAlign: 'center',
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.lg || 15),
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deleteCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCircleSelected: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  deleteX: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  deleteXSelected: {
    color: '#FFFFFF',
  },
  itemThumb: {
    width: 56,
    height: 56,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIcon: {
    fontSize: 24,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    marginBottom: 4,
  },
  itemBid: {
    alignItems: 'flex-end',
  },
  itemBidLabel: {
    marginBottom: 2,
  },
  itemBidValue: {
    // Font size handled by variant="heading" size="xxl"
  },
  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  goneCard: {
    opacity: 0.7,
  },
  goneThumb: {
    backgroundColor: colors.border,
  },
  goneImage: {
    opacity: 0.7,
  },
});
