import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [pendingDealImageUrl, setPendingDealImageUrl] = useState<string | null>(null);
  const [lastChanceDealId, setLastChanceDealId] = useState<string | null>(null);
  const [sendingLastChance, setSendingLastChance] = useState(false);

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


  // Filter active offers (non-question deals with offers that are still negotiating)
  // Sort by highest offer first
  const activeOffers = deals
    .filter((d) => d.current_offer && !d.is_question && d.status === 'negotiating')
    .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0));

  // All offers for history (includes declined, cancelled etc - excludes the pending deal)
  // Sort by highest offer first
  const allPreviousOffers = deals
    .filter((d) => d.current_offer && !d.is_question && d.id !== pendingDeal?.id)
    .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0));

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


  const handleNavigateToDeal = (dealId: string) => {
    // Navigate to the Deals tab and then to DealChat
    tabNavigation.navigate('Deals', {
      screen: 'DealChat',
      params: { dealId },
    } as any);
  };

  const handleLastChance = async (dealId: string, offerAmount: number) => {
    const otherOffers = activeOffers.filter(d => d.id !== dealId);
    if (otherOffers.length === 0) {
      // No other offers, just accept
      handleAcceptOffer(dealId, offerAmount);
      return;
    }

    Alert.alert(
      'Send Last Chance',
      `This will notify ${otherOffers.length} other buyer${otherOffers.length > 1 ? 's' : ''} that you're about to accept $${offerAmount}. They'll have a chance to counter-bid. If no higher offer comes in, you must accept this offer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Last Chance',
          onPress: async () => {
            setSendingLastChance(true);
            setLastChanceDealId(dealId);
            try {
              // Send notification to all other buyers via chat message
              const { sendSystemMessage } = await import('../../services/chatService');
              for (const otherDeal of otherOffers) {
                await sendSystemMessage(
                  otherDeal.id,
                  `⚠️ LAST CHANCE: The seller is about to accept a $${offerAmount} offer for "${item.title}". This is your last chance to counter-bid!`
                );
              }
              Alert.alert(
                'Last Chance Sent',
                `Notified ${otherOffers.length} buyer${otherOffers.length > 1 ? 's' : ''}. Wait for counter-bids or accept the offer.`,
                [
                  { text: 'Wait', style: 'cancel' },
                  { text: 'Accept Now', onPress: () => onAcceptOffer(dealId) },
                ]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to send last chance notifications');
            } finally {
              setSendingLastChance(false);
              setLastChanceDealId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusLabel = (status: string, pickupDate?: string | null) => {
    switch (status) {
      case 'agreed': return 'Agreed';
      case 'logistics': return pickupDate ? 'Scheduled' : 'Scheduling';
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

    // Format pickup date for display
    const formattedPickupDate = pendingDeal.pickup_date
      ? new Date(pendingDeal.pickup_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;

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
              {/* Show pickup time when scheduled */}
              {formattedPickupDate && (
                <Text variant="body" size="xs" color="muted">
                  Pickup: {formattedPickupDate}
                </Text>
              )}
            </View>
            <Badge variant={getStatusBadgeVariant(pendingDeal.status)}>
              {getStatusLabel(pendingDeal.status, pendingDeal.pickup_date)}
            </Badge>
          </View>
          <View style={styles.pendingDealAction}>
            <Text variant="body" size="sm" color="accent">
              {pendingDeal.status === 'agreed'
                ? 'Tap to finalize pickup schedule →'
                : formattedPickupDate
                  ? 'Tap to view deal details →'
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
          <Text variant="body" size="xs" color="warning">
            {expirationText || 'No expiration'}
          </Text>
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
          {activeOffers.length > 1 && (
            <Pressable
              style={styles.lastChanceBtn}
              onPress={() => handleLastChance(deal.id, deal.current_offer || 0)}
              disabled={sendingLastChance}
            >
              <Text variant="bodyMedium" size="sm" color="warning">
                {sendingLastChance && lastChanceDealId === deal.id ? '...' : 'Last Chance'}
              </Text>
            </Pressable>
          )}
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
  lastChanceBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
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
});
