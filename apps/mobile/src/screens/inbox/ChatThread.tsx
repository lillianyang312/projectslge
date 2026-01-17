import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxStackParamList } from '../../navigation/types';
import { ChatThread, type ChatType, type DealStatus } from '../../ui/components';
import { type ChatMessage } from '../../services/chatService';

type Props = NativeStackScreenProps<InboxStackParamList, 'ChatThread'>;

// Item-specific chat data for each of the 3 browse items
interface ItemChatData {
  messages: ChatMessage[];
  headerTitle: string;
  chatType: ChatType;
  unreadMessageIds: string[];
  contextCard: {
    emoji: string;
    title: string;
    subtitle: string;
  };
  // Deal status for showing action buttons
  dealStatus?: DealStatus;
  currentOffer?: number;
}

// Item-1 sofa - shows negotiating state with an offer
const sofaChatData: ItemChatData = {
  headerTitle: 'Mike T.',
  chatType: 'buying',
  unreadMessageIds: ['3', '5'],
  dealStatus: 'negotiating',
  currentOffer: 600, // Buyer offered $600 for the $650 sofa
  contextCard: {
    emoji: '🛋️',
    title: 'Mid-century Modern Sofa',
    subtitle: '$650 · Local pickup',
  },
  messages: [
    {
      id: '1',
      sender: 'agent',
      senderName: 'Agent',
      text: 'Welcome! You\'re viewing the Mid-century Modern Sofa.\n\nKey details:\n• Asking price: $650\n• Condition: Good\n• Walnut frame with original cushions\n\nWould you like to ask the seller any questions?',
      time: '10:00 AM',
    },
    {
      id: '2',
      sender: 'user',
      text: 'Hi! Can you tell me more about the wear on the armrests?',
      time: '10:05 AM',
    },
    {
      id: '3',
      sender: 'other',
      senderName: 'Seller',
      text: 'Sure! There\'s some minor surface wear on the armrests from normal use over the years. The fabric is still in good shape with no tears or stains. Happy to send more photos if you\'d like!',
      time: '10:12 AM',
    },
    {
      id: '4',
      sender: 'user',
      text: 'That sounds good. Would you take $600?',
      time: '10:15 AM',
    },
    {
      id: '5',
      sender: 'agent',
      senderName: 'Agent',
      text: 'I\'ve sent your offer of $600 to the seller (asking price was $650).\n\nThe seller is considering your offer. You can accept their counter-offer using the button below, or continue negotiating in chat.',
      time: '10:18 AM',
    },
  ],
};

const itemChats: Record<string, ItemChatData> = {
  // Sofa - item-1
  'item-1': sofaChatData,
  // Studio Display - item-2
  'item-2': {
    headerTitle: 'Alex K.',
    chatType: 'buying',
    unreadMessageIds: ['5', '6'], // Latest seller and agent responses are unread
    contextCard: {
      emoji: '🖥️',
      title: 'Apple Studio Display',
      subtitle: '$1,100 · Shipping OK',
    },
    messages: [
      {
        id: '1',
        sender: 'agent',
        senderName: 'Agent',
        text: 'Welcome! You\'re viewing the Apple Studio Display.\n\nKey details:\n• Asking price: $1,100\n• Condition: Like new\n• 27-inch 5K Retina display\n• Includes original packaging',
        time: '2:00 PM',
      },
      {
        id: '2',
        sender: 'user',
        text: 'Is this the standard glass or nano-texture version?',
        time: '2:10 PM',
      },
      {
        id: '3',
        sender: 'other',
        senderName: 'Seller',
        text: 'This is the standard glass version. It\'s been kept in a home office with minimal use - probably less than 100 hours total. No dead pixels or issues whatsoever.',
        time: '2:15 PM',
      },
      {
        id: '4',
        sender: 'user',
        text: 'Does it include the tilt-adjustable stand?',
        time: '2:18 PM',
      },
      {
        id: '5',
        sender: 'other',
        senderName: 'Seller',
        text: 'Yes, it has the standard tilt-adjustable stand. Everything that came in the original box is included.',
        time: '2:22 PM',
      },
      {
        id: '6',
        sender: 'agent',
        senderName: 'Agent',
        text: 'This is a great deal! The Apple Studio Display typically sells for $1,000-$1,200 in like-new condition. Seller offers shipping if you\'re not local.\n\nInterested in making an offer?',
        time: '2:25 PM',
      },
    ],
  },
  // Road Bike - item-3
  'item-3': {
    headerTitle: 'Jordan P.',
    chatType: 'buying',
    unreadMessageIds: ['5', '6'], // Latest seller and agent responses are unread
    contextCard: {
      emoji: '🚴',
      title: 'Specialized Road Bike',
      subtitle: '$450 · Local pickup',
    },
    messages: [
      {
        id: '1',
        sender: 'agent',
        senderName: 'Agent',
        text: 'Welcome! You\'re viewing the Specialized Road Bike.\n\nKey details:\n• Asking price: $450\n• Condition: Good\n• Carbon frame, new tires\n• Great for commuting or fitness',
        time: '9:30 AM',
      },
      {
        id: '2',
        sender: 'user',
        text: 'What size is the frame? And how old is the bike?',
        time: '9:35 AM',
      },
      {
        id: '3',
        sender: 'other',
        senderName: 'Seller',
        text: 'It\'s a 54cm frame, good for riders around 5\'8" to 5\'11". The bike is about 3 years old but well maintained - I\'ve replaced the tires and chain recently.',
        time: '9:42 AM',
      },
      {
        id: '4',
        sender: 'user',
        text: 'Perfect size for me! Has it been in any crashes?',
        time: '9:45 AM',
      },
      {
        id: '5',
        sender: 'other',
        senderName: 'Seller',
        text: 'No crashes at all. I\'ve used it mostly for weekend rides and it\'s been stored indoors. The carbon frame is in excellent condition.',
        time: '9:50 AM',
      },
      {
        id: '6',
        sender: 'agent',
        senderName: 'Agent',
        text: 'Similar Specialized road bikes sell for $400-$550 in this condition. The recent maintenance adds good value.\n\nWould you like to schedule a test ride or make an offer?',
        time: '9:55 AM',
      },
    ],
  },
};

