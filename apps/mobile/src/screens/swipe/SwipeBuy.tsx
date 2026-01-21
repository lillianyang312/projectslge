import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SwipeStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { Item } from '../../types/models';
import { getSwipeToBuyFeed, recordSwipeAction, createMatch } from '../../services/matchingService';
import { evaluateOurTake } from '../../services/ourTakeService';
import { getSignedUrlCached } from '../../services/imageService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<SwipeStackParamList, 'SwipeBuy'>;

export default function SwipeBuyScreen({ navigation }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (items[currentIndex]) {
      loadImage(items[currentIndex]);
    }
  }, [currentIndex, items]);

  async function loadFeed() {
    if (!user) return;

    setLoading(true);
    const feed = await getSwipeToBuyFeed(user.id);
    setItems(feed);
    setLoading(false);
  }

  async function loadImage(item: Item) {
    const url = await getSignedUrlCached(item.image_path);
    setImageUrl(url);
  }

  const currentItem = items[currentIndex];

  async function handleSwipe(action: 'good_deal' | 'skip' | 'save') {
    if (!user || !currentItem) return;

    // Record swipe action
    await recordSwipeAction(user.id, currentItem.id, action, 'buy');

    // If good deal, create match
    if (action === 'good_deal') {
      await createMatch(user.id, currentItem.owner_id, currentItem.id);
    }

    // Move to next item
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // End of feed - reload
      loadFeed();
      setCurrentIndex(0);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
            No items to swipe
          </Text>
          <Text variant="body" size="base" color="secondary" style={styles.emptyText}>
            Check back later for more items in your area.
          </Text>
          <Button variant="primary" onPress={loadFeed} style={styles.refreshBtn}>
            Refresh
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentItem) return null;

  // Calculate deal evaluation using shared OUR TAKE rules
  const askingPrice = currentItem.user_min_price || currentItem.market_value_min || 0;
  const evaluation = evaluateOurTake(currentItem, askingPrice, 'buy');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headingMedium" size="heading3">
            Swipe to Buy
          </Text>
          <Text variant="body" size="sm" color="secondary">
            {currentIndex + 1} of {items.length}
          </Text>
        </View>

        {/* Image Card */}
        <Card style={styles.imageCard}>
          {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} />}
        </Card>

        {/* Item Info */}
        <Card style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text variant="headingMedium" size="heading4">
              {currentItem.label || currentItem.category}
            </Text>
            {currentItem.condition && (
              <Badge variant="soft" text={currentItem.condition} />
            )}
          </View>

          {currentItem.description && (
            <Text variant="body" size="base" color="secondary" style={styles.description}>
              {currentItem.description}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text variant="headingMedium" size="heading3">
              ${askingPrice}
            </Text>
            {currentItem.market_value_min && currentItem.market_value_max && (
              <Text variant="body" size="sm" color="muted">
                Market: ${currentItem.market_value_min}-${currentItem.market_value_max}
              </Text>
            )}
          </View>
        </Card>

        {/* Agent Evaluation */}
        <Card
          style={[
            styles.agentCard,
            evaluation.is_good_deal ? styles.agentCardGood : styles.agentCardNeutral,
          ]}
        >
          <View style={styles.agentHeader}>
            <Text variant="bodyMedium" size="sm" color="muted">
              OUR TAKE
            </Text>
            <Badge
              variant={evaluation.is_good_deal ? 'success' : 'soft'}
              text={evaluation.market_comparison}
            />
          </View>

          <Text variant="bodyMedium" size="lg" style={styles.agentTake}>
            {evaluation.agent_take}
          </Text>

          {evaluation.reasoning.map((reason, idx) => (
            <Text key={idx} variant="body" size="sm" color="secondary" style={styles.reason}>
              • {reason}
            </Text>
          ))}
        </Card>

        {/* Swipe Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.skipBtn]}
            onPress={() => handleSwipe('skip')}
          >
            <Text variant="bodyMedium" size="xl">
              ✕
            </Text>
            <Text variant="bodyMedium" size="sm">
              Skip
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.saveBtn]}
            onPress={() => handleSwipe('save')}
          >
            <Text variant="bodyMedium" size="xl">
              ★
            </Text>
            <Text variant="bodyMedium" size="sm">
              Save
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.goodDealBtn]}
            onPress={() => handleSwipe('good_deal')}
          >
            <Text variant="bodyMedium" size="xl" color="white">
              ✓
            </Text>
            <Text variant="bodyMedium" size="sm" color="white">
              Good Deal
            </Text>
          </Pressable>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
  },
  infoCard: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  agentCard: {
    borderLeftWidth: 4,
    marginBottom: spacing.xl,
  },
  agentCardGood: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success,
  },
  agentCardNeutral: {
    backgroundColor: colors.accentSoft,
    borderLeftColor: colors.accent,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  agentTake: {
    marginBottom: spacing.md,
  },
  reason: {
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
  },
  skipBtn: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  saveBtn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  goodDealBtn: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  refreshBtn: {
    minWidth: 200,
  },
});
