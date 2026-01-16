import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { Text, ChatThread } from '../../ui/components';
import { type ChatMessage } from '../../services/chatService';
import { colors, spacing, radius } from '../../ui/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>;

// Demo messages matching HTML spec exactly - kept as initial state
const initialDemoMessages: ChatMessage[] = [
  {
    id: '1',
    sender: 'agent',
    senderName: 'Agent',
    text: "Deal confirmed at $550! I'm coordinating pickup based on both your availability.",
    time: '2:34 PM',
    priceReferences: [
      {
        kind: 'agreed_price',
        amount: 550,
      },
    ],
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

  return (
    <ChatThread
      initialMessages={initialDemoMessages}
      headerTitle="Chat"
      headerRight={
        <Pressable style={styles.locationBtn}>
          <Text size="lg">📍</Text>
        </Pressable>
      }
      contextCard={{
        emoji: '🪑',
        title: 'Herman Miller Aeron',
        subtitle: '$550 · Local pickup',
      }}
      quickActions={quickActions}
      onGoBack={() => navigation.goBack()}
      // Optional: Add context if conversationId maps to a dealId or itemId
      // context={{ dealId: conversationId }}
    />
  );
}

const styles = StyleSheet.create({
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
});


