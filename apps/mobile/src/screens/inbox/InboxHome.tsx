import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { InboxStackParamList, DealsStackParamList } from '../../navigation/types';
import { Text, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { getMyDeals, getMessages } from '../../services/dealsService';
import { getSignedUrlCached } from '../../services/imageService';
import { Deal, Message } from '../../types/models';
import { dealEvents } from '../../lib/dealEvents';

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxHome'>;

type FilterType = 'all' | 'unread' | 'selling' | 'buying';

interface InboxConversation {
  id: string;
  dealId: string;
  emoji: string;
  itemName: string;
  preview: string;
  time: string;
  timeMs: number;
  isUnread: boolean;
  hasNewBid?: boolean; // For owners with new bids (orange notification, not action needed)
  isAgent: boolean;
  type: 'selling' | 'buying';
  status: string;
  imageUrl?: string;
  badge?: {
    label: string;
    variant: 'danger' | 'blue' | 'success' | 'warning' | 'purple';
  };
}

// Category to emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  'Electronics': '📱',
  'Furniture': '🪑',
  'Clothing': '👕',
  'Books': '📚',
  'Sports': '⚽',
  'Sports & Outdoors': '🚴',
  'Music': '🎸',
  'Art': '🎨',
  'Kitchen': '🍳',
  'Home': '🏠',
  'Home Decor': '🏠',
  'Office': '💼',
  'Games': '🎮',
  'Health & Beauty': '💄',
  'Other': '📦',
};