// Default chat for general conversations (inbox) - this is selling
// Shows the "agreed" state ready for finalization
const defaultChatData: ItemChatData = {
  headerTitle: 'Sarah M.',
  chatType: 'selling',
  unreadMessageIds: [], // No unread messages in the default view
  dealStatus: 'agreed', // Ready to finalize
  currentOffer: 550,
  contextCard: {
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    subtitle: '$550 · Local pickup',
  },
  messages: [
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
      text: 'Great! The buyer has confirmed they\'re happy with $550 and cash payment.\n\nBoth parties have agreed on $550 with cash payment. You can now finalize the deal using the "Finalize Deal" button below. Once finalized, we\'ll coordinate pickup details.',
      time: '1:22 PM',
    },
  ],
};

export default function ChatThreadScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;

  // Get chat data based on conversationId, or use default
  const chatData = itemChats[conversationId] || defaultChatData;

  // Track deal status locally (in a real app, this would come from the database)
  const [dealStatus, setDealStatus] = useState<DealStatus | undefined>(chatData.dealStatus);
  const [currentOffer, setCurrentOffer] = useState<number | undefined>(chatData.currentOffer);

  // Handle finalize deal
  const handleFinalizeDeal = useCallback(() => {
    Alert.alert(
      'Finalize Deal',
      `Confirm the deal at $${currentOffer}? After finalizing, we'll coordinate pickup details.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'default',
          onPress: () => {
            setDealStatus('logistics');
            Alert.alert(
              'Deal Finalized!',
              'The deal has been confirmed. The agent will now help coordinate pickup details.',
            );
          },
        },
      ],
    );
  }, [currentOffer]);

  // Handle accept offer
  const handleAcceptOffer = useCallback((amount: number) => {
    Alert.alert(
      'Accept Offer',
      `Accept the offer of $${amount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => {
            setCurrentOffer(amount);
            setDealStatus('agreed');
            Alert.alert(
              'Offer Accepted!',
              `You've accepted $${amount}. You can now finalize the deal.`,
            );
          },
        },
      ],
    );
  }, []);

  return (
    <ChatThread
      initialMessages={chatData.messages}
      headerTitle={chatData.headerTitle}
      chatType={chatData.chatType}
      unreadMessageIds={chatData.unreadMessageIds}
      contextCard={chatData.contextCard}
      onGoBack={() => navigation.goBack()}
      // Pass itemId for context if this is an item chat
      context={conversationId.startsWith('item-') ? { itemId: conversationId.replace('item-', '') } : undefined}
      // Deal action props
      dealStatus={dealStatus}
      currentOffer={currentOffer}
      onFinalizeDeal={handleFinalizeDeal}
      onAcceptOffer={handleAcceptOffer}
    />
  );
}

