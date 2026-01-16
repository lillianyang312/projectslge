/**
 * Shared ChatThread Component
 * 
 * A reusable chat thread UI component with integrated chatbot middleware.
 * Supports both inbox and profile chat contexts.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { Card } from './Card';
import { RichPriceText, type PriceReference } from './RichPriceText';
import { PendingMessage } from './PendingMessage';
import { colors, spacing, radius, typography } from '../tokens';
import {
  formatMessageTime,
  generateMessageId,
  type ChatMessage,
} from '../../services/chatService';
import { useChatLLM } from '../../hooks/useChatLLM';

export interface ChatThreadContext {
  itemId?: string;
  dealId?: string;
}

export interface ChatThreadProps {
  /**
   * Initial messages to display
   */
  initialMessages?: ChatMessage[];
  /**
   * Optional context for the chatbot (itemId, dealId)
   */
  context?: ChatThreadContext;
  /**
   * Header title (default: "Chat")
   */
  headerTitle?: string;
  /**
   * Optional header right button (e.g., location button)
   */
  headerRight?: React.ReactNode;
  /**
   * Optional context card to display above messages
   */
  contextCard?: {
    emoji?: string;
    title: string;
    subtitle: string;
  };
  /**
   * Quick action buttons to display above input
   */
  quickActions?: string[];
  /**
   * Callback when user sends a message
   */
  onSendMessage?: (message: ChatMessage) => void;
  /**
   * Callback when agent responds
   */
  onAgentResponse?: (message: ChatMessage) => void;
  /**
   * Whether to automatically send messages to LLM (default: true)
   */
  autoSend?: boolean;
  /**
   * Custom system prompt (optional)
   */
  systemPrompt?: string;
  /**
   * Whether to show dismiss keyboard button (default: false)
   */
  showDismissButton?: boolean;
  /**
   * Navigation go back handler
   */
  onGoBack?: () => void;
}

export default function ChatThread({
  initialMessages = [],
  context,
  headerTitle = 'Chat',
  headerRight,
  contextCard,
  quickActions = [],
  onSendMessage,
  onAgentResponse,
  autoSend = true,
  systemPrompt,
  showDismissButton = false,
  onGoBack,
}: ChatThreadProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const scrollViewRef = useRef<ScrollView>(null);

  // Use the custom hook for LLM calls
  const { isLoading, error, agentResponse, sendMessage } = useChatLLM(messages, {
    context,
    autoSend,
    systemPrompt,
  });

  // Update messages when initialMessages change
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Scroll to bottom when new messages arrive or when loading state changes
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isLoading]);

  // Add agent response to messages when it arrives
  useEffect(() => {
    if (agentResponse) {
      // Check if this response is already in messages
      const exists = messages.some((msg) => msg.id === agentResponse.id);
      if (!exists) {
        console.log('💬 [ChatThread] Adding agent response to messages:', {
          messageId: agentResponse.id,
          textPreview: agentResponse.text.substring(0, 100) + (agentResponse.text.length > 100 ? '...' : ''),
          priceReferencesCount: agentResponse.priceReferences?.length || 0,
          time: agentResponse.time,
        });
        setMessages((prev) => [...prev, agentResponse]);
        onAgentResponse?.(agentResponse);
      } else {
        console.log('⏭️ [ChatThread] Agent response already exists, skipping:', agentResponse.id);
      }
    }
  }, [agentResponse, messages, onAgentResponse]);

  // Handle errors from LLM
  useEffect(() => {
    if (error) {
      console.error('❌ [ChatThread] LLM error detected:', {
        error,
        currentMessagesCount: messages.length,
      });
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'agent',
        senderName: 'Agent',
        text: "I'm having trouble responding right now. Please try again.",
        time: formatMessageTime(),
      };
      setMessages((prev) => {
        // Check if error message already exists
        const hasError = prev.some(
          (msg) => msg.sender === 'agent' && msg.text === errorMessage.text
        );
        if (!hasError) {
          console.log('⚠️ [ChatThread] Adding error message to chat');
          return [...prev, errorMessage];
        }
        return prev;
      });
    }
  }, [error, messages.length]);

  const handleSend = async () => {
    const messageText = message.trim();
    if (!messageText || isLoading) {
      console.log('⏸️ [ChatThread] Skipping send - empty message or loading:', {
        hasMessage: !!messageText,
        isLoading,
      });
      return;
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      sender: 'user',
      text: messageText,
      time: formatMessageTime(),
    };

    console.log('📝 [ChatThread] User sending message:', {
      messageId: userMessage.id,
      text: messageText,
      time: userMessage.time,
      currentMessagesCount: messages.length,
    });

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setMessage('');
    onSendMessage?.(userMessage);

    // Manually trigger LLM call with the message ID and updated messages
    // This ensures the conversation history includes the new user message
    console.log('🚀 [ChatThread] Triggering LLM call for message:', {
      messageId: userMessage.id,
      messageText,
      previousMessagesCount: messages.length,
      updatedMessagesCount: updatedMessages.length,
    });
    sendMessage(messageText, userMessage.id, updatedMessages).catch((err) => {
      console.error('❌ [ChatThread] Error sending message:', err);
    });
  };

  const handleQuickAction = (action: string) => {
    setMessage(action);
  };

  const renderMessage = (msg: ChatMessage) => {
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
          <RichPriceText
            text={msg.text}
            references={msg.priceReferences}
            size="md"
            color={isUser ? 'white' : 'primary'}
          />
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
          {onGoBack && (
            <Pressable onPress={onGoBack} style={styles.backBtn}>
              <Text size="xl">←</Text>
            </Pressable>
          )}
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          {headerRight || <View style={styles.headerRightPlaceholder} />}
        </View>

        {/* Context card */}
        {contextCard && (
          <View style={styles.contextCard}>
            <View style={styles.contextContent}>
              <View style={styles.contextThumb}>
                <Text style={styles.contextEmoji}>{contextCard.emoji || '📦'}</Text>
              </View>
              <View style={styles.contextInfo}>
                <Text variant="bodyMedium" size="md">
                  {contextCard.title}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  {contextCard.subtitle}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(renderMessage)}
          {/* Show pending message animation when agent is responding */}
          {isLoading && <PendingMessage senderName="Agent" />}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputArea}>
          {quickActions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickActionsScroll}
              contentContainerStyle={styles.quickActions}
            >
              {quickActions.map((action) => (
                <Pressable
                  key={action}
                  style={styles.quickAction}
                  onPress={() => handleQuickAction(action)}
                >
                  <Text variant="body" size="xs">
                    {action}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
            />
            {showDismissButton && (
              <Pressable
                style={styles.dismissBtn}
                onPress={() => {
                  // Keyboard.dismiss() would be handled by parent if needed
                }}
              >
                <Text style={styles.dismissBtnText}>↓</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.sendBtn, isLoading && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendBtnText}>↑</Text>
              )}
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
  headerRightPlaceholder: {
    width: 36,
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
    maxHeight: 100,
  },
  dismissBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 18,
    color: colors.textSecondary,
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
  sendBtnDisabled: {
    opacity: 0.5,
  },
});

