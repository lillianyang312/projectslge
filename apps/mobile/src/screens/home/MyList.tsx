import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, FlatList, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../navigation/types';
import { Text, Card, Badge } from '../../ui/components';
import { colors, spacing, radius, shadows, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<HomeStackParamList, 'MyList'>;

export default function MyListScreen({ navigation }: Props) {
  const items = useItemsStore((state) => state.items);
  const seedDemoItems = useItemsStore((state) => state.seedDemoItems);

  useEffect(() => {
    seedDemoItems();
  }, [seedDemoItems]);

  const navigateToUpload = () => {
    // Navigate to Upload tab
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Upload' as never);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          My List
        </Text>
        <Text variant="body" size="md" color="secondary">
          Items you own
        </Text>
      </View>

      {items.length === 0 ? (
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
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              pressable
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            >
              <View style={styles.itemCard}>
                <View style={styles.itemThumb}>
                  <Text style={styles.itemIcon}>
                    {item.imageUri ? '📷' : '📦'}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                    {item.title}
                  </Text>
                  <Text variant="body" size="base" color="secondary">
                    {item.category}
                  </Text>
                </View>
                <Badge variant="warning">If good offer</Badge>
              </View>
            </Card>
          )}
        />
      )}

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={navigateToUpload}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: 100,
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
    lineHeight: typography.lineHeights.relaxed * typography.sizes.lg,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  itemInfo: {
    flex: 1,
  },
  itemName: {
    marginBottom: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 96, // Just above the tab bar (84px height + 12px margin)
    right: spacing.xxl,
    width: 56,
    height: 56,
    backgroundColor: colors.accent,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabPressed: {
    opacity: 0.8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },
});
