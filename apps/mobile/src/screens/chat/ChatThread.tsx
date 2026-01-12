import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { Text, Card } from '../../ui/components';
import { colors, spacing, radius, typography, shadows } from '../../ui/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>;

type MessageSender = 'user' | 'agent' | 'other';

interface Message {
  id: string;
  sender: MessageSender;
  senderName?: string;
  text: string;
  time: string;
}

// Demo messages matching HTML spec exactly
const demoMessages: Message[] = [
  {
    id: '1',
    sender: 'agent',
    senderName: 'Agent',
    text: "Deal confirmed at $550! I'm coordinating pickup based on both your availability.",
    time: '2:34 PM',
  },
  {
    id: '2',
    sender: 'agent',
    senderName: 'Agent',
    text: 'Found 3 matching times. The buyer prefers Saturday afternoon—does that work?',
    time: '2:36 PM',
  },
  {
    id: '3',
    sender: 'user',
    text: 'Saturday works! Can we do closer to 3pm?',
    time: '2:40 PM',
  },
  {
    id: '4',
    sender: 'agent',
    senderName: 'Agent',
    text: 'Checking with the buyer now.',
    time: '2:41 PM',
  },
  {
    id: '5',
    sender: 'other',
    senderName: 'Buyer',
    text: '3pm works great! Is there parking nearby?',
    time: '2:45 PM',
  },
  {
    id: '6',
    sender: 'user',
    text: 'Yes, street parking is easy on Saturdays',
    time: '2:47 PM',
  },
  {
    id: '7',
    sender: 'agent',
    senderName: 'Agent',
    text: "✓ Pickup confirmed: Saturday Jan 11, 3:00 PM. I'll send reminders to both of you. Meeting point shared 1 hour before.",
    time: '2:48 PM',
  },
];

const quickActions = [
  'Running late',
  'Need to reschedule',
  'Question about item',
];

export default function ChatThreadScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      // Would send message here
      setMessage('');
    }
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.sender === 'user';
    const isAgent = msg.sender === 'agent';

    return (
      <View
        key={msg.id}
        style={[
          styles.messageRow,
          isUser && styles.messageRowUser,
        ]}
      >
        {!isUser && (
          <View style={[styles.messageAvatar, isAgent && styles.agentAvatar]}>
            <Text style={styles.avatarText}>{isAgent ? '🤖' : '👤'}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser && styles.messageBubbleUser,
            isAgent && styles.messageBubbleAgent,
            !isUser && !isAgent && styles.messageBubbleOther,
          ]}
        >
          {!isUser && msg.senderName && (
            <Text variant="bodyMedium" size="xs" style={styles.senderName}>
              {msg.senderName}
            </Text>
          )}
          <Text
            variant="body"
            size="md"
            style={isUser ? styles.messageTextUser : undefined}
          >
            {msg.text}
          </Text>
          <Text
            variant="body"
            size="xs"
            style={[styles.messageTime, isUser && styles.messageTimeUser]}
          >
            {msg.time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            Chat
          </Text>
          <Pressable style={styles.locationBtn}>
            <Text size="lg">📍</Text>
          </Pressable>
        </View>

        {/* Context card */}
        <View style={styles.contextCard}>
          <View style={styles.contextContent}>
            <View style={styles.contextThumb}>
              <Text style={styles.contextEmoji}>🪑</Text>
            </View>
            <View style={styles.contextInfo}>
              <Text variant="bodyMedium" size="md">
                Herman Miller Aeron
              </Text>
              <Text variant="body" size="sm" color="secondary">
                $550 · Local pickup
              </Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {demoMessages.map(renderMessage)}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActions}
          >
            {quickActions.map((action) => (
              <Pressable key={action} style={styles.quickAction}>
                <Text variant="body" size="xs">
                  {action}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />
            <Pressable style={styles.sendBtn} onPress={handleSend}>
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.md,
  },
  locationBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCard: {
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  contextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contextThumb: {
    width: 40,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextEmoji: {
    fontSize: 18,
  },
  contextInfo: {},
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  agentAvatar: {
    backgroundColor: colors.purpleSoft,
  },
  avatarText: {
    fontSize: 14,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: 16,
    maxWidth: '100%',
  },
  messageBubbleUser: {
    backgroundColor: colors.accent,
  },
  messageBubbleAgent: {
    backgroundColor: colors.purpleSoft,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    marginBottom: spacing.xs,
    opacity: 0.7,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTime: {
    marginTop: spacing.xs,
    opacity: 0.5,
  },
  messageTimeUser: {
    color: '#FFFFFF',
  },
  inputArea: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionsScroll: {
    marginBottom: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

