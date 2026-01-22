import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Text, Card, Badge, Button } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { Deal } from '../../types/models';
import { AppTabsParamList, DealsStackParamList } from '../../navigation/types';
import {
  ItemQuestion,
  getQuestionsForItem,
  getDealsWithExpiration,
  replyToQuestion,
  acceptOffer,
  cancelDeal,
} from '../../services/dealsService';
import { updateItem } from '../../services/itemsService';
import { getSignedUrl } from '../../services/imageService';
import {
  evaluateOffer,
  getExpirationText,
  getLastActiveText,
  getBestOffer,
  countInterestedBuyers,
} from '../../utils/pricingUtils';
import { SellIntent } from '../../state/itemsStore';
import { Item } from '../../services/itemsService';
import { useFocusEffect } from '@react-navigation/native';
import { useChatLLM } from '../../hooks/useChatLLM';
import { formatMessageTime, generateMessageId, type ChatMessage } from '../../services/chatService';

type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

interface SellerDashboardProps {
  item: Item;
  deals: Deal[];
  questions: ItemQuestion[];
  onRefresh: () => void;
  onViewDeal: (dealId: string) => void;
  onAcceptOffer: (dealId: string) => void;
  sellIntent: SellIntent;
}

// Agent action types
interface AgentAction {
  type: 'update_min_price' | 'accept_offer' | 'update_description';
  value?: string | number;
  dealId?: string;
}

