import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxStackParamList } from '../../navigation/types';
import { Text, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxHome'>;

type FilterType = 'all' | 'unread' | 'selling' | 'buying';

interface InboxMessage {
  id: string;
  emoji: string;
  itemName: string;
  preview: string;
  time: string;
  isUnread: boolean;
  isAgent: boolean;
  type: 'selling' | 'buying';
  badge?: {
    label: string;
    variant: 'warning' | 'purple' | 'blue' | 'success';
  };
  avatarType: 'agent' | 'buyer' | 'seller';
}

// Demo data matching HTML spec - lines 1105-1226
const needsResponseMessages: InboxMessage[] = [
  {
    id: '1',
    emoji: '🪑',
    itemName: 'Herman Miller Aeron',
    preview: 'Agent: Does Saturday at 3pm work for pickup?',
    time: '2m',
    isUnread: true,
    isAgent: true,
    type: 'selling',
    badge: { label: 'Action needed', variant: 'warning' },
    avatarType: 'agent',
  },
  {
    id: 'buyer-question-1',
    emoji: '🪑',
    itemName: 'Herman Miller Aeron',
    preview: 'Buyer question: "Would you consider $480 if I handle shipping?"',
    time: '5m',
    isUnread: true,
    isAgent: false,
    type: 'selling',
    badge: { label: 'Question', variant: 'warning' },
    avatarType: 'buyer',
  },
  {
    id: 'buyer-question-2',
    emoji: '🪑',
    itemName: 'Herman Miller Aeron',
    preview: 'Buyer question: "What\'s the exact condition of the armrests?"',
    time: '10m',
    isUnread: true,
    isAgent: false,
    type: 'selling',
    badge: { label: 'Question', variant: 'warning' },
    avatarType: 'buyer',
  },
  {
    id: '2',
    emoji: '🛋️',
    itemName: 'Mid-century Sofa',
    preview: 'Seller: Available for pickup this weekend',
    time: '15m',
    isUnread: true,
    isAgent: false,
    type: 'buying',
    badge: { label: 'Buying', variant: 'purple' },
    avatarType: 'buyer',
  },
];

const recentMessages: InboxMessage[] = [
  {
    id: '3',
    emoji: '🖥️',
    itemName: 'Studio Display',
    preview: 'Agent: What\'s your shipping address?',
    time: '1h',
    isUnread: false,
    isAgent: true,
    type: 'buying',
    badge: { label: 'Buying', variant: 'blue' },
    avatarType: 'agent',
  },
  {
    id: '4',
    emoji: '📱',
    itemName: 'iPhone 14 Pro',
    preview: 'Buyer: Can you meet at 5pm instead?',
    time: '3h',
    isUnread: false,
    isAgent: false,
    type: 'selling',
    badge: { label: 'Selling', variant: 'success' },
    avatarType: 'seller',
  },
  {
    id: '5',
    emoji: '🎸',
    itemName: 'Fender Stratocaster',
    preview: 'Agent: Deal completed! Payment confirmed.',
    time: '1d',
    isUnread: false,
    isAgent: true,
    type: 'selling',
    badge: { label: 'Selling', variant: 'success' },
    avatarType: 'agent',
  },
];

const earlierMessages: InboxMessage[] = [
  {
    id: '6',
    emoji: '🚴',
    itemName: 'Road Bike',
    preview: 'You: Thanks! Looking forward to it',
    time: '2d',
    isUnread: false,
    isAgent: false,
    type: 'buying',
    badge: { label: 'Buying', variant: 'purple' },
    avatarType: 'buyer',
  },
  {
    id: '7',
    emoji: '🖥️',
    itemName: 'Dell Monitor 27"',
    preview: 'Agent: No new interest yet. Try lowering price?',
    time: '3d',
    isUnread: false,
    isAgent: true,
    type: 'selling',
    badge: { label: 'Selling', variant: 'success' },
    avatarType: 'agent',
  },
];

export default function InboxHomeScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const allMessages = [...needsResponseMessages, ...recentMessages, ...earlierMessages];

  const filterMessages = (messages: InboxMessage[]) => {
    if (activeFilter === 'all') return messages;
    if (activeFilter === 'unread') return messages.filter(m => m.isUnread);
    if (activeFilter === 'selling') return messages.filter(m => m.type === 'selling');
    if (activeFilter === 'buying') return messages.filter(m => m.type === 'buying');
    return messages;
  };

  const filteredNeedsResponse = filterMessages(needsResponseMessages);
  const filteredRecent = filterMessages(recentMessages);
  const filteredEarlier = filterMessages(earlierMessages);

  const hasNeedsResponse = filteredNeedsResponse.length > 0;
  const hasRecent = filteredRecent.length > 0;
  const hasEarlier = filteredEarlier.length > 0;

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'selling', label: 'Selling' },
    { value: 'buying', label: 'Buying' },
  ];

  const handleMessagePress = (messageId: string) => {
    navigation.navigate('ChatThread', { conversationId: messageId });
  };

  const getAvatarStyle = (type: 'agent' | 'buyer' | 'seller') => {
    if (type === 'agent') return styles.avatarAgent;
    if (type === 'buyer') return styles.avatarBuyer;
    return styles.avatarSeller;
  };

  const getAvatarIcon = (type: 'agent' | 'buyer' | 'seller') => {
    if (type === 'agent') return '🤖';
    return '👤';
  };

  const renderMessage = (message: InboxMessage) => (
    <Pressable key={message.id} onPress={() => handleMessagePress(message.id)}>
      <Card style={[styles.messageCard, message.isUnread && styles.messageCardUnread]}>
        <View style={styles.inboxCard}>
          <View style={[styles.avatar, getAvatarStyle(message.avatarType)]}>
            <Text style={styles.avatarIcon}>{getAvatarIcon(message.avatarType)}</Text>
          </View>
          <View style={styles.inboxInfo}>
            <View style={styles.inboxName}>
              <Text variant="bodyMedium" size="md" style={styles.inboxNameText}>
                {message.itemName}
              </Text>
              {message.badge && (
                <Badge variant={message.badge.variant} style={styles.inlineBadge}>
                  {message.badge.label}
                </Badge>
              )}
            </View>
            <Text
              variant="body"
              size="xs"
              color={message.isAgent ? 'purple' : 'secondary'}
              numberOfLines={1}
              style={styles.inboxPreview}
            >
              {message.preview}
            </Text>
          </View>
          <View style={styles.inboxMeta}>
            <Text variant="body" size="xs" color="muted" style={styles.inboxTime}>
              {message.time}
            </Text>
            {message.isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Inbox
        </Text>
        <Text variant="body" size="md" color="secondary">
          Messages and updates
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

          return (
            <Pressable
              key={filter.value}
              style={[
                styles.filterBtn,
                activeFilter === filter.value && getFilterStyle(),
              ]}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Text
                variant="bodyMedium"
                size="sm"
                color={activeFilter === filter.value ? undefined : 'secondary'}
                style={activeFilter === filter.value && styles.filterBtnTextActive}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Needs Response Section */}
        {hasNeedsResponse && (
          <>
            <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
              ⏰ NEEDS RESPONSE
            </Text>
            {filteredNeedsResponse.map(renderMessage)}
          </>
        )}

        {/* Recent Section */}
        {hasRecent && (
          <>
            <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
              💬 RECENT
            </Text>
            {filteredRecent.map(renderMessage)}
          </>
        )}

        {/* Earlier Section */}
        {hasEarlier && (
          <>
            <Text variant="bodyMedium" size="xs" color="muted" style={styles.sectionHeader}>
              📅 EARLIER
            </Text>
            {filteredEarlier.map(renderMessage)}
          </>
        )}

        {/* Empty state / All caught up */}
        <View style={styles.emptyState}>
          <Text variant="body" size="sm" color="muted">
            You're all caught up!
          </Text>
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
    backgroundColor: '#E8F5E9', // Soft green for selling
    borderColor: '#81C784',
  },
  filterBtnBuying: {
    backgroundColor: '#E3F2FD', // Soft blue for buying
    borderColor: '#64B5F6',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120, // Space for tab bar
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
    backgroundColor: colors.blueSoft,
  },
  inboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAgent: {
    backgroundColor: colors.purpleSoft,
  },
  avatarBuyer: {
    backgroundColor: colors.blueSoft,
  },
  avatarSeller: {
    backgroundColor: colors.warningSoft,
  },
  avatarIcon: {
    fontSize: 16,
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
    backgroundColor: colors.purple,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
