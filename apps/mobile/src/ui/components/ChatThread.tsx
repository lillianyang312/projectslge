/**
 * Shared ChatThread Component
 *
 * A reusable chat thread UI component with integrated chatbot middleware.
 * Supports both inbox and profile chat contexts.
 *
 * Features:
 * - Auto-expanding multiline input (up to 140px max height)
 * - Proper keyboard avoidance on iOS and Android
 * - Interactive keyboard dismiss on scroll
 * - Visible typed text with correct colors
 * - Messages pinned to bottom - most recent message right above input
 * - No empty scroll space below messages for maximum chat visibility
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Keyboard,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  Dimensions,
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

// Constants for input sizing
const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 140;

export interface ChatThreadContext {
  itemId?: string;
  dealId?: string;
}

export type ChatType = 'buying' | 'selling';

export type DealStatus = 'negotiating' | 'agreed' | 'logistics' | 'completed' | 'cancelled';

export type ActionNeededType = 'accept_offer' | 'counter_offer' | 'confirm_pickup' | 'finalize' | 'provide_payment' | 'suggest_times';

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
   * Chat type - 'buying' (blue) or 'selling' (green)
   * Displayed as a badge next to the header title
   */
  chatType?: ChatType;
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
   * Navigation go back handler
   */
  onGoBack?: () => void;
  /**
   * IDs of messages that are unread (will be highlighted in yellow)
   */
  unreadMessageIds?: string[];
  /**
   * Current deal status for showing action buttons
   */
  dealStatus?: DealStatus;
  /**
   * Current offer amount (for display in action bar)
   */
  currentOffer?: number;
  /**
   * Callback when user finalizes the deal
   */
  onFinalizeDeal?: () => void;
  /**
   * Callback when user accepts an offer
   */
  onAcceptOffer?: (amount: number) => void;
  /**
   * Callback when user confirms pickup details
   */
  onConfirmPickup?: (date: string, location: string) => void;
}