export default function SellerDashboard({
  item,
  deals,
  questions,
  onRefresh,
  onViewDeal,
  onAcceptOffer,
  sellIntent,
}: SellerDashboardProps) {
  const tabNavigation = useNavigation<TabNavProp>();

  // Check for pending deal (accepted but not yet completed)
  const pendingDeal = deals.find(d => ['agreed', 'logistics'].includes(d.status));
  const hasPendingDeal = !!pendingDeal;

  console.log('📦 [SellerDashboard] Total deals:', deals.length, 'Pending deal:', hasPendingDeal);

  // When there's a pending deal, collapse offers/questions by default (they become "history")
  const [offersExpanded, setOffersExpanded] = useState(!hasPendingDeal);
  const [questionsExpanded, setQuestionsExpanded] = useState(!hasPendingDeal);
  const [showHistory, setShowHistory] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [pendingDealImageUrl, setPendingDealImageUrl] = useState<string | null>(null);

  // Load pending deal image
  useEffect(() => {
    async function loadPendingDealImage() {
      if (pendingDeal?.item?.photos?.[0]) {
        const url = await getSignedUrl(pendingDeal.item.photos[0]);
        setPendingDealImageUrl(url);
      }
    }
    if (pendingDeal) {
      loadPendingDealImage();
    }
  }, [pendingDeal?.id]);

  // Agent chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  // Create a seller-specific system prompt
  const sellerSystemPrompt = `You are a helpful selling assistant for a marketplace app. The user is a seller managing their item listing.

Current item details:
- Title: ${item.title}
- Category: ${item.category}
- Min price: ${item.min_price ? `$${item.min_price}` : 'Not set'}
- Estimated value: $${item.estimated_value_min || 0} - $${item.estimated_value_max || 100}
- Current offers: ${deals.filter(d => d.current_offer).length}
- Top offer: ${getBestOffer(deals) ? `$${getBestOffer(deals)}` : 'None'}
- Interested buyers: ${countInterestedBuyers(deals)}

Help the seller manage their listing. When they ask to:
1. "Sell this week" or express urgency - Recommend lowering the minimum price and respond with a suggested new price
2. "Raise minimum to $X" - Confirm the new minimum price they want
3. "Update description" - Ask what they want to change
4. "Accept highest offer" - Recommend accepting the current top offer

Be concise and helpful. Focus on actionable recommendations. If you suggest an action, clearly state what the action is so the user can confirm.`;

  const { isLoading: chatLoading, sendMessage: sendChatMessage, agentResponse } = useChatLLM(
    chatMessages,
    {
      context: { itemId: item.id },
      autoSend: true,
      systemPrompt: sellerSystemPrompt,
    }
  );

  // Add agent response to messages when it arrives
  useEffect(() => {
    if (agentResponse) {
      const exists = chatMessages.some((msg) => msg.id === agentResponse.id);
      if (!exists) {
        setChatMessages((prev) => [...prev, agentResponse]);
        // Check for action suggestions in the response
        parseAgentAction(agentResponse.text);
      }
    }
  }, [agentResponse, chatMessages]);

  // Parse agent response for actionable suggestions
  const parseAgentAction = (text: string) => {
    const lowerText = text.toLowerCase();

    // Look for price suggestion patterns
    const priceMatch = text.match(/\$(\d+)/);

    if (lowerText.includes('minimum price') && lowerText.includes('$') && priceMatch) {
      setPendingAction({
        type: 'update_min_price',
        value: parseInt(priceMatch[1], 10),
      });
    } else if (lowerText.includes('accept') && lowerText.includes('offer') && getBestOffer(deals)) {
      const bestDeal = deals.find(d => d.current_offer === getBestOffer(deals));
      if (bestDeal) {
        setPendingAction({
          type: 'accept_offer',
          dealId: bestDeal.id,
          value: bestDeal.current_offer,
        });
      }
    }
  };

  // Execute pending action
  const handleExecuteAction = async () => {
    if (!pendingAction) return;

    setExecutingAction(true);
    try {
      if (pendingAction.type === 'update_min_price' && typeof pendingAction.value === 'number') {
        await updateItem(item.id, { min_price: pendingAction.value });
        Alert.alert('Success', `Minimum price updated to $${pendingAction.value}`);
        onRefresh();
      } else if (pendingAction.type === 'accept_offer' && pendingAction.dealId) {
        onAcceptOffer(pendingAction.dealId);
      }
      setPendingAction(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to execute action');
    } finally {
      setExecutingAction(false);
    }
  };

  // Handle sending chat message
  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      sender: 'user',
      text,
      time: formatMessageTime(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setPendingAction(null);
    Keyboard.dismiss();

    // Scroll to bottom
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Send to LLM
    await sendChatMessage(text, userMessage.id, [...chatMessages, userMessage]);
  };

  // Handle quick action
  const handleQuickAction = (action: string) => {
    setChatInput(action);
  };

  // Filter active offers (non-question deals with offers that are still negotiating)
  const activeOffers = deals.filter(
    (d) => d.current_offer && !d.is_question && d.status === 'negotiating'
  );

  // All offers for history (includes declined, cancelled etc - excludes the pending deal)
  const allPreviousOffers = deals.filter(
    (d) => d.current_offer && !d.is_question && d.id !== pendingDeal?.id
  );

  // Unanswered questions
  const unansweredQuestions = questions.filter((q) => !q.isAnswered);

  // Show history toggle when there's a pending deal and there are previous offers/questions
  const hasHistoryContent = allPreviousOffers.length > 0 || questions.length > 0;

  console.log('📦 [SellerDashboard] Active offers:', activeOffers.length, 'All previous offers:', allPreviousOffers.length, 'Questions:', questions.length, 'Show history toggle:', hasPendingDeal && hasHistoryContent);

  const topOffer = getBestOffer(activeOffers);
  const buyerCount = countInterestedBuyers(deals);

  const handleReplySubmit = async (questionId: string) => {
    if (!replyText.trim()) return;

    setSubmittingReply(true);
    try {
      await replyToQuestion(questionId, item.owner_id, replyText.trim());
      setReplyText('');
      setReplyingTo(null);
      onRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleAcceptOffer = async (dealId: string, offerAmount: number) => {
    Alert.alert(
      'Accept Offer',
      `Are you sure you want to accept $${offerAmount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => onAcceptOffer(dealId),
        },
      ]
    );
  };

  const handleDeclineOffer = async (dealId: string, offerAmount: number) => {
    Alert.alert(
      'Decline Offer',
      `Are you sure you want to decline the $${offerAmount} offer?`,
      [
        { text: 'Keep Offer', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelDeal(dealId, item.owner_id);
              Alert.alert('Done', 'Offer declined');
              onRefresh();
            } catch (error) {
              Alert.alert('Error', 'Failed to decline offer');
            }
          },
        },
      ]
    );
  };

  const handleNavigateToDeal = (dealId: string) => {
    // Navigate to the Deals tab and then to DealChat
    tabNavigation.navigate('Deals', {
      screen: 'DealChat',
      params: { dealId },
    } as any);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agreed': return 'Agreed';
      case 'logistics': return 'Scheduling';
      case 'completed': return 'Complete';
      default: return status;
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'purple' | 'neutral' => {
    switch (status) {
      case 'agreed': return 'success';
      case 'logistics': return 'warning';
      case 'completed': return 'success';
      default: return 'neutral';
    }
  };

  const renderPendingDealCard = () => {
    if (!pendingDeal) return null;

    console.log('📦 [SellerDashboard] Pending deal:', pendingDeal.id, 'status:', pendingDeal.status);
    console.log('📦 [SellerDashboard] Pending deal buyer:', pendingDeal.buyer);
    const buyerName = pendingDeal.buyer?.display_name || 'Buyer';
    console.log('📦 [SellerDashboard] Display name:', buyerName);
    const agreedPrice = pendingDeal.agreed_price || pendingDeal.current_offer;

    return (
      <Pressable onPress={() => handleNavigateToDeal(pendingDeal.id)}>
        <Card style={styles.pendingDealCard}>
          <View style={styles.pendingDealHeader}>
            <View style={styles.pendingDealThumb}>
              {pendingDealImageUrl ? (
                <Image
                  source={{ uri: pendingDealImageUrl }}
                  style={styles.pendingDealImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.pendingDealEmoji}>📦</Text>
              )}
            </View>
            <View style={styles.pendingDealInfo}>
              <Text variant="bodyMedium" size="md" numberOfLines={1}>
                Selling to {buyerName}
              </Text>
              <Text variant="body" size="sm" color="success">
                ${agreedPrice}
              </Text>
            </View>
            <Badge variant={getStatusBadgeVariant(pendingDeal.status)}>
              {getStatusLabel(pendingDeal.status)}
            </Badge>
          </View>
          <View style={styles.pendingDealAction}>
            <Text variant="body" size="sm" color="accent">
              {pendingDeal.status === 'agreed'
                ? 'Tap to finalize pickup schedule →'
                : 'Tap to view pickup details →'}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderOfferCard = (deal: Deal) => {
    const recommendation = evaluateOffer(
      deal.current_offer || 0,
      item.min_price,
      item.estimated_value_min || 0,
      item.estimated_value_max || 100,
      sellIntent
    );
    const expirationText = getExpirationText(deal.expires_at);
    const lastActiveText = getLastActiveText(deal.updated_at);
    const buyerName = deal.buyer?.display_name || 'Buyer';
    const interestedForText = deal.interested_for;

    // Find questions from this buyer
    const buyerQuestions = questions.filter(q => q.buyerId === deal.buyer_id);

    return (
      <Card key={deal.id} style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <View style={styles.offerInfo}>
            <Text variant="headingMedium" size="lg" style={styles.offerAmount}>
              ${deal.current_offer}
            </Text>
            <Text variant="body" size="sm" color="secondary">
              from {buyerName}
            </Text>
          </View>
          <Badge variant={recommendation.badgeVariant} text={recommendation.reason} />
        </View>

        <View style={styles.offerMeta}>
          {interestedForText && (
            <Text variant="body" size="xs" color="accent">
              Interested for {interestedForText}
            </Text>
          )}
          {expirationText && (
            <Text variant="body" size="xs" color="muted">
              {expirationText}
            </Text>
          )}
          <Text variant="body" size="xs" color="muted">
            {lastActiveText}
          </Text>
        </View>

        {/* Buyer's Questions - aggregated under their offer */}
        {buyerQuestions.length > 0 && (
          <View style={styles.buyerQuestionsContainer}>
            <Text variant="body" size="xs" color="muted" style={styles.buyerQuestionsLabel}>
              Questions from this buyer:
            </Text>
            {buyerQuestions.map((q) => (
              <View key={q.id} style={styles.buyerQuestionItem}>
                <Text variant="body" size="sm" style={styles.buyerQuestionText}>
                  "{q.questionText}"
                </Text>
                {q.isAnswered ? (
                  <Pressable onPress={() => handleNavigateToDeal(q.dealId)}>
                    <Text variant="body" size="xs" color="success">
                      ✓ View →
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => handleNavigateToDeal(q.dealId)}>
                    <Text variant="body" size="xs" color="accent">
                      Reply →
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.offerActions}>
          <Pressable
            style={styles.viewDetailsBtn}
            onPress={() => handleNavigateToDeal(deal.id)}
          >
            <Text variant="bodyMedium" size="sm" color="primary">
              Chat
            </Text>
          </Pressable>
          <Pressable
            style={styles.declineBtn}
            onPress={() => handleDeclineOffer(deal.id, deal.current_offer || 0)}
          >
            <Text variant="bodyMedium" size="sm" color="danger">
              Decline
            </Text>
          </Pressable>
          <Pressable
            style={[styles.acceptBtn, !recommendation.isRecommended && styles.acceptBtnSecondary]}
            onPress={() => handleAcceptOffer(deal.id, deal.current_offer || 0)}
          >
            <Text variant="bodyMedium" size="sm" style={recommendation.isRecommended ? styles.acceptBtnText : styles.acceptBtnTextSecondary}>
              Accept
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderQuestionCard = (question: ItemQuestion) => {
    const isReplying = replyingTo === question.id;

    return (
      <Card key={question.id} style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text variant="body" size="sm" color="muted">
            {question.buyerName} asked:
          </Text>
          {question.isAnswered && (
            <Badge variant="success" text="Answered" />
          )}
        </View>

        <Text variant="bodyMedium" size="md" style={styles.questionText}>
          "{question.questionText}"
        </Text>

        {question.replies.length > 0 && (
          <View style={styles.replyContainer}>
            <Text variant="body" size="xs" color="muted">
              Your reply:
            </Text>
            <Text variant="body" size="sm" style={styles.replyText}>
              {question.replies[0].content}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.questionActions}>
          {!question.isAnswered && (
            <>
              {isReplying ? (
                <View style={styles.replyInputContainer}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply..."
                    placeholderTextColor={colors.textMuted}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <View style={styles.replyActions}>
                    <Pressable
                      style={styles.cancelReplyBtn}
                      onPress={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                    >
                      <Text variant="body" size="sm" color="secondary">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.sendReplyBtn}
                      onPress={() => handleReplySubmit(question.id)}
                      disabled={submittingReply || !replyText.trim()}
                    >
                      {submittingReply ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text variant="bodyMedium" size="sm" style={styles.sendBtnText}>
                          Send
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.questionActionRow}>
                  <Pressable
                    style={styles.replyBtn}
                    onPress={() => setReplyingTo(question.id)}
                  >
                    <Text variant="bodyMedium" size="sm" color="primary">
                      Quick Reply
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.chatBtn}
                    onPress={() => handleNavigateToDeal(question.dealId)}
                  >
                    <Text variant="bodyMedium" size="sm" color="accent">
                      Open Chat →
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          {question.isAnswered && (
            <Pressable
              style={styles.viewChatBtn}
              onPress={() => handleNavigateToDeal(question.dealId)}
            >
              <Text variant="bodyMedium" size="sm" color="accent">
                View Full Chat →
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Pending Deal Card - shown at top when deal is accepted */}
      {hasPendingDeal && renderPendingDealCard()}

      {/* Summary Header - only show when no pending deal */}
      {!hasPendingDeal && (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="body" size="sm" color="muted">
                Top Offer
              </Text>
              <Text variant="headingMedium" size="xl" color={topOffer ? 'primary' : 'secondary'}>
                {topOffer ? `$${topOffer}` : 'No offers'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text variant="body" size="sm" color="muted">
                Interested Buyers
              </Text>
              <Text variant="headingMedium" size="xl">
                {buyerCount}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* History Toggle - shown when deal is pending and there are previous offers/questions */}
      {hasPendingDeal && hasHistoryContent && (
        <Pressable
          style={styles.historyToggle}
          onPress={() => setShowHistory(!showHistory)}
        >
          <Text variant="body" size="sm" color="accent">
            {showHistory ? 'Hide' : 'Show'} negotiation history ({allPreviousOffers.length} offers, {questions.length} questions)
          </Text>
          <Text style={styles.historyIcon}>{showHistory ? '▲' : '▼'}</Text>
        </Pressable>
      )}

      {/* Offers Section - collapsed into history when pending deal exists */}
      {(!hasPendingDeal || showHistory) && (
        <>
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setOffersExpanded(!offersExpanded)}
          >
            <Text variant="bodyMedium" size="md">
              {offersExpanded ? '▼' : '▶'} {hasPendingDeal ? 'PREVIOUS OFFERS' : 'OFFERS'} ({hasPendingDeal ? allPreviousOffers.length : activeOffers.length})
            </Text>
          </Pressable>

          {offersExpanded && (
            <View style={styles.sectionContent}>
              {(hasPendingDeal ? allPreviousOffers : activeOffers).length === 0 ? (
                <Text variant="body" size="sm" color="muted" style={styles.emptyText}>
                  No offers yet. Share your listing to attract buyers!
                </Text>
              ) : (
                (hasPendingDeal ? allPreviousOffers : activeOffers).map(renderOfferCard)
              )}
            </View>
          )}

          {/* Questions Section */}
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setQuestionsExpanded(!questionsExpanded)}
          >
            <View style={styles.sectionTitleRow}>
              <Text variant="bodyMedium" size="md">
                {questionsExpanded ? '▼' : '▶'} QUESTIONS ({questions.length})
              </Text>
              {unansweredQuestions.length > 0 && (
                <Badge variant="warning" text={`${unansweredQuestions.length} new`} />
              )}
            </View>
          </Pressable>

          {questionsExpanded && (
            <View style={styles.sectionContent}>
              {questions.length === 0 ? (
                <Text variant="body" size="sm" color="muted" style={styles.emptyText}>
                  No questions yet.
                </Text>
              ) : (
                questions.map(renderQuestionCard)
              )}
            </View>
          )}
        </>
      )}

      {/* Agent Chat Section */}
      <Pressable
        style={styles.sectionHeader}
        onPress={() => setChatExpanded(!chatExpanded)}
      >
        <View style={styles.sectionTitleRow}>
          <Text variant="bodyMedium" size="md">
            {chatExpanded ? '▼' : '▶'} AGENT CHAT
          </Text>
          <Badge variant="purple" text="AI" />
        </View>
      </Pressable>

      {chatExpanded && (
        <View style={styles.chatSection}>
          {/* Quick Actions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActions}
          >
            <Pressable
              style={styles.quickActionChip}
              onPress={() => handleQuickAction('I want to sell this week')}
            >
              <Text variant="body" size="xs">Sell this week</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionChip}
              onPress={() => handleQuickAction('Raise minimum price')}
            >
              <Text variant="body" size="xs">Raise minimum</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionChip}
              onPress={() => handleQuickAction('Accept highest offer')}
            >
              <Text variant="body" size="xs">Accept top offer</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionChip}
              onPress={() => handleQuickAction('Update description')}
            >
              <Text variant="body" size="xs">Update details</Text>
            </Pressable>
          </ScrollView>

          {/* Chat Messages */}
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatMessages}
            contentContainerStyle={styles.chatMessagesContent}
          >
            {chatMessages.length === 0 ? (
              <Text variant="body" size="sm" color="muted" style={styles.chatEmptyText}>
                Ask me anything about your listing
              </Text>
            ) : (
              chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent,
                  ]}
                >
                  <Text
                    variant="body"
                    size="sm"
                    color={msg.sender === 'user' ? 'white' : 'primary'}
                  >
                    {msg.text}
                  </Text>
                </View>
              ))
            )}
            {chatLoading && (
              <View style={styles.chatBubbleAgent}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}
          </ScrollView>

          {/* Pending Action Bar */}
          {pendingAction && (
            <View style={styles.pendingActionBar}>
              <Text variant="body" size="sm" color="primary" style={styles.pendingActionText}>
                {pendingAction.type === 'update_min_price'
                  ? `Update minimum price to $${pendingAction.value}?`
                  : pendingAction.type === 'accept_offer'
                  ? `Accept offer for $${pendingAction.value}?`
                  : 'Confirm action?'}
              </Text>
              <View style={styles.pendingActionButtons}>
                <Pressable
                  style={styles.pendingActionCancel}
                  onPress={() => setPendingAction(null)}
                >
                  <Text variant="body" size="sm" color="secondary">Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.pendingActionConfirm}
                  onPress={handleExecuteAction}
                  disabled={executingAction}
                >
                  {executingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text variant="bodyMedium" size="sm" style={styles.pendingActionConfirmText}>
                      Confirm
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Chat Input */}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask about your listing..."
              placeholderTextColor={colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
            />
            <Pressable
              style={[styles.chatSendBtn, (!chatInput.trim() || chatLoading) && styles.chatSendBtnDisabled]}
              onPress={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
            >
              <Text style={styles.chatSendBtnText}>↑</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Pending Deal Card Styles
  pendingDealCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.successSoft,
  },
  pendingDealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingDealThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingDealImage: {
    width: '100%',
    height: '100%',
  },
  pendingDealEmoji: {
    fontSize: 20,
  },
  pendingDealInfo: {
    flex: 1,
  },
  pendingDealAction: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  // History Toggle
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },
  historyIcon: {
    fontSize: 10,
    color: colors.accent,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionContent: {
    paddingBottom: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontStyle: 'italic',
  },
  // Offer Card Styles
  offerCard: {
    marginBottom: spacing.md,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  offerInfo: {},
  offerAmount: {
    color: colors.success,
  },
  offerMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  buyerQuestionsContainer: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  buyerQuestionsLabel: {
    marginBottom: spacing.xs,
  },
  buyerQuestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  buyerQuestionText: {
    flex: 1,
    fontStyle: 'italic',
    marginRight: spacing.sm,
  },
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  viewDetailsBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.sm,
  },
  acceptBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.success,
  },
  acceptBtnText: {
    color: '#FFFFFF',
  },
  acceptBtnTextSecondary: {
    color: colors.success,
  },
  // Question Card Styles
  questionCard: {
    marginBottom: spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  questionText: {
    marginBottom: spacing.md,
  },
  replyContainer: {
    backgroundColor: colors.accentSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  replyText: {
    marginTop: spacing.xs,
  },
  questionActions: {
    marginTop: spacing.sm,
  },
  questionActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  replyBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  chatBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  viewChatBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  replyInputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    fontFamily: typography?.fonts?.body,
    fontSize: typography?.sizes?.sm,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelReplyBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sendReplyBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  sendBtnText: {
    color: '#FFFFFF',
  },
  // Agent Chat Styles
  chatSection: {
    marginBottom: spacing.lg,
  },
  quickActionsScroll: {
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
  },
  chatMessages: {
    maxHeight: 200,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  chatMessagesContent: {
    padding: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  chatEmptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  chatBubble: {
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    maxWidth: '85%',
  },
  chatBubbleUser: {
    backgroundColor: colors.accent,
    alignSelf: 'flex-end',
  },
  chatBubbleAgent: {
    backgroundColor: colors.purpleSoft,
    alignSelf: 'flex-start',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: typography?.fonts?.body,
    fontSize: typography?.sizes?.sm,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.accent,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendBtnDisabled: {
    opacity: 0.5,
  },
  chatSendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingActionBar: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pendingActionText: {
    marginBottom: spacing.sm,
  },
  pendingActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  pendingActionCancel: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pendingActionConfirm: {
    backgroundColor: colors.success,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  pendingActionConfirmText: {
    color: '#FFFFFF',
  },
});
