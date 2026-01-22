import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge, RichPriceText, type PriceReference } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { Deal, Message, DealStatus } from '../../types/models';
import {
  getDealById,
  getMessages,
  sendMessage,
  sendAgentMessage,
  acceptOffer,
  makeOffer,
  setLogistics,
  completeDeal,
  getUserSchedulingInfo,
  markDealAsRead,
} from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { getSignedUrlCached } from '../../services/imageService';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealChat'>;

// Category to emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  'Electronics': '📱',
  'Furniture': '🪑',
  'Clothing': '👕',
  'Books': '📚',
  'Sports': '⚽',
  'Sports & Outdoors': '🚴',
  'Music': '🎸',
  'Art': '🎨',
  'Kitchen': '🍳',
  'Home': '🏠',
  'Office': '💼',
  'Games': '🎮',
  'Other': '📦',
};

function getEmojiForCategory(category: string): string {
  return CATEGORY_EMOJI[category] || '📦';
}

function getStatusBadgeVariant(status: DealStatus): 'warning' | 'success' | 'purple' | 'default' {
  switch (status) {
    case 'negotiating': return 'purple';
    case 'agreed': return 'success';
    case 'logistics': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'default';
    default: return 'default';
  }
}

function getStatusLabel(status: DealStatus): string {
  switch (status) {
    case 'negotiating': return 'Negotiating';
    case 'agreed': return 'Agreed';
    case 'logistics': return 'Scheduling';
    case 'completed': return 'Complete';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

export default function DealChatScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const user = useAuthStore((state) => state.user);
  const scrollViewRef = useRef<ScrollView>(null);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [scheduleNote, setScheduleNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which action is loading

  const isSelling = deal?.seller_id === user?.id;
  const otherPartyLabel = isSelling ? 'Buyer' : 'Seller';

  // Check if deal is in accepted state (post-negotiation)
  const isAccepted = deal && ['agreed', 'logistics', 'completed'].includes(deal.status);

  // Get the counterparty name for display in header
  const counterpartyName = isSelling
    ? (deal?.buyer?.display_name || 'Buyer')
    : (deal?.seller?.display_name || 'Seller');

  // Load deal and messages
  useEffect(() => {
    loadDealAndMessages();
  }, [dealId]);

  async function loadDealAndMessages() {
    setLoading(true);
    try {
      const [fetchedDeal, fetchedMessages] = await Promise.all([
        getDealById(dealId),
        getMessages(dealId),
      ]);

      setDeal(fetchedDeal);
      setMessages(fetchedMessages);

      // Mark deal as read when opening chat
      if (user?.id && fetchedDeal) {
        markDealAsRead(dealId, user.id);
      }

      // Load item image (using cached signed URL)
      if (fetchedDeal?.item?.photos?.[0]) {
        const url = await getSignedUrlCached(fetchedDeal.item.photos[0]);
        setImageUrl(url);
      }
    } catch (error) {
      console.error('Error loading deal chat:', error);
    } finally {
      setLoading(false);
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMessage = await sendMessage(dealId, user.id, messageText);
      if (newMessage) {
        setMessages(prev => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!deal || !user || actionLoading) return;

    Alert.alert(
      'Accept Offer',
      `Accept the offer of $${deal.current_offer}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading('accept');
            try {
              const success = await acceptOffer(deal.id, user.id);
              if (success) {
                // Reload deal to get updated status
                const updatedDeal = await getDealById(dealId);
                setDeal(updatedDeal);

                // Reload messages to see system message
                const updatedMessages = await getMessages(dealId);
                setMessages(updatedMessages);
              } else {
                Alert.alert('Error', 'Failed to accept offer. Please try again.');
              }
            } catch (error) {
              console.error('Error accepting offer:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleFinalizeDeal = () => {
    if (!deal) return;
    setShowScheduleModal(true);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      return [...prev, time];
    });
  };

  const handleSubmitSchedule = async () => {
    if (!deal || !user || actionLoading) return;

    setActionLoading('schedule');
    try {
      // Move to logistics phase
      const logisticsSuccess = await setLogistics(deal.id, { delivery_method: 'pickup' });
      if (!logisticsSuccess) {
        Alert.alert('Error', 'Failed to update deal. Please try again.');
        return;
      }

      // Reload deal
      const updatedDeal = await getDealById(dealId);
      setDeal(updatedDeal);

      // Fetch seller's profile info for scheduling coordination
      const sellerInfo = await getUserSchedulingInfo(deal.seller_id);

      // Compose schedule message
      let scheduleMsg = "Great! The deal is finalized. Let's schedule the pickup.\n\n";

      if (selectedTimes.length > 0) {
        scheduleMsg += `You're available: ${selectedTimes.join(', ')}.\n\n`;
      }

      // Add seller's location and payment info if this is the seller initiating scheduling
      if (isSelling && sellerInfo) {
        if (sellerInfo.dormLocation) {
          scheduleMsg += `📍 Suggested meetup location: ${sellerInfo.dormLocation}\n`;
        }
        if (sellerInfo.paymentPreference) {
          scheduleMsg += `💳 Accepted payment: ${sellerInfo.paymentPreference.split(',').join(', ')}\n`;
        }
        scheduleMsg += '\nPlease confirm if this location and payment method work for you.';
      } else if (!isSelling && sellerInfo) {
        // Buyer is scheduling - show seller's info to buyer
        if (sellerInfo.dormLocation) {
          scheduleMsg += `📍 Seller's suggested meetup: ${sellerInfo.dormLocation}\n`;
        }
        if (sellerInfo.paymentPreference) {
          scheduleMsg += `💳 Seller accepts: ${sellerInfo.paymentPreference.split(',').join(', ')}\n`;
        }
      }

      if (scheduleNote) {
        scheduleMsg += `\n\nNote: ${scheduleNote}`;
      }

      scheduleMsg += "\n\nWaiting for the other party to confirm.";

      // Add agent message about scheduling
      await sendAgentMessage(dealId, scheduleMsg);

      // If user selected times, send as message
      if (selectedTimes.length > 0) {
        await sendMessage(dealId, user.id, `I'm available: ${selectedTimes.join(', ')}`, 'text');
      }

      // Reload messages
      const updatedMessages = await getMessages(dealId);
      setMessages(updatedMessages);

      // Close modal and reset
      setShowScheduleModal(false);
      setSelectedTimes([]);
      setScheduleNote('');
    } catch (error) {
      console.error('Error submitting schedule:', error);
      Alert.alert('Error', 'Failed to submit schedule. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Suggested times for scheduling
  const suggestedTimes = [
    'Today, afternoon',
    'Today, evening',
    'Tomorrow morning',
    'Tomorrow afternoon',
    'This weekend',
    'Next week',
  ];

  const handleSchedulePickup = async (time: string, location: string) => {
    if (!deal) return;

    await setLogistics(deal.id, {
      delivery_method: 'pickup',
      pickup_location: location,
      pickup_date: time,
    });

    // Add agent message
    await sendAgentMessage(
      dealId,
      `Pickup scheduled for ${time} at ${location}. Both parties have been notified. See you then!`
    );

    // Reload
    const [updatedDeal, updatedMessages] = await Promise.all([
      getDealById(dealId),
      getMessages(dealId),
    ]);
    setDeal(updatedDeal);
    setMessages(updatedMessages);
  };

  const handleMarkComplete = async () => {
    if (!deal || !user || actionLoading) return;

    Alert.alert(
      'Mark as Complete',
      'Confirm that the item has been picked up?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setActionLoading('complete');
            try {
              const success = await completeDeal(deal.id, user.id);
              if (success) {
                // Reload
                const [updatedDeal, updatedMessages] = await Promise.all([
                  getDealById(dealId),
                  getMessages(dealId),
                ]);
                setDeal(updatedDeal);
                setMessages(updatedMessages);
              } else {
                Alert.alert('Error', 'Failed to complete deal. Please try again.');
              }
            } catch (error) {
              console.error('Error completing deal:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleMakeOffer = () => {
    if (actionLoading) return;

    Alert.prompt(
      'Make an Offer',
      'Enter your offer amount:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (amount) => {
            if (!amount || !user) return;
            const numAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
            if (numAmount <= 0) {
              Alert.alert('Invalid Amount', 'Please enter a valid offer amount.');
              return;
            }

            setActionLoading('offer');
            try {
              const success = await makeOffer(dealId, numAmount, user.id);
              if (success) {
                // Reload
                const [updatedDeal, updatedMessages] = await Promise.all([
                  getDealById(dealId),
                  getMessages(dealId),
                ]);
                setDeal(updatedDeal);
                setMessages(updatedMessages);
              } else {
                Alert.alert('Error', 'Failed to submit offer. Please try again.');
              }
            } catch (error) {
              console.error('Error making offer:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  // Render action bar based on deal status
  const renderActionBar = () => {
    if (!deal) return null;

    switch (deal.status) {
      case 'negotiating':
        if (deal.current_offer) {
          // Show accept button for the other party
          if (deal.last_offer_by !== user?.id) {
            return (
              <View style={styles.actionBar}>
                <View style={styles.actionInfo}>
                  <Text variant="bodyMedium" size="sm" color="purple">
                    Offer: ${deal.current_offer}
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    From {deal.last_offer_by === deal.buyer_id ? 'buyer' : 'seller'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.acceptBtn, actionLoading === 'accept' && styles.btnLoading]}
                  onPress={handleAcceptOffer}
                  disabled={actionLoading === 'accept'}
                >
                  {actionLoading === 'accept' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept ${deal.current_offer}</Text>
                  )}
                </Pressable>
              </View>
            );
          } else {
            // Waiting for response
            return (
              <View style={styles.actionBar}>
                <View style={styles.actionInfo}>
                  <Text variant="bodyMedium" size="sm" color="muted">
                    Your offer: ${deal.current_offer}
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    Waiting for {otherPartyLabel.toLowerCase()} to respond
                  </Text>
                </View>
              </View>
            );
          }
        } else {
          // No offer yet - show make offer button
          return (
            <View style={styles.actionBar}>
              <View style={styles.actionInfo}>
                <Text variant="body" size="sm" color="secondary">
                  No offer yet
                </Text>
              </View>
              <Pressable
                style={[styles.offerBtn, actionLoading === 'offer' && styles.btnLoading]}
                onPress={handleMakeOffer}
                disabled={actionLoading === 'offer'}
              >
                {actionLoading === 'offer' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.offerBtnText}>Make Offer</Text>
                )}
              </Pressable>
            </View>
          );
        }

      case 'agreed':
        return (
          <View style={styles.actionBar}>
            <View style={styles.actionInfo}>
              <Text variant="bodyMedium" size="sm" color="success">
                Agreed: ${deal.agreed_price}
              </Text>
              <Text variant="body" size="xs" color="secondary">
                Ready to finalize schedule
              </Text>
            </View>
            <Pressable
              style={[styles.finalizeBtn, actionLoading === 'schedule' && styles.btnLoading]}
              onPress={handleFinalizeDeal}
              disabled={actionLoading === 'schedule'}
            >
              {actionLoading === 'schedule' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.finalizeBtnText}>Finalize Schedule</Text>
              )}
            </Pressable>
          </View>
        );

      case 'logistics':
        return (
          <View style={styles.actionBar}>
            <View style={styles.actionInfo}>
              <Text variant="bodyMedium" size="sm" color="warning">
                {deal.pickup_date ? `Pickup: ${deal.pickup_date}` : 'Scheduling pickup...'}
              </Text>
              {deal.pickup_location && (
                <Text variant="body" size="xs" color="secondary">
                  at {deal.pickup_location}
                </Text>
              )}
            </View>
            <Pressable
              style={[styles.completeBtn, actionLoading === 'complete' && styles.btnLoading]}
              onPress={handleMarkComplete}
              disabled={actionLoading === 'complete'}
            >
              {actionLoading === 'complete' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.completeBtnText}>Mark Complete</Text>
              )}
            </Pressable>
          </View>
        );

      case 'completed':
        return (
          <View style={styles.completedBar}>
            <Text variant="bodyMedium" size="md" color="success">
              ✓ Deal completed!
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!deal) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">Deal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const itemTitle = deal.item?.title || 'Untitled Item';
  const itemCategory = deal.item?.category || 'Other';
  const emoji = getEmojiForCategory(itemCategory);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          {isAccepted ? (
            <View style={styles.headerInfo}>
              <Text variant="headingMedium" size="heading3" numberOfLines={1}>
                {counterpartyName}
              </Text>
              <Badge variant={isSelling ? 'warning' : 'purple'}>
                {isSelling ? 'Selling' : 'Buying'}
              </Badge>
            </View>
          ) : (
            <View style={styles.headerInfo}>
              <Text variant="headingMedium" size="heading3" numberOfLines={1}>
                Anonymous
              </Text>
              <Badge variant={isSelling ? 'warning' : 'purple'}>
                {isSelling ? 'Selling' : 'Buying'}
              </Badge>
            </View>
          )}
        </View>

        {/* Timestamp */}
        <View style={styles.timestampContainer}>
          <Text variant="body" size="xs" color="muted" style={styles.timestampText}>
            Started {new Date(deal.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Item Card */}
        <View style={styles.contextCard}>
          <View style={styles.contextThumb}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.contextImage} resizeMode="cover" />
            ) : (
              <Text style={styles.contextEmoji}>{emoji}</Text>
            )}
          </View>
          <View style={styles.contextInfo}>
            <Text variant="bodyMedium" size="md" numberOfLines={1}>
              {itemTitle}
            </Text>
            <Text variant="body" size="sm" color="secondary">
              {deal.agreed_price
                ? `Agreed: $${deal.agreed_price}`
                : deal.current_offer
                  ? `Current offer: $${deal.current_offer}`
                  : 'No offer yet'}
            </Text>
          </View>
          <Badge variant={getStatusBadgeVariant(deal.status)}>
            {getStatusLabel(deal.status)}
          </Badge>
        </View>

        {/* Messages - all messages are scrollable */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="body" size="md" color="secondary" style={styles.emptyText}>
                Start the conversation
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user?.id}
                isSelling={isSelling}
              />
            ))
          )}
        </ScrollView>

        {/* Action bar */}
        {renderActionBar()}

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
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowScheduleModal(false)} style={styles.modalCloseBtn}>
              <Text size="xl">✕</Text>
            </Pressable>
            <Text variant="headingMedium" size="lg" style={styles.modalTitle}>
              Schedule Pickup
            </Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Quick Time Selection */}
            <View style={styles.scheduleSection}>
              <Text variant="bodyMedium" size="md" style={styles.scheduleSectionTitle}>
                When are you available?
              </Text>
              <Text variant="body" size="sm" color="muted" style={styles.scheduleSectionDesc}>
                Select all times that work for you
              </Text>

              <View style={styles.timeOptionsGrid}>
                {suggestedTimes.map((time) => (
                  <Pressable
                    key={time}
                    style={[
                      styles.timeOption,
                      selectedTimes.includes(time) && styles.timeOptionSelected,
                    ]}
                    onPress={() => handleTimeSelect(time)}
                  >
                    <Text
                      variant="body"
                      size="sm"
                      style={selectedTimes.includes(time) ? styles.timeOptionTextSelected : undefined}
                    >
                      {time}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Additional Notes */}
            <View style={styles.scheduleSection}>
              <Text variant="bodyMedium" size="md" style={styles.scheduleSectionTitle}>
                Additional notes (optional)
              </Text>
              <TextInput
                style={styles.scheduleNoteInput}
                value={scheduleNote}
                onChangeText={setScheduleNote}
                placeholder="e.g., Meet at Science Center..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[
                styles.submitScheduleBtn,
                selectedTimes.length === 0 && styles.submitScheduleBtnDisabled,
              ]}
              onPress={handleSubmitSchedule}
              disabled={selectedTimes.length === 0}
            >
              <Text style={styles.submitScheduleBtnText}>
                Finalize Schedule
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isSelling: boolean;
}