export default function ChatThread({
  initialMessages = [],
  context,
  headerTitle = 'Chat',
  headerRight,
  chatType,
  contextCard,
  quickActions = [],
  onSendMessage,
  onAgentResponse,
  autoSend = true,
  systemPrompt,
  onGoBack,
  unreadMessageIds = [],
  dealStatus,
  currentOffer,
  onFinalizeDeal,
  onAcceptOffer,
  onConfirmPickup,
}: ChatThreadProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isContextExpanded, setIsContextExpanded] = useState(true);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Use the custom hook for LLM calls
  const { isLoading, error, agentResponse, sendMessage } = useChatLLM(messages, {
    context,
    autoSend,
    systemPrompt,
  });

  // Track keyboard visibility
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setIsContextExpanded(false);
        // Scroll to end when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

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

  // Handle input content size change for auto-expanding
  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const { contentSize } = event.nativeEvent;
      const newHeight = Math.min(
        Math.max(contentSize.height + 16, MIN_INPUT_HEIGHT), // Add padding
        MAX_INPUT_HEIGHT
      );
      setInputHeight(newHeight);
    },
    []
  );

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
    setInputHeight(MIN_INPUT_HEIGHT); // Reset input height after send
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
    const isUnread = unreadMessageIds.includes(msg.id);

    return (
      <View
        key={msg.id}
        style={[
          styles.messageRow,
          isUser && styles.messageRowUser,
          isUnread && styles.messageRowUnread,
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
            isUnread && !isUser && styles.messageBubbleUnread,
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          {onGoBack && (
            <Pressable onPress={onGoBack} style={styles.backBtn}>
              <Text size="xl">←</Text>
            </Pressable>
          )}
          <View style={styles.headerTitleContainer}>
            <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
              {headerTitle}
            </Text>
            {chatType && (
              <View style={[
                styles.chatTypeBadge,
                chatType === 'buying' ? styles.chatTypeBuying : styles.chatTypeSelling,
              ]}>
                <Text style={[
                  styles.chatTypeBadgeText,
                  chatType === 'buying' ? styles.chatTypeBuyingText : styles.chatTypeSellingText,
                ]}>
                  {chatType === 'buying' ? 'Buying' : 'Selling'}
                </Text>
              </View>
            )}
          </View>
          {headerRight || <View style={styles.headerRightPlaceholder} />}
        </View>

        {/* Context card - collapsible to show more messages */}
        {contextCard && (
          <Pressable
            style={[styles.contextCard, !isContextExpanded && styles.contextCardCollapsed]}
            onPress={() => setIsContextExpanded(!isContextExpanded)}
          >
            <View style={styles.contextContent}>
              <View style={[styles.contextThumb, !isContextExpanded && styles.contextThumbSmall]}>
                <Text style={[styles.contextEmoji, !isContextExpanded && styles.contextEmojiSmall]}>
                  {contextCard.emoji || '📦'}
                </Text>
              </View>
              <View style={styles.contextInfo}>
                <Text variant="bodyMedium" size={isContextExpanded ? 'md' : 'sm'} numberOfLines={1}>
                  {contextCard.title}
                </Text>
                {isContextExpanded && (
                  <Text variant="body" size="sm" color="secondary">
                    {contextCard.subtitle}
                  </Text>
                )}
              </View>
              <Text style={styles.expandIcon}>{isContextExpanded ? '▲' : '▼'}</Text>
            </View>
          </Pressable>
        )}

        {/* Messages - pinned to bottom, no empty scroll space below */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={() => {
            // Dismiss keyboard when user starts scrolling
            Keyboard.dismiss();
          }}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
          showsVerticalScrollIndicator={true}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text variant="body" size="md" color="secondary" style={styles.emptyText}>
                Start a conversation
              </Text>
            </View>
          )}
          {messages.map(renderMessage)}
          {/* Show pending message animation when agent is responding */}
          {isLoading && <PendingMessage senderName="Agent" />}
        </ScrollView>

        {/* Deal action bar - shown when deal is in agreed status (ready to finalize) */}
        {dealStatus === 'agreed' && onFinalizeDeal && (
          <View style={styles.dealActionBar}>
            <View style={styles.dealActionInfo}>
              <Text variant="bodyMedium" size="sm" color="success">
                Price agreed{currentOffer ? `: $${currentOffer}` : ''}
              </Text>
              <Text variant="body" size="xs" color="secondary">
                Ready to finalize the deal
              </Text>
            </View>
            <Pressable style={styles.finalizeBtn} onPress={onFinalizeDeal}>
              <Text style={styles.finalizeBtnText}>Finalize Deal</Text>
            </Pressable>
          </View>
        )}

        {/* Deal action bar - shown when in negotiating status with an offer */}
        {dealStatus === 'negotiating' && currentOffer && onAcceptOffer && (
          <View style={styles.dealActionBar}>
            <View style={styles.dealActionInfo}>
              <Text variant="bodyMedium" size="sm" color="blue">
                Current offer: ${currentOffer}
              </Text>
              <Text variant="body" size="xs" color="secondary">
                Respond in chat or accept below
              </Text>
            </View>
            <Pressable
              style={[styles.acceptBtn]}
              onPress={() => onAcceptOffer(currentOffer)}
            >
              <Text style={styles.acceptBtnText}>Accept ${currentOffer}</Text>
            </Pressable>
          </View>
        )}

        {/* Deal completed banner */}
        {dealStatus === 'completed' && (
          <View style={styles.completedBanner}>
            <Text variant="bodyMedium" size="md" color="success">
              ✓ Deal completed!
            </Text>
          </View>
        )}

        {/* Input area */}
        <View style={styles.inputArea}>
          {quickActions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickActionsScroll}
              contentContainerStyle={styles.quickActions}
              keyboardShouldPersistTaps="handled"
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
            <View style={[styles.textInputWrapper, { minHeight: inputHeight }]}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.textInput,
                  { height: Math.max(inputHeight, MIN_INPUT_HEIGHT) },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                onContentSizeChange={handleContentSizeChange}
                multiline
                maxLength={500}
                textAlignVertical="center"
                selectionColor={colors.accent}
                returnKeyType="default"
                blurOnSubmit={false}
                onFocus={() => {
                  // Scroll to end when input is focused
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
              />
            </View>
            <Pressable
              style={[
                styles.sendBtn,
                (isLoading || !message.trim()) && styles.sendBtnDisabled,
              ]}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
  },
  chatTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  chatTypeBuying: {
    backgroundColor: colors.buyingSoft,
  },
  chatTypeSelling: {
    backgroundColor: colors.sellingSoft,
  },
  chatTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chatTypeBuyingText: {
    color: colors.buying,
  },
  chatTypeSellingText: {
    color: colors.selling,
  },
  headerRightPlaceholder: {
    width: 36,
  },
  contextCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  contextCardCollapsed: {
    padding: spacing.xs,
    marginBottom: spacing.xs,
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
  contextThumbSmall: {
    width: 28,
    height: 28,
  },
  contextEmoji: {
    fontSize: 18,
  },
  contextEmojiSmall: {
    fontSize: 14,
  },
  contextInfo: {
    flex: 1,
  },
  expandIcon: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    // Pin messages to bottom - no empty space below last message
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageRowUnread: {
    backgroundColor: colors.unread,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
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
  messageBubbleUnread: {
    // Subtle border highlight for unread messages from others
    borderWidth: 1,
    borderColor: colors.unreadBorder,
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.md,
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
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    textAlignVertical: 'center',
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
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
  // Deal action bar styles
  dealActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  dealActionInfo: {
    flex: 1,
  },
  finalizeBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  finalizeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    backgroundColor: colors.buying,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBanner: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.success,
  },
});