function getEmojiForCategory(category: string): string {
  return CATEGORY_EMOJI[category] || '📦';
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export default function InboxHomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load all conversations from deals
  const loadConversations = useCallback(async (showRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getMyDeals(user.id);
      const deals = response.deals;

      // Build conversations from deals with their last messages
      const convos: InboxConversation[] = await Promise.all(
        deals.map(async (deal) => {
          const messages = await getMessages(deal.id);
          const lastMessage = messages[messages.length - 1];
          const isSelling = deal.seller_id === user.id;

          // Get image URL
          let imageUrl: string | undefined;
          const firstPhotoPath = deal.item?.photos?.[0];
          if (firstPhotoPath) {
            // Use cached signed URLs to avoid redundant requests and keep URLs fresh
            imageUrl = (await getSignedUrlCached(firstPhotoPath)) || undefined;
          }

          // Check if user has read the latest messages
          const userLastRead = isSelling ? deal.seller_last_read_at : deal.buyer_last_read_at;
          const lastMessageTime = lastMessage?.created_at;
          const hasUnreadMessages = lastMessageTime && (!userLastRead || new Date(lastMessageTime) > new Date(userLastRead));

          // Determine badge
          // "Action needed" only when:
          // 1. Pending sale (agreed/logistics) - both parties need to coordinate
          // 2. Pending status - owner needs to respond
          // 3. Buying and there's an offer from owner to respond to
          // For owners receiving bids during negotiation, show "New bid" instead
          // Badges disappear once the chat has been read
          let badge: InboxConversation['badge'];
          if (deal.status === 'agreed' || deal.status === 'logistics') {
            // Pending sale - action needed for scheduling/completion
            badge = { label: 'Action needed', variant: 'danger' };
          } else if (deal.status === 'pending') {
            if (isSelling) {
              // Owner: pending deal waiting for owner response - action needed
              badge = { label: 'Pending', variant: 'warning' };
            } else {
              // Buyer: waiting for owner to respond
              badge = { label: 'Pending', variant: 'purple' };
            }
          } else if (deal.status === 'negotiating') {
            if (isSelling) {
              // Owner: if there's an offer from buyer and not yet read, show "New bid"
              if (deal.current_offer && deal.last_offer_by === deal.buyer_id && hasUnreadMessages) {
                badge = { label: 'New bid', variant: 'warning' };
              } else {
                badge = { label: 'Selling', variant: 'success' };
              }
            } else {
              // Buyer: if owner made a counter-offer and not yet read, that's action needed
              if (deal.current_offer && deal.last_offer_by === deal.seller_id && hasUnreadMessages) {
                badge = { label: 'Action needed', variant: 'danger' };
              } else if (deal.current_offer && deal.last_offer_by === user.id) {
                // Buyer made an offer, waiting for owner
                badge = { label: 'Bid sent', variant: 'blue' };
              } else {
                badge = { label: 'Buying', variant: 'blue' };
              }
            }
          } else if (deal.status === 'completed') {
            badge = { label: 'Complete', variant: 'success' };
          } else {
            badge = isSelling
              ? { label: 'Selling', variant: 'success' }
              : { label: 'Buying', variant: 'blue' };
          }

          const updatedAt = lastMessage?.created_at || deal.updated_at;

          // Determine if conversation needs attention (for "Needs Response" section)
          // Only action-needed items go here, not just any new bid
          // Pending deals need action from owner
          const needsAction = badge?.variant === 'danger' || (deal.status === 'pending' && isSelling);

          return {
            id: deal.id,
            dealId: deal.id,
            emoji: getEmojiForCategory(deal.item?.category || 'Other'),
            itemName: deal.item?.title || 'Untitled Item',
            preview: lastMessage?.content || 'No messages yet',
            time: formatTimeAgo(updatedAt),
            timeMs: new Date(updatedAt).getTime(),
            isUnread: needsAction, // Only truly action-needed items are "unread"
            hasNewBid: badge?.label === 'New bid', // Track new bids separately
            isAgent: lastMessage?.is_agent || false,
            type: isSelling ? 'selling' : 'buying',
            status: deal.status,
            imageUrl,
            badge,
          };
        })
      );

      // Sort by most recent
      convos.sort((a, b) => b.timeMs - a.timeMs);
      setConversations(convos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  // Subscribe to deal update events for real-time updates
  useEffect(() => {
    const handleDealUpdate = () => {
      // Refresh conversations when a deal is created/updated
      loadConversations();
    };

    const unsubscribe = dealEvents.subscribe(handleDealUpdate);

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [loadConversations]);

  const handleRefresh = () => loadConversations(true);

  // Filter conversations
  const filterConversations = (convos: InboxConversation[]) => {
    if (activeFilter === 'all') return convos;
    if (activeFilter === 'unread') return convos.filter(c => c.isUnread);
    if (activeFilter === 'selling') return convos.filter(c => c.type === 'selling');
    if (activeFilter === 'buying') return convos.filter(c => c.type === 'buying');
    return convos;
  };

  // Split into sections
  const filteredConvos = filterConversations(conversations);
  // Action needed: pending sales (agreed/logistics) or counter-offers to buyers
  const needsResponse = filteredConvos.filter(c => c.isUnread);
  // New bids: owners with new offers (shows in separate section with orange indicator)
  const newBids = filteredConvos.filter(c => !c.isUnread && c.hasNewBid);
  // Recent: everything else from last 24h
  const recent = filteredConvos.filter(c => !c.isUnread && !c.hasNewBid && c.timeMs > Date.now() - 24 * 60 * 60 * 1000);
  // Earlier: older items
  const earlier = filteredConvos.filter(c => !c.isUnread && !c.hasNewBid && c.timeMs <= Date.now() - 24 * 60 * 60 * 1000);

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'selling', label: 'Selling' },
    { value: 'buying', label: 'Buying' },
  ];

  const handleConversationPress = (dealId: string) => {
    // Navigate directly to DealChat
    navigation.navigate('DealChat', { dealId });
  };

  const renderConversation = (convo: InboxConversation) => {
    const cardStyle = StyleSheet.flatten([
      styles.messageCard,
      convo.isUnread ? styles.messageCardUnread : undefined,
    ]);

    return (
      <Pressable key={convo.id} onPress={() => handleConversationPress(convo.dealId)}>
        <Card style={cardStyle}>
          <View style={styles.inboxCard}>
            <View style={styles.itemThumb}>
              {convo.imageUrl ? (
                <Image source={{ uri: convo.imageUrl }} style={styles.thumbImage} resizeMode="cover" />
              ) : (
                <Text style={styles.itemEmoji}>{convo.emoji}</Text>
              )}
            </View>
            <View style={styles.inboxInfo}>
              {/* Item name as main title with badge */}
              <View style={styles.inboxName}>
                <Text variant="bodyMedium" size="md" style={styles.inboxNameText} numberOfLines={1}>
                  {convo.itemName}
                </Text>
                {convo.badge && (
                  <Badge variant={convo.badge.variant} style={styles.inlineBadge}>
                    {convo.badge.label}
                  </Badge>
                )}
              </View>
              {/* Status */}
              <Text
                variant="body"
                size="xs"
                color="muted"
                numberOfLines={1}
                style={styles.statusText}
              >
                {convo.type === 'selling' ? 'Selling' : 'Buying'} · {convo.status}
              </Text>
              {/* Message preview */}
              <Text
                variant="body"
                size="xs"
                color={convo.isAgent ? 'purple' : 'secondary'}
                numberOfLines={1}
                style={styles.inboxPreview}
              >
                {convo.isAgent ? '🤖 ' : ''}{convo.preview}
              </Text>
            </View>
            <View style={styles.inboxMeta}>
              <Text variant="body" size="xs" color="muted" style={styles.inboxTime}>
                {convo.time}
              </Text>
              {convo.isUnread && <View style={styles.unreadDot} />}
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Inbox
        </Text>
        <Text variant="body" size="md" color="secondary">
          All conversations
        </Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filtersContainer}>
        {filters.map((filter) => {
          const getFilterStyle = () => {
            if (activeFilter !== filter.value) return null;
            if (filter.value === 'selling') return styles.filterBtnSelling;
            if (filter.value === 'buying') return styles.filterBtnBuying;
            return styles.filterBtnActive;
          };

          const getTextStyle = () => {
            if (activeFilter !== filter.value) return null;
            if (filter.value === 'selling') return styles.filterBtnTextSelling;
            if (filter.value === 'buying') return styles.filterBtnTextBuying;
            return styles.filterBtnTextActive;
          };

          return (
            <Pressable
              key={filter.value}
              style={[
                styles.filterBtn,
                activeFilter === filter.value ? getFilterStyle() : undefined,
              ]}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Text
                variant="bodyMedium"
                size="sm"
                color={activeFilter === filter.value ? undefined : 'secondary'}
                style={activeFilter === filter.value ? getTextStyle() : undefined}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {filteredConvos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text variant="bodyMedium" size="md" style={styles.emptyTitle}>
                No conversations yet
              </Text>
              <Text variant="body" size="sm" color="secondary" style={styles.emptyText}>
                When you express interest in items or receive offers, your conversations will appear here.
              </Text>
            </View>
          ) : (
            <>
              {/* Needs Response Section - pending sales and counter-offers */}
              {needsResponse.length > 0 && (
                <>
                  <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
                    ⏰ ACTION NEEDED
                  </Text>
                  {needsResponse.map(renderConversation)}
                </>
              )}

              {/* New Bids Section - for owners with new incoming bids */}
              {newBids.length > 0 && (
                <>
                  <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
                    💰 NEW BIDS
                  </Text>
                  {newBids.map(renderConversation)}
                </>
              )}

              {/* Recent Section */}
              {recent.length > 0 && (
                <>
                  <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
                    💬 RECENT
                  </Text>
                  {recent.map(renderConversation)}
                </>
              )}

              {/* Earlier Section */}
              {earlier.length > 0 && (
                <>
                  <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
                    📅 EARLIER
                  </Text>
                  {earlier.map(renderConversation)}
                </>
              )}

              {/* All caught up */}
              <View style={styles.emptyState}>
                <Text variant="body" size="sm" color="muted">
                  You're all caught up!
                </Text>
              </View>
            </>
          )}
        </ScrollView>
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
    paddingBottom: spacing.sm,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterBtnSelling: {
    backgroundColor: colors.sellingSoft,
    borderColor: colors.selling,
  },
  filterBtnBuying: {
    backgroundColor: colors.buyingSoft,
    borderColor: colors.buying,
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },
  filterBtnTextSelling: {
    color: colors.selling,
  },
  filterBtnTextBuying: {
    color: colors.buying,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  messageCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  messageCardUnread: {
    backgroundColor: colors.unread,
  },
  inboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemThumb: {
    width: 48,
    height: 48,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemEmoji: {
    fontSize: 20,
  },
  inboxInfo: {
    flex: 1,
    minWidth: 0,
  },
  inboxName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 1,
  },
  inboxNameText: {
    flex: 1,
  },
  inlineBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  statusText: {
    marginBottom: 2,
  },
  inboxPreview: {
    lineHeight: 16,
  },
  inboxMeta: {
    alignItems: 'flex-end',
  },
  inboxTime: {
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