function MessageBubble({ message, isOwn, isSelling }: MessageBubbleProps) {
  const isAgent = message.is_agent;
  const isOther = !isOwn && !isAgent;

  // Determine sender label for other party
  const otherLabel = isSelling ? 'Buyer' : 'Seller';

  return (
    <View
      style={[
        styles.messageRow,
        isOwn && styles.messageRowOwn,
      ]}
    >
      {!isOwn && (
        <View style={[styles.avatar, isAgent && styles.avatarAgent]}>
          <Text style={styles.avatarText}>{isAgent ? '🤖' : '👤'}</Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isOwn && styles.messageBubbleOwn,
          isAgent && styles.messageBubbleAgent,
          isOther && styles.messageBubbleOther,
        ]}
      >
        {!isOwn && (
          <Text variant="bodyMedium" size="xs" style={styles.senderName}>
            {isAgent ? 'Agent' : otherLabel}
          </Text>
        )}
        <RichPriceText
          text={message.content}
          references={message.metadata?.priceReferences}
          size="md"
          color={isOwn ? 'white' : 'primary'}
        />
        <Text
          variant="body"
          size="xs"
          style={[styles.messageTime, isOwn && styles.messageTimeOwn]}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timestampContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  timestampText: {
    textAlign: 'center',
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  contextThumb: {
    width: 40,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contextImage: {
    width: '100%',
    height: '100%',
  },
  contextEmoji: {
    fontSize: 18,
  },
  contextInfo: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  messageRowOwn: {
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
    marginRight: spacing.sm,
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
    maxWidth: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageBubbleOwn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  messageBubbleAgent: {
    backgroundColor: colors.purpleSoft,
    borderColor: colors.purpleSoft,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
  },
  senderName: {
    marginBottom: spacing.xs,
    opacity: 0.7,
  },
  messageTime: {
    marginTop: spacing.xs,
    opacity: 0.5,
    color: colors.textMuted,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  actionBar: {
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
  actionInfo: {
    flex: 1,
  },
  acceptBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  offerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  offerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  completeBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBar: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.success,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.body,
    color: colors.textPrimary,
    maxHeight: 100,
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
  btnLoading: {
    opacity: 0.7,
  },
  // Schedule Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  scheduleSection: {
    marginTop: spacing.xl,
  },
  scheduleSectionTitle: {
    marginBottom: spacing.xs,
  },
  scheduleSectionDesc: {
    marginBottom: spacing.md,
  },
  timeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  timeOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeOptionTextSelected: {
    color: '#FFFFFF',
  },
  scheduleNoteInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.body,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitScheduleBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitScheduleBtnDisabled: {
    opacity: 0.5,
  },
  submitScheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
