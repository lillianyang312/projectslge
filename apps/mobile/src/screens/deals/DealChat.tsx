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
import { getStatusBadgeVariant } from '../../lib/statusColorMap';
import {
  getDealById,
  getMessages,
  sendMessage,
  sendAgentMessage,
  acceptOffer,
  makeOffer,
  counterOffer,
  setLogistics,
  completeDeal,
  cancelPendingDeal,
  getUserSchedulingInfo,
  markDealAsRead,
} from '../../services/dealsService';
import { useAuthStore } from '../../state/authStore';
import { getSignedUrlCached } from '../../services/imageService';
import { supabase } from '../../lib/supabase';

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

function getStatusLabel(status: DealStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'negotiating': return 'Negotiating';
    case 'agreed': return 'Agreed';
    case 'logistics': return 'Scheduling';
    case 'completed': return 'Complete';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function formatLastSeen(lastSeenAt?: string): string {
  if (!lastSeenAt) return 'Unknown';

  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Online now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return lastSeen.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [hasRated, setHasRated] = useState(false);
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
        markDealAsRead(dealId, user.id).catch(() => {
          // Silently handle - columns may not exist yet
        });
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
      // If already in logistics, this is just updating availability - don't reset logistics
      if (deal.status !== 'logistics') {
        // Move to logistics phase
        const logisticsSuccess = await setLogistics(deal.id, { delivery_method: 'pickup' });
        if (!logisticsSuccess) {
          Alert.alert('Error', 'Failed to update deal. Please try again.');
          return;
        }
      }

      // Reload deal
      const updatedDeal = await getDealById(dealId);
      setDeal(updatedDeal);

      // Fetch seller's profile info for scheduling coordination
      const sellerInfo = await getUserSchedulingInfo(deal.seller_id);

      // Compose schedule message
      let scheduleMsg = deal.status === 'logistics'
        ? "Updated availability:\n\n"
        : "Great! The deal is finalized. Let's schedule the pickup.\n\n";

      if (selectedTimes.length > 0) {
        scheduleMsg += `You're available: ${selectedTimes.join(', ')}.\n\n`;
      }

      // Add seller's location and payment info if this is the seller initiating scheduling
      if (isSelling && sellerInfo) {
        if (sellerInfo.dormLocation) {
          scheduleMsg += `📍 Location: ${sellerInfo.dormLocation}\n`;
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

  // Accept the proposed time and finalize the schedule
  const handleAcceptProposedTime = async () => {
    if (!deal || !user || actionLoading) return;

    setActionLoading('schedule');
    try {
      // Set pickup_date to mark schedule as finalized (use ISO format for TIMESTAMPTZ)
      const pickupDate = new Date().toISOString();

      const logisticsSuccess = await setLogistics(deal.id, {
        delivery_method: 'pickup',
        pickup_date: pickupDate,
      });

      if (!logisticsSuccess) {
        Alert.alert('Error', 'Failed to confirm schedule. Please try again.');
        return;
      }

      // Send confirmation message
      await sendMessage(dealId, user.id, 'Schedule confirmed! See you then.', 'text');
      await sendAgentMessage(dealId, `✅ Schedule confirmed! Both parties have agreed on the time. Good luck with the exchange!`);

      // Reload deal and messages
      const [updatedDeal, updatedMessages] = await Promise.all([
        getDealById(dealId),
        getMessages(dealId),
      ]);
      setDeal(updatedDeal);
      setMessages(updatedMessages);

      // Close modal and reset
      setShowScheduleModal(false);
      setSelectedTimes([]);
      setScheduleNote('');
    } catch (error) {
      console.error('Error accepting proposed time:', error);
      Alert.alert('Error', 'Failed to confirm schedule. Please try again.');
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

  // Handle rating submission
  const handleSubmitRating = async () => {
    if (!user || !deal || selectedRating === 0) return;

    setActionLoading('rating');
    try {
      const ratedUserId = isSelling ? deal.buyer_id : deal.seller_id;

      const { error } = await supabase
        .from('user_ratings')
        .insert({
          deal_id: deal.id,
          rater_id: user.id,
          rated_user_id: ratedUserId,
          rating: selectedRating,
          comment: ratingComment.trim() || null,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint
          Alert.alert('Already Rated', 'You have already rated this transaction.');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Thank You!', 'Your rating has been submitted.');
        setHasRated(true);
      }

      setShowRatingModal(false);
      setSelectedRating(0);
      setRatingComment('');
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

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

  const handleCancelDeal = async () => {
    if (!deal || !user || actionLoading) return;

    Alert.alert(
      'Cancel Deal',
      'Are you sure you want to cancel this deal? Other interested buyers will be notified that the item is available again.',
      [
        { text: 'Keep Deal', style: 'cancel' },
        {
          text: 'Cancel Deal',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('cancel');
            try {
              const success = await cancelPendingDeal(deal.id, user.id, 'Deal cancelled by user');
              if (success) {
                Alert.alert('Deal Cancelled', 'Other active bidders have been notified.');
                // Navigate back or reload
                const [updatedDeal, updatedMessages] = await Promise.all([
                  getDealById(dealId),
                  getMessages(dealId),
                ]);
                setDeal(updatedDeal);
                setMessages(updatedMessages);
              } else {
                Alert.alert('Error', 'Failed to cancel deal. Please try again.');
              }
            } catch (error) {
              console.error('Error cancelling deal:', error);
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

    // Determine if this is a counter-offer (seller responding to buyer's offer)
    const isCounterOffer = isSelling && deal?.current_offer && deal?.last_offer_by === deal?.buyer_id;

    Alert.prompt(
      isCounterOffer ? 'Counter Offer' : 'Make an Offer',
      isCounterOffer
        ? `Current offer is $${deal?.current_offer}. Enter your counter-offer:`
        : 'Enter your offer amount:',
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
              // Use counterOffer for seller counter-offers, makeOffer otherwise
              const success = isCounterOffer
                ? await counterOffer(dealId, numAmount, user.id)
                : await makeOffer(dealId, numAmount, user.id);

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
      case 'pending':
        if (isSelling) {
          // Seller: can reply to start negotiation or accept offer if there is one
          if (deal.current_offer) {
            // There's an offer from buyer - seller can accept or counter
            return (
              <View style={styles.actionBar}>
                <View style={styles.actionInfo}>
                  <Text variant="bodyMedium" size="sm" color="warning">
                    Offer: ${deal.current_offer}
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    From buyer
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <Pressable
                    style={[styles.counterBtn, actionLoading === 'offer' && styles.btnLoading]}
                    onPress={handleMakeOffer}
                    disabled={actionLoading === 'offer'}
                  >
                    <Text style={styles.counterBtnText}>Counter</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.acceptBtn, actionLoading === 'accept' && styles.btnLoading]}
                    onPress={handleAcceptOffer}
                    disabled={actionLoading === 'accept'}
                  >
                    {actionLoading === 'accept' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          } else {
            // No offer yet - seller can reply to start conversation
            return (
              <View style={styles.actionBar}>
                <View style={styles.actionInfo}>
                  <Text variant="body" size="sm" color="secondary">
                    Buyer expressed interest
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    Reply to start negotiation
                  </Text>
                </View>
              </View>
            );
          }
        } else {
          // Buyer: waiting for seller response
          return (
            <View style={styles.actionBar}>
              <View style={styles.actionInfo}>
                <Text variant="bodyMedium" size="sm" color="muted">
                  {deal.current_offer ? `Your offer: $${deal.current_offer}` : 'Interest expressed'}
                </Text>
                <Text variant="body" size="xs" color="secondary">
                  Waiting for seller to respond
                </Text>
              </View>
            </View>
          );
        }

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
                <View style={styles.actionButtons}>
                  <Pressable
                    style={[styles.counterBtn, actionLoading === 'offer' && styles.btnLoading]}
                    onPress={handleMakeOffer}
                    disabled={actionLoading === 'offer'}
                  >
                    <Text style={styles.counterBtnText}>Counter</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.acceptBtn, actionLoading === 'accept' && styles.btnLoading]}
                    onPress={handleAcceptOffer}
                    disabled={actionLoading === 'accept'}
                  >
                    {actionLoading === 'accept' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    )}
                  </Pressable>
                </View>
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
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.cancelDealBtn, actionLoading === 'cancel' && styles.btnLoading]}
                onPress={handleCancelDeal}
                disabled={actionLoading === 'cancel'}
              >
                <Text style={styles.cancelDealBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.finalizeBtn, actionLoading === 'schedule' && styles.btnLoading]}
                onPress={handleFinalizeDeal}
                disabled={actionLoading === 'schedule'}
              >
                {actionLoading === 'schedule' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.finalizeBtnText}>Schedule</Text>
                )}
              </Pressable>
            </View>
          </View>
        );

      case 'logistics':
        // Schedule is finalized when pickup_date is set
        const isScheduleFinalized = !!deal.pickup_date;
        return (
          <View style={styles.actionBar}>
            <View style={styles.actionInfo}>
              <Text variant="bodyMedium" size="sm" color="warning">
                {isScheduleFinalized ? 'Scheduled' : 'Scheduling...'}
              </Text>
              {deal.pickup_location && (
                <Text variant="body" size="xs" color="secondary">
                  at {deal.pickup_location}
                </Text>
              )}
            </View>
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.cancelDealBtn, actionLoading === 'cancel' && styles.btnLoading]}
                onPress={handleCancelDeal}
                disabled={actionLoading === 'cancel'}
              >
                <Text style={styles.cancelDealBtnText}>Cancel</Text>
              </Pressable>
              {/* Show Finalize button only when not yet finalized */}
              {!isScheduleFinalized && (
                <Pressable
                  style={[styles.finalizeBtn, actionLoading === 'schedule' && styles.btnLoading]}
                  onPress={handleFinalizeDeal}
                  disabled={actionLoading === 'schedule'}
                >
                  {actionLoading === 'schedule' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.finalizeBtnText}>Finalize</Text>
                  )}
                </Pressable>
              )}
              {/* Show Complete button only after schedule is finalized */}
              {isScheduleFinalized && (
                <Pressable
                  style={[styles.completeBtn, actionLoading === 'complete' && styles.btnLoading]}
                  onPress={handleMarkComplete}
                  disabled={actionLoading === 'complete'}
                >
                  {actionLoading === 'complete' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.completeBtnText}>Complete</Text>
                  )}
                </Pressable>
              )}
            </View>
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
          <View style={styles.headerInfo}>
            <Text variant="headingMedium" size="heading3" numberOfLines={1} style={styles.headerName}>
              {counterpartyName}
            </Text>
            <Text variant="bodyMedium" size="sm" color={isSelling ? 'warning' : 'purple'}>
              {isSelling ? 'You are selling' : 'You are buying'}
            </Text>
            <Text variant="body" size="xs" color="muted">
              {/* Use first name if available, otherwise generic label */}
              {isAccepted && counterpartyName !== 'Buyer' && counterpartyName !== 'Seller'
                ? counterpartyName.split(' ')[0]
                : otherPartyLabel} last seen {formatLastSeen(
                isSelling ? deal?.buyer?.last_seen_at : deal?.seller?.last_seen_at
              )}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            {/* Show Rate button in logistics/completed states if not yet rated */}
            {!hasRated && deal && ['logistics', 'completed'].includes(deal.status) && (
              <Pressable onPress={() => setShowRatingModal(true)} style={styles.viewRateBtn}>
                <Text variant="body" size="sm" color="warning">Rate</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setShowProfileModal(true)} style={styles.viewProfileBtn}>
              <Text variant="body" size="sm" color="accent">Profile</Text>
            </Pressable>
          </View>
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
          {/* Conversation start timestamp at top of chat */}
          <View style={styles.chatTimestamp}>
            <Text variant="body" size="xs" color="muted">
              Started {new Date(deal.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>

          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="body" size="md" color="secondary" style={styles.emptyText}>
                Start the conversation
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              // Get first name when deanonymized (deal accepted)
              const counterpartyFirstName = isAccepted && counterpartyName !== 'Buyer' && counterpartyName !== 'Seller'
                ? counterpartyName.split(' ')[0]
                : undefined;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  isSelling={isSelling}
                  counterpartyFirstName={counterpartyFirstName}
                />
              );
            })
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

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowProfileModal(false)} style={styles.modalCloseBtn}>
              <Text size="xl">✕</Text>
            </Pressable>
            <Text variant="headingMedium" size="lg" style={styles.modalTitle}>
              {otherPartyLabel} Profile
            </Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView style={styles.modalContent}>
            {(() => {
              const otherParty = isSelling ? deal?.buyer : deal?.seller;
              return (
                <>
                  {/* Name & Last Seen */}
                  <View style={styles.profileHeader}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>
                        {(otherParty?.display_name || otherPartyLabel)[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text variant="headingMedium" size="xl" style={styles.profileName}>
                      {otherParty?.display_name || otherPartyLabel}
                    </Text>
                    <Text variant="body" size="sm" color="muted">
                      Last seen {formatLastSeen(otherParty?.last_seen_at)}
                    </Text>
                  </View>

                  {/* Stats */}
                  <View style={styles.profileStats}>
                    <View style={styles.profileStat}>
                      <Text variant="headingMedium" size="xl">
                        {otherParty?.rating ? `${otherParty.rating.toFixed(1)}` : '—'}
                      </Text>
                      <Text variant="body" size="xs" color="muted">
                        Rating ({otherParty?.rating_count || 0} reviews)
                      </Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStat}>
                      <Text variant="headingMedium" size="xl">
                        {otherParty?.sales_completed || 0}
                      </Text>
                      <Text variant="body" size="xs" color="muted">Sales</Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStat}>
                      <Text variant="headingMedium" size="xl">
                        {otherParty?.purchases_completed || 0}
                      </Text>
                      <Text variant="body" size="xs" color="muted">Purchases</Text>
                    </View>
                  </View>

                  {/* Profile details with progressive disclosure based on deal stage */}
                  {(() => {
                    // Schedule is finalized when in logistics with pickup_date, or completed
                    const isScheduleFinalized = deal && (
                      (deal.status === 'logistics' && deal.pickup_date) ||
                      deal.status === 'completed'
                    );

                    if (!isAccepted) {
                      // Not yet accepted - show nothing
                      return (
                        <View style={styles.profileDetails}>
                          <Text variant="body" size="sm" color="muted" style={styles.profileDetailsNote}>
                            Profile details will be available after the offer is accepted.
                          </Text>
                        </View>
                      );
                    }

                    // Deal is accepted - show graduation year always
                    // Show location info only after schedule is finalized
                    return (
                      <View style={styles.profileDetails}>
                        <Text variant="bodyMedium" size="sm" color="accent" style={styles.profileDetailsLabel}>
                          Harvard Details
                        </Text>
                        {otherParty?.graduation_year && (
                          <View style={styles.profileDetailRow}>
                            <Text variant="body" size="sm" color="muted">Class of</Text>
                            <Text variant="bodyMedium" size="sm">{otherParty.graduation_year}</Text>
                          </View>
                        )}
                        {otherParty?.neighborhood && (
                          <View style={styles.profileDetailRow}>
                            <Text variant="body" size="sm" color="muted">House</Text>
                            <Text variant="bodyMedium" size="sm">{otherParty.neighborhood}</Text>
                          </View>
                        )}

                        {/* Location details only shown after schedule is finalized */}
                        {isScheduleFinalized ? (
                          <>
                            {otherParty?.dorm_location && (
                              <View style={styles.profileDetailRow}>
                                <Text variant="body" size="sm" color="muted">Dorm</Text>
                                <Text variant="bodyMedium" size="sm">{otherParty.dorm_location}</Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <View style={styles.profileDetailRow}>
                            <Text variant="body" size="xs" color="muted" style={styles.profileDetailsNote}>
                              Location details visible after schedule is finalized
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowRatingModal(false)} style={styles.modalCloseBtn}>
              <Text size="xl">✕</Text>
            </Pressable>
            <Text variant="headingMedium" size="lg" style={styles.modalTitle}>
              Rate {otherPartyLabel}
            </Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.ratingSection}>
              <Text variant="body" size="md" color="secondary" style={styles.ratingSectionLabel}>
                How was your experience with {isSelling ? deal?.buyer?.display_name : deal?.seller?.display_name}?
              </Text>

              {/* Star Rating */}
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setSelectedRating(star)}
                    style={styles.starBtn}
                  >
                    <Text style={[styles.starText, selectedRating >= star && styles.starTextActive]}>
                      {selectedRating >= star ? '★' : '☆'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Comment */}
              <TextInput
                style={styles.ratingCommentInput}
                placeholder="Add a comment (optional)"
                placeholderTextColor={colors.textMuted}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[
                styles.submitRatingBtn,
                selectedRating === 0 && styles.submitRatingBtnDisabled,
              ]}
              onPress={handleSubmitRating}
              disabled={selectedRating === 0 || actionLoading === 'rating'}
            >
              {actionLoading === 'rating' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitRatingBtnText}>
                  Submit Rating
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

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
              {deal?.status === 'logistics' ? 'Confirm Schedule' : 'Schedule Pickup'}
            </Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Accept Proposed Time - shown when in logistics (someone already proposed) */}
            {deal?.status === 'logistics' && (
              <View style={styles.scheduleSection}>
                <Text variant="bodyMedium" size="md" style={styles.scheduleSectionTitle}>
                  Accept proposed time?
                </Text>
                <Text variant="body" size="sm" color="muted" style={styles.scheduleSectionDesc}>
                  If the other party proposed a time in the chat that works for you
                </Text>
                <Pressable
                  style={[styles.acceptTimeBtn, actionLoading === 'schedule' && styles.btnLoading]}
                  onPress={handleAcceptProposedTime}
                  disabled={actionLoading === 'schedule'}
                >
                  {actionLoading === 'schedule' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptTimeBtnText}>Accept & Confirm Schedule</Text>
                  )}
                </Pressable>

                <View style={styles.scheduleDivider}>
                  <View style={styles.scheduleDividerLine} />
                  <Text variant="body" size="sm" color="muted" style={styles.scheduleDividerText}>
                    or propose your own times
                  </Text>
                  <View style={styles.scheduleDividerLine} />
                </View>
              </View>
            )}

            {/* Quick Time Selection */}
            <View style={styles.scheduleSection}>
              <Text variant="bodyMedium" size="md" style={styles.scheduleSectionTitle}>
                When are you available?
              </Text>
              <Text variant="body" size="sm" color="muted" style={styles.scheduleSectionDesc}>
                Select times that work for you (optional)
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
                (selectedTimes.length === 0 && !scheduleNote.trim()) && styles.submitScheduleBtnDisabled,
              ]}
              onPress={handleSubmitSchedule}
              disabled={(selectedTimes.length === 0 && !scheduleNote.trim()) || actionLoading === 'schedule'}
            >
              <Text style={styles.submitScheduleBtnText}>
                {deal?.status === 'logistics' ? 'Send Availability' : 'Start Scheduling'}
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
  counterpartyFirstName?: string; // First name when deanonymized
}

function MessageBubble({ message, isOwn, isSelling, counterpartyFirstName }: MessageBubbleProps) {
  const isAgent = message.is_agent;
  const isOther = !isOwn && !isAgent;

  // Determine sender label - use first name if deanonymized, otherwise generic label
  const otherLabel = counterpartyFirstName || (isSelling ? 'Buyer' : 'Seller');

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
  },
  headerName: {},
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewRateBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
  },
  viewProfileBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  chatTimestamp: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
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
  counterBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  counterBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelDealBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error || '#FF6B6B',
  },
  cancelDealBtnText: {
    color: colors.error || '#FF6B6B',
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
  acceptTimeBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  acceptTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  scheduleDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  scheduleDividerText: {
    paddingHorizontal: spacing.md,
  },
  // Profile Modal styles
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.accent,
  },
  profileName: {
    marginBottom: spacing.xs,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.lg,
  },
  profileStat: {
    flex: 1,
    alignItems: 'center',
  },
  profileStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  profileDetails: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  profileDetailsLabel: {
    marginBottom: spacing.md,
  },
  profileDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  profileDetailsNote: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Rating Modal styles
  ratingSection: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  ratingSectionLabel: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  starBtn: {
    padding: spacing.sm,
  },
  starText: {
    fontSize: 36,
    color: colors.border,
  },
  starTextActive: {
    color: colors.warning,
  },
  ratingCommentInput: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.body,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitRatingBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingBtnDisabled: {
    opacity: 0.5,
  },
  submitRatingBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Action bar button styles
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateBtnSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
  },
  rateBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
  },
});
