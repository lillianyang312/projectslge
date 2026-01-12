import React, { useState, useEffect, useRef } from 'react';
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
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { Message } from '../../types/models';
import { getMessages, sendMessage } from '../../services/dealsService';
import { getQuickActionMessages } from '../../services/agentService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealChat'>;

export default function DealChatScreen({ navigation, route }: Props) {
  const { dealId, deliveryMethod } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    const msgs = await getMessages(dealId);
    setMessages(msgs);
    setLoading(false);
  }

  async function handleSend() {
    if (!inputText.trim() || !user) return;

    const newMessage = await sendMessage(dealId, user.id, inputText.trim());

    if (newMessage) {
      setMessages([...messages, newMessage]);
      setInputText('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function handleQuickAction(message: string) {
    if (!user) return;

    const newMessage = await sendMessage(dealId, user.id, message, 'quick_action');

    if (newMessage) {
      setMessages([...messages, newMessage]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const quickActions = deliveryMethod
    ? getQuickActionMessages(deliveryMethod as 'pickup' | 'shipping')
    : [];

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
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading4">
            Chat
          </Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === user?.id}
            />
          ))}
        </ScrollView>

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <ScrollView
            horizontal
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActionsContent}
            showsHorizontalScrollIndicator={false}
          >
            {quickActions.map((action, idx) => (
              <Pressable
                key={idx}
                style={styles.quickActionBtn}
                onPress={() => handleQuickAction(action)}
              >
                <Text variant="bodyMedium" size="sm">
                  {action}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text variant="bodyMedium" size="lg" color="white">
              →
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const isAgent = message.is_agent;

  return (
    <View
      style={[
        styles.messageBubble,
        isAgent && styles.messageBubbleAgent,
        isOwn && !isAgent && styles.messageBubbleOwn,
      ]}
    >
      {isAgent && (
        <Text variant="bodyMedium" size="xs" color="accent" style={styles.agentLabel}>
          AGENT
        </Text>
      )}

      <Text
        variant="body"
        size="base"
        color={isOwn && !isAgent ? 'white' : 'primary'}
        style={styles.messageText}
      >
        {message.content}
      </Text>

      <Text
        variant="body"
        size="xs"
        color={isOwn && !isAgent ? 'white' : 'muted'}
        style={styles.messageTime}
      >
        {new Date(message.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
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
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  messagesContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  messageBubbleOwn: {
    backgroundColor: colors.accent,
    alignSelf: 'flex-end',
  },
  messageBubbleAgent: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  agentLabel: {
    marginBottom: spacing.xs,
  },
  messageText: {
    marginBottom: spacing.xs,
  },
  messageTime: {
    opacity: 0.7,
  },
  quickActionsScroll: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionsContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  quickActionBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.body,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 48,
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.bgAlt,
  },
});
