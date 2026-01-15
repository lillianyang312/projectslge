import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../../navigation/types';
import { Text } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { Item } from '../../types/models';
import { getSwipeToBuyFeed } from '../../services/matchingService';
import { getSignedUrl } from '../../services/imageService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<SwipeStackParamList, 'SwipeMain'>;

// Demo items matching HTML spec lines 814-850
const demoItems = [
  { id: '1', emoji: '🛋️', price: 650 },
  { id: '2', emoji: '🖥️', price: 1100 },
  { id: '3', emoji: '🚴', price: 450 },
  { id: '4', emoji: '📷', price: 320 },
  { id: '5', emoji: '🎧', price: 180 },
  { id: '6', emoji: '⌚', price: 275 },
  { id: '7', emoji: '🎸', price: 520 },
  { id: '8', emoji: '🪴', price: 45 },
  { id: '9', emoji: '💡', price: 90 },
];

export default function BrowseGridScreen({ navigation }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState(demoItems);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    if (!user) return;

    setLoading(true);
    const feed = await getSwipeToBuyFeed(user.id);
    setItems(feed);
    setLoading(false);
  }

  const handleItemPress = (itemId: string) => {
    // Navigate to item detail
    navigation.navigate('BrowseItemDetail', { itemId });
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Browse
        </Text>
      </View>

      {/* Search Bar - matching HTML spec lines 810-812 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={displayItems}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              style={styles.galleryItem}
              onPress={() => handleItemPress(item.id)}
            >
              <View style={styles.galleryThumb}>
                <Text style={styles.galleryEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.galleryPrice}>
                <Text variant="bodyMedium" size="sm">
                  ${item.price}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
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
    paddingBottom: spacing.md,
  },
  searchContainer: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  searchInput: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    backgroundColor: colors.card,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  grid: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 100, // Space for tab bar
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  galleryItem: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryEmoji: {
    fontSize: 32,
  },
  galleryPrice: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
});
