import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WantsStackParamList } from '../../navigation/types';
import { Text, Card, Badge, FAB } from '../../ui/components';
import { colors, spacing, radius, shadows } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import {
  getMyWants,
  deleteWant as deleteWantSupabase,
  Want as SupabaseWant,
} from '../../services/supabaseWantsService';
import {
  getWants as getLocalWants,
  deleteWant as deleteLocalWant,
  Want as LocalWant,
} from '../../services/wantsService';
import { useFocusEffect } from '@react-navigation/native';

// Unified Want type that works with both local and Supabase
type Want = {
  id: string;
  query: string;
  max_price?: number;
  urgency: 'low' | 'normal' | 'high' | 'casual' | 'interested' | 'urgent';
  delivery_pref: string;
  created_at: string;
};

type Props = NativeStackScreenProps<WantsStackParamList, 'MyWants'>;

// Demo data matching HTML spec exactly
const initialDemoWants: Want[] = [
  {
    id: 'demo-1',
    query: 'Studio Display',
    max_price: 1200,
    urgency: 'interested',
    delivery_pref: 'local_only',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    query: 'Mid-century sofa',
    max_price: 800,
    urgency: 'casual',
    delivery_pref: 'shipping_ok',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    query: 'Road bike',
    max_price: 600,
    urgency: 'urgent',
    delivery_pref: 'local_only',
    created_at: new Date().toISOString(),
  },
];

// Map Supabase urgency to display urgency
const mapUrgency = (urgency: string): Want['urgency'] => {
  const map: Record<string, Want['urgency']> = {
    low: 'casual',
    normal: 'interested',
    high: 'urgent',
  };
  return map[urgency] || (urgency as Want['urgency']);
};

export default function MyWantsScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const [wants, setWants] = useState<Want[]>(initialDemoWants);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);

  const loadWants = useCallback(async () => {
    if (user) {
      // Fetch from Supabase for authenticated users
      const { data, error } = await getMyWants();
      if (!error && data.length > 0) {
        // Convert Supabase wants to display format
        const supabaseWants: Want[] = data.map((w) => ({
          id: w.id,
          query: w.query,
          max_price: w.max_price,
          urgency: mapUrgency(w.urgency),
          delivery_pref: w.delivery_pref,
          created_at: w.created_at,
        }));
        setWants(supabaseWants);
      } else if (data.length === 0) {
        // Show demo data if no wants exist
        setWants(initialDemoWants);
      }
    } else {
      // Fetch from local storage for guest users
      const data = await getLocalWants();
      if (data.length > 0) {
        setWants(data.map((w) => ({
          ...w,
          urgency: w.urgency as Want['urgency'],
        })));
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadWants();
    }, [loadWants])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWants();
    setRefreshing(false);
  };

  const getUrgencyBadgeVariant = (urgency: Want['urgency']): 'neutral' | 'purple' | 'danger' => {
    switch (urgency) {
      case 'casual':
        return 'neutral';
      case 'interested':
        return 'purple';
      case 'urgent':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getUrgencyLabel = (urgency: Want['urgency']) => {
    return urgency.charAt(0).toUpperCase() + urgency.slice(1);
  };

  const getWantIcon = (want: Want) => {
    // Use specific icons based on query content for demo data
    if (want.query.toLowerCase().includes('display') || want.query.toLowerCase().includes('monitor')) {
      return '🖥️';
    }
    if (want.query.toLowerCase().includes('sofa') || want.query.toLowerCase().includes('couch')) {
      return '🛋️';
    }
    if (want.query.toLowerCase().includes('bike') || want.query.toLowerCase().includes('bicycle')) {
      return '🚴';
    }
    return '💫';
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    
    Alert.alert(
      'Delete Wants',
      `Are you sure you want to delete ${selectedIds.size} want${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete wants based on auth status
            for (const id of selectedIds) {
              if (!id.startsWith('demo-')) {
                if (user) {
                  // Delete from Supabase
                  await deleteWantSupabase(id);
                } else {
                  // Delete from local storage
                  await deleteLocalWant(id);
                }
              }
            }
            // Remove from local state
            setWants(prev => prev.filter(want => !selectedIds.has(want.id)));
            setSelectedIds(new Set());
            setIsEditMode(false);
          },
        },
      ]
    );
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
            My Wants
          </Text>
          <Text variant="body" size="md" color="secondary">
            Things you're looking for
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.list}>
          {wants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="body" size="lg" color="secondary" style={styles.emptyText}>
                No wants yet. Tap + to add what you're looking for!
              </Text>
            </View>
          ) : (
            wants.map((want) => {
              const isSelected = selectedIds.has(want.id);
              
              return (
                <Pressable
                  key={want.id}
                  onPress={() => {
                    if (isEditMode) {
                      toggleSelection(want.id);
                    } else {
                      navigation.navigate('EditWant', { wantId: want.id });
                    }
                  }}
                >
                  <Card style={[styles.card, isSelected && styles.cardSelected]}>
                    <View style={styles.itemCard}>
                      {/* Selection circle in edit mode */}
                      {isEditMode && (
                        <Pressable
                          style={[
                            styles.deleteCircle,
                            isSelected && styles.deleteCircleSelected,
                          ]}
                          onPress={() => toggleSelection(want.id)}
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
                        <Text style={styles.thumbIcon}>{getWantIcon(want)}</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                          {want.query}
                        </Text>
                        {want.max_price && (
                          <Text variant="body" size="base" color="secondary">
                            Up to ${want.max_price.toLocaleString()}
                          </Text>
                        )}
                      </View>
                      {!isEditMode && (
                        <Badge variant={getUrgencyBadgeVariant(want.urgency)}>
                          {getUrgencyLabel(want.urgency)}
                        </Badge>
                      )}
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB opens Add Want (NOT upload) */}
      {!isEditMode && <FAB onPress={() => navigation.navigate('AddWant')} />}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120, // Space for FAB and tab bar
  },
  list: {
    marginTop: 20,
  },
  card: {
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: colors.danger,
    borderWidth: 2,
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
  thumbIcon: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    marginBottom: 4,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 250,
  },
});
