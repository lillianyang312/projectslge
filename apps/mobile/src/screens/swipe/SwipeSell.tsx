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
import { getSwipeToSellFeed, recordSwipeAction, createMatch } from '../../services/matchingService';
import { getSignedUrl } from '../../services/imageService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<SwipeStackParamList, 'SwipeSell'>;

interface SellFeedItem {
  want: Item;
  myItem: Item;
}

export default function SwipeSellScreen({ navigation }: Props) {
  const [feedItems, setFeedItems] = useState<SellFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myItemImageUrl, setMyItemImageUrl] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (feedItems[currentIndex]) {
      loadImage(feedItems[currentIndex].myItem);
    }
  }, [currentIndex, feedItems]);

  async function loadFeed() {
    if (!user) return;

    setLoading(true);
    const feed = await getSwipeToSellFeed(user.id);
    setFeedItems(feed);
    setLoading(false);
  }

  async function loadImage(item: Item) {
    const url = await getSignedUrl(item.image_path);
    setMyItemImageUrl(url);
  }

  const current = feedItems[currentIndex];

  async function handleSwipe(action: 'accept' | 'decline') {
    if (!user || !current) return;

    // Record swipe action
    await recordSwipeAction(user.id, current.want.id, action, 'sell');

    // If accepted, create match
    if (action === 'accept') {
      await createMatch(
        current.want.owner_id, // buyer
        user.id, // seller (current user)
        current.myItem.id,
        current.want.id
      );
    }

    // Move to next
    if (currentIndex < feedItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
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

  if (feedItems.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
            No incoming interest yet
          </Text>
          <Text variant="body" size="base" color="secondary" style={styles.emptyText}>
            We'll notify you when buyers are looking for items like yours.
          </Text>
          <Button variant="primary" onPress={loadFeed} style={styles.refreshBtn}>
            Refresh
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!current) return null;

  const { want, myItem } = current;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headingMedium" size="heading3">
            Swipe to Sell
          </Text>
          <Text variant="body" size="sm" color="secondary">
            {currentIndex + 1} of {feedItems.length}
          </Text>
        </View>

        {/* Buyer Interest Card */}
        <Card style={styles.interestCard}>
          <Text variant="bodyMedium" size="sm" color="muted" style={styles.label}>
            BUYER IS LOOKING FOR
          </Text>
          <Text variant="headingMedium" size="heading4" style={styles.wantLabel}>
            {want.label || want.category}
          </Text>
          {want.description && (
            <Text variant="body" size="base" color="secondary" style={styles.wantDesc}>
              {want.description}
            </Text>
          )}

          {want.user_max_price && (
            <View style={styles.budgetRow}>
              <Text variant="body" size="sm" color="muted">
                Budget:
              </Text>
              <Text variant="bodyMedium" size="base">
                Up to ${want.user_max_price}
              </Text>
            </View>
          )}

          {want.urgency && (
            <Badge
              variant={want.urgency === 'urgent' ? 'danger' : 'soft'}
              text={want.urgency}
            />
          )}
        </Card>

        {/* My Item Card */}
        <Card style={styles.myItemCard}>
          <Text variant="bodyMedium" size="sm" color="muted" style={styles.label}>
            YOUR ITEM
          </Text>

          {myItemImageUrl && (
            <Image source={{ uri: myItemImageUrl }} style={styles.itemImage} />
          )}

          <View style={styles.itemHeader}>
            <Text variant="headingMedium" size="heading4">
              {myItem.label || myItem.category}
            </Text>
            {myItem.condition && (
              <Badge variant="soft" text={myItem.condition} />
            )}
          </View>

          {myItem.description && (
            <Text variant="body" size="sm" color="secondary">
              {myItem.description}
            </Text>
          )}

          {myItem.user_min_price && (
            <View style={styles.priceRow}>
              <Text variant="body" size="sm" color="muted">
                Your asking price:
              </Text>
              <Text variant="headingMedium" size="heading4">
                ${myItem.user_min_price}
              </Text>
            </View>
          )}
        </Card>

        {/* Agent Analysis */}
        <Card style={styles.agentCard}>
          <Text variant="bodyMedium" size="sm" color="muted" style={styles.agentLabel}>
            OUR TAKE
          </Text>

          {want.user_max_price && myItem.user_min_price ? (
            want.user_max_price >= myItem.user_min_price ? (
              <>
                <Text variant="bodyMedium" size="lg" style={styles.agentTake}>
                  Strong match! Their budget covers your asking price.
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  • Budget: ${want.user_max_price} meets your ${myItem.user_min_price} ask
                </Text>
                {want.urgency === 'urgent' && (
                  <Text variant="body" size="sm" color="secondary">
                    • Buyer is urgent - likely to move quickly
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text variant="bodyMedium" size="lg" style={styles.agentTake}>
                  Potential match, but price gap exists.
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  • Their budget: ${want.user_max_price} vs your ask: ${myItem.user_min_price}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  • Consider if you're willing to negotiate
                </Text>
              </>
            )
          ) : (
            <Text variant="bodyMedium" size="base">
              They're interested in {want.category || 'this category'}. Worth exploring!
            </Text>
          )}
        </Card>

        {/* Swipe Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={() => handleSwipe('decline')}
          >
            <Text variant="bodyMedium" size="xxxl">
              ✕
            </Text>
            <Text variant="bodyMedium" size="base">
              Pass
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => handleSwipe('accept')}
          >
            <Text variant="bodyMedium" size="xxxl" color="white">
              ✓
            </Text>
            <Text variant="bodyMedium" size="base" color="white">
              Accept
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
  label: {
    marginBottom: spacing.xs,
  },
  interestCard: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    marginBottom: spacing.lg,
  },
  wantLabel: {
    marginBottom: spacing.sm,
  },
  wantDesc: {
    marginBottom: spacing.md,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'baseline',
  },
  myItemCard: {
    marginBottom: spacing.md,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
  },
  agentCard: {
    backgroundColor: colors.successSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    marginBottom: spacing.xl,
  },
  agentLabel: {
    marginBottom: spacing.sm,
  },
  agentTake: {
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.sm,
  },
  declineBtn: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  acceptBtn: {
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
