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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../navigation/types';
import { Text, RichPriceText } from '../ui/components';
import { colors, spacing, radius, typography } from '../ui/tokens';
import {
  sendChatMessage,
  formatMessageTime,
  generateMessageId,
  type ChatMessage,
} from '../services/chatService';
import { GENERAL_PERSONALITY_SYSTEM_PROMPT } from '../services/chatPrompts';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatThread'>;

export default function ChatThreadScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    const messageText = message.trim();
    if (!messageText || sending) return;

    // Create user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      sender: 'user',
      text: messageText,
      time: formatMessageTime(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    setSending(true);

    try {
      // Send to chatbot
      const response = await sendChatMessage(
        messageText,
        messages.filter((msg) => msg.sender === 'user' || msg.sender === 'agent'),
        GENERAL_PERSONALITY_SYSTEM_PROMPT
      );

      if (response) {
        // Add agent response
        const agentMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'agent',
          senderName: 'Agent',
          text: response.output,
          time: formatMessageTime(),
          priceReferences: response.priceReferences,
        };
        setMessages((prev) => [...prev, agentMessage]);
      } else {
        // Show error message
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'agent',
          senderName: 'Agent',
          text: "I'm having trouble responding right now. Please try again.",
          time: formatMessageTime(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'agent',
        senderName: 'Agent',
        text: "I'm having trouble responding right now. Please try again.",
        time: formatMessageTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
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
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            Chat Thread
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text variant="body" size="md" color="secondary" style={styles.emptyText}>
                Start a conversation with the agent
              </Text>
            </View>
          )}
          {messages.map(renderMessage)}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputArea}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />
            <Pressable
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending || !message.trim()}
            >
              {sending ? (
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
  headerSpacer: {
    width: 36,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    textAlign: 'center',
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
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
