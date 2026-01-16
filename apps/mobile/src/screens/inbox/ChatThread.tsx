import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxStackParamList } from '../../navigation/types';
import { ChatThread } from '../../ui/components';
import { type ChatMessage } from '../../services/chatService';

type Props = NativeStackScreenProps<InboxStackParamList, 'ChatThread'>;

// Demo messages with comprehensive bid coordination details
// Converted to ChatMessage format for compatibility
const demoMessages: ChatMessage[] = [
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

  return (
    <ChatThread
      initialMessages={demoMessages}
      headerTitle="Sarah M."
      contextCard={{
        emoji: '🪑',
        title: 'Herman Miller Aeron',
        subtitle: '$550 · Local pickup',
      }}
      showDismissButton={true}
      onGoBack={() => navigation.goBack()}
      // Optional: Add context if conversationId maps to a dealId or itemId
      // context={{ dealId: conversationId }}
    />
  );
}

