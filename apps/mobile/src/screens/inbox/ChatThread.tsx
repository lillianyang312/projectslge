import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxStackParamList } from '../../navigation/types';
import { Text, Card } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';

type Props = NativeStackScreenProps<InboxStackParamList, 'ChatThread'>;

interface Message {
  id: string;
  sender: 'user' | 'other' | 'agent';
  text: string;
  time: string;
  senderName?: string;
}

// Demo messages with comprehensive bid coordination details
const demoMessages: Message[] = [
  {
    id: '1',
    sender: 'agent',
    senderName: 'Agent',
    text: 'New bid received for Herman Miller Aeron!\n\nBid details:\n• Price: $550\n• Payment: Cash\n• Delivery: Local pickup\n• Buyer question: "Is the lumbar support fully adjustable?"',
    time: '1:15 PM',
  },
  {
    id: '2',
    sender: 'user',
    text: 'Yes, lumbar support is fully adjustable. I\'m interested in accepting this bid.',
    time: '1:20 PM',
  },
  {
    id: '3',
    sender: 'agent',
    senderName: 'Agent',
    text: 'Great! I\'ve confirmed the buyer is still interested. Let me coordinate the details.\n\nBid summary:\n• Agreed price: $550\n• Payment method: Cash on pickup\n• Delivery: Local pickup',
    time: '1:22 PM',
  },
  {
    id: '4',
    sender: 'agent',
    senderName: 'Agent',
    text: 'I found 3 pickup times that work for both of you:\n• Saturday at 3pm\n• Sunday at 11am\n• Monday at 6pm\n\nWhich works best for you?',
    time: '1:25 PM',
  },
  {
    id: '5',
    sender: 'user',
    text: 'Saturday at 3pm works perfectly!',
    time: '1:28 PM',
  },
  {
    id: '6',
    sender: 'agent',
    senderName: 'Agent',
    text: '✓ Pickup time confirmed: Saturday at 3pm\n\nI\'ve shared your address with the buyer. Please confirm:\n• Payment: $550 cash on pickup\n• Location: Your address',
    time: '1:30 PM',
  },
  {
    id: '7',
    sender: 'other',
    senderName: 'Buyer',
    text: 'Hi! Looking forward to Saturday. Is there parking nearby?',
    time: '1:35 PM',
  },
  {
    id: '8',
    sender: 'user',
    text: 'Yes, street parking is easy on weekends. I\'ll be at the front door.',
    time: '1:38 PM',
  },
  {
    id: '9',
    sender: 'other',
    senderName: 'Buyer',
    text: 'Perfect! Will the chair fit in a sedan or do I need a larger vehicle?',
    time: '1:40 PM',
  },
  {
    id: '10',
    sender: 'user',
    text: 'It should fit in a sedan if you fold down the back seat. It\'s fully assembled so no disassembly needed.',
    time: '1:42 PM',
  },
  {
    id: '11',
    sender: 'agent',
    senderName: 'Agent',
    text: '✓ All details confirmed:\n\n📍 Pickup: Saturday 3pm at your address\n💵 Payment: $550 cash\n🚗 Transport: Sedan with folded back seat\n📦 Item: Fully assembled\n\nI\'ll send reminders to both of you on Friday.',
    time: '1:45 PM',
  },
];

export default function ChatThreadScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const getMessageStyle = (sender: 'user' | 'other' | 'agent') => {
    if (sender === 'user') return styles.messageUser;
    if (sender === 'agent') return styles.messageAgent;
    return styles.messageOther;
  };

  const getAvatarStyle = (sender: 'user' | 'other' | 'agent') => {
    if (sender === 'agent') return styles.avatarAgent;
    return styles.avatar;
  };

  const getAvatarIcon = (sender: 'user' | 'other' | 'agent') => {
    if (sender === 'agent') return '🤖';
    if (sender === 'user') return '👤';
    return '👤';
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            Sarah M.
          </Text>
        </View>

        {/* Context Card - matching HTML spec lines 1146-1154 */}
        <View style={styles.contextCard}>
          <Card style={styles.contextCardInner}>
            <View style={styles.contextContent}>
              <View style={styles.contextThumb}>
                <Text style={styles.contextEmoji}>🪑</Text>
              </View>
              <View style={styles.contextInfo}>
                <Text variant="bodyMedium" size="md" style={styles.contextTitle}>
                  Herman Miller Aeron
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  $550 · Local pickup
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Messages */}
        <ScrollView
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.sender === 'user' && styles.messageRowUser,
              ]}
            >
              {message.sender !== 'user' && (
                <View style={[styles.avatar, getAvatarStyle(message.sender)]}>
                  <Text style={styles.avatarText}>{getAvatarIcon(message.sender)}</Text>
                </View>
              )}
              <View style={[styles.messageBubble, getMessageStyle(message.sender)]}>
                {message.senderName && (
                  <Text
                    variant="bodyMedium"
                    size="xs"
                    style={[
                      styles.senderName,
                      message.sender === 'user' && styles.senderNameUser,
                    ]}
                  >
                    {message.senderName}
                  </Text>
                )}
                <Text
                  variant="body"
                  size="md"
                  style={[
                    styles.messageText,
                    message.sender === 'user' && styles.messageTextUser,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  variant="body"
                  size="xs"
                  style={[
                    styles.messageTime,
                    message.sender === 'user' && styles.messageTimeUser,
                  ]}
                >
                  {message.time}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            blurOnSubmit={false}
            returnKeyType="default"
            enablesReturnKeyAutomatically={false}
          />
          <Pressable
            style={styles.dismissBtn}
            onPress={() => Keyboard.dismiss()}
          >
            <Text style={styles.dismissBtnText}>↓</Text>
          </Pressable>
          <Pressable style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
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
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
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
  },
  contextCard: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  contextCardInner: {
    backgroundColor: colors.accentSoft,
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
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextEmoji: {
    fontSize: 18,
  },
  contextInfo: {
    flex: 1,
  },
  contextTitle: {
    marginBottom: 2,
  },
  messagesContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAgent: {
    backgroundColor: colors.purpleSoft,
  },
  avatarText: {
    fontSize: 14,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: 16,
  },
  messageUser: {
    backgroundColor: colors.accent,
  },
  messageAgent: {
    backgroundColor: colors.purpleSoft,
  },
  messageOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    marginBottom: 4,
    opacity: 0.7,
    fontWeight: '600',
  },
  senderNameUser: {
    color: '#FFFFFF',
  },
  messageText: {
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTime: {
    marginTop: 6,
    opacity: 0.5,
  },
  messageTimeUser: {
    color: '#FFFFFF',
  },
  inputArea: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
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
    fontSize: 18,
    color: '#FFFFFF',
  },
});
