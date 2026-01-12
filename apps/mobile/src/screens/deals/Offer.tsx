import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { Deal, Item } from '../../types/models';
import { getDealById, makeOffer, acceptOffer } from '../../services/dealsService';
import { generateNegotiationSuggestion } from '../../services/agentService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<DealsStackParamList, 'Offer'>;

export default function OfferScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadDeal();
  }, []);

  async function loadDeal() {
    const dealData = await getDealById(dealId);
    setDeal(dealData);
    setLoading(false);
  }

  if (loading || !deal || !user) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  const isBuyer = deal.buyer_id === user.id;
  const item = deal.item!;

  // Generate agent suggestion
  const suggestion = generateNegotiationSuggestion({
    item,
    currentOffer: deal.current_offer,
    lastOfferBy: deal.last_offer_by,
    userId: user.id,
    isBuyer,
  });

  async function handleMakeOffer(amount: number) {
    setSubmitting(true);
    const success = await makeOffer(dealId, amount, user.id);
    setSubmitting(false);

    if (success) {
      navigation.goBack();
    }
  }

  async function handleAccept() {
    setSubmitting(true);
    const success = await acceptOffer(dealId, user.id);
    setSubmitting(false);

    if (success) {
      navigation.goBack();
    }
  }

  async function handleCustomOffer() {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    await handleMakeOffer(amount);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            {suggestion.type === 'accept' ? 'Accept Offer' : 'Make Offer'}
          </Text>
        </View>

        {/* Item Info */}
        <Card style={styles.itemCard}>
          <Text variant="headingMedium" size="heading4" style={styles.itemTitle}>
            {item.label || item.category}
          </Text>

          {deal.current_offer && (
            <View style={styles.currentOfferRow}>
              <Text variant="body" size="base" color="secondary">
                Current offer:
              </Text>
              <Text variant="headingMedium" size="heading4">
                ${deal.current_offer}
              </Text>
            </View>
          )}

          {item.market_value_min && item.market_value_max && (
            <Text variant="body" size="sm" color="muted">
              Market value: ${item.market_value_min}-${item.market_value_max}
            </Text>
          )}
        </Card>

        {/* Agent Suggestion Card */}
        <Card style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <Text variant="bodyMedium" size="sm" color="muted">
              AGENT RECOMMENDATION
            </Text>
            <Badge
              variant={
                suggestion.confidence >= 0.8
                  ? 'success'
                  : suggestion.confidence >= 0.6
                  ? 'warning'
                  : 'soft'
              }
              text={`${Math.round(suggestion.confidence * 100)}% confident`}
            />
          </View>

          {suggestion.type === 'accept' ? (
            <>
              <Text variant="headingMedium" size="heading4" style={styles.agentRecommendation}>
                Accept the current offer
              </Text>
              <Text variant="body" size="base" color="secondary" style={styles.agentReasoning}>
                {suggestion.reasoning}
              </Text>

              <Button
                variant="primary"
                onPress={handleAccept}
                disabled={submitting}
                style={styles.acceptBtn}
              >
                {submitting ? 'Accepting...' : `Accept $${deal.current_offer}`}
              </Button>
            </>
          ) : suggestion.type === 'decline' ? (
            <>
              <Text variant="headingMedium" size="heading4" style={styles.agentRecommendation}>
                Decline this offer
              </Text>
              <Text variant="body" size="base" color="secondary" style={styles.agentReasoning}>
                {suggestion.reasoning}
              </Text>

              <Button variant="danger" onPress={() => navigation.goBack()} style={styles.declineBtn}>
                Decline & Exit
              </Button>
            </>
          ) : (
            <>
              {suggestion.amount && (
                <View style={styles.suggestedAmountRow}>
                  <Text variant="body" size="base" color="secondary">
                    Suggested {suggestion.type}:
                  </Text>
                  <Text variant="headingMedium" size="heading3" color="accent">
                    ${suggestion.amount}
                  </Text>
                </View>
              )}

              <Text variant="body" size="base" color="secondary" style={styles.agentReasoning}>
                {suggestion.reasoning}
              </Text>

              {suggestion.amount && (
                <Button
                  variant="primary"
                  onPress={() => handleMakeOffer(suggestion.amount!)}
                  disabled={submitting}
                  style={styles.suggestionBtn}
                >
                  {submitting ? 'Submitting...' : `Offer $${suggestion.amount}`}
                </Button>
              )}
            </>
          )}
        </Card>

        {/* Custom Offer */}
        {suggestion.type !== 'accept' && suggestion.type !== 'decline' && (
          <Card style={styles.customCard}>
            <Text variant="bodyMedium" size="base" style={styles.customLabel}>
              Or enter your own amount:
            </Text>

            <View style={styles.customInputRow}>
              <Text variant="headingMedium" size="heading3" style={styles.dollarSign}>
                $
              </Text>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Button
              variant="secondary"
              onPress={handleCustomOffer}
              disabled={submitting || !customAmount}
              style={styles.customBtn}
            >
              {submitting ? 'Submitting...' : 'Submit Custom Offer'}
            </Button>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
  itemCard: {
    marginBottom: spacing.lg,
  },
  itemTitle: {
    marginBottom: spacing.md,
  },
  currentOfferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  agentCard: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    marginBottom: spacing.lg,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  agentRecommendation: {
    marginBottom: spacing.md,
  },
  suggestedAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  agentReasoning: {
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  suggestionBtn: {
    marginTop: spacing.sm,
  },
  acceptBtn: {
    marginTop: spacing.sm,
  },
  declineBtn: {
    marginTop: spacing.sm,
  },
  customCard: {
    marginBottom: spacing.lg,
  },
  customLabel: {
    marginBottom: spacing.md,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
  },
  dollarSign: {
    marginRight: spacing.sm,
  },
  customInput: {
    flex: 1,
    fontSize: typography.sizes.heading3,
    fontFamily: typography.fonts.bodyMedium,
    color: colors.textPrimary,
  },
  customBtn: {},
});
