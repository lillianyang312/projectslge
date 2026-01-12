import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Card, Badge } from '../../ui/components';
import { colors, spacing, radius, shadows } from '../../ui/tokens';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealsHome'>;

type TabType = 'active' | 'matches' | 'history';

// Demo data matching HTML spec exactly
const demoDeals = {
  active: [
    {
      id: '1',
      emoji: '🪑',
      title: 'Herman Miller Aeron',
      type: 'Selling',
      price: '$550',
      badgeLabel: 'Pickup',
      badgeVariant: 'warning' as const,
      statusText: '📍 Local · Sat Jan 11, 3pm',
    },
    {
      id: '2',
      emoji: '🖥️',
      title: 'Apple Studio Display',
      type: 'Buying',
      price: '$1,050',
      badgeLabel: 'Shipping',
      badgeVariant: 'blue' as const,
      statusText: '📦 UPS · Est. Jan 15–17',
    },
    {
      id: '3',
      emoji: '🎸',
      title: 'Fender Stratocaster',
      type: 'Sold',
      price: '$425',
      badgeLabel: 'Complete',
      badgeVariant: 'success' as const,
      statusText: '✓ Completed Jan 5',
    },
  ],
  matches: [
    {
      id: '4',
      emoji: '🖥️',
      title: 'Apple Studio Display',
      section: 'Ready to negotiate',
      badges: [
        { label: 'Local', variant: 'success' as const },
        { label: '~0.8 mi', variant: 'neutral' as const },
      ],
      yourMax: '$1,200',
      theirAsk: '$1,100',
      actionLabel: 'Start negotiation →',
      actionVariant: 'primary' as const,
    },
    {
      id: '5',
      emoji: '🪑',
      title: 'Herman Miller Aeron',
      section: 'Someone wants yours',
      badges: [{ label: 'Local', variant: 'success' as const }],
      theirMax: '$550',
      yourAsk: 'Not set',
      actionLabel: 'View offer →',
      actionVariant: 'secondary' as const,
    },
  ],
  history: [
    {
      id: '6',
      emoji: '🎸',
      title: 'Fender Stratocaster',
      type: 'Sold',
      price: '$425',
      badgeLabel: 'Complete',
      badgeVariant: 'success' as const,
      statusText: '✓ Completed Jan 5',
    },
  ],
};

export default function DealsHomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('active');

  const handleDealPress = (dealId: string) => {
    // Navigate to appropriate screen based on deal
    if (dealId === '1') {
      navigation.navigate('Shipping', { dealId }); // Pickup details
    } else if (dealId === '2') {
      navigation.navigate('Shipping', { dealId }); // Shipping details
    }
  };

  const renderActiveDeals = () => (
    <>
      {demoDeals.active.map((deal) => (
        <Pressable key={deal.id} onPress={() => handleDealPress(deal.id)}>
          <Card style={styles.dealCard}>
            <View style={styles.itemCard}>
              <View style={styles.itemThumb}>
                <Text style={styles.itemEmoji}>{deal.emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                  {deal.title}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  {deal.type} · {deal.price}
                </Text>
              </View>
              <Badge variant={deal.badgeVariant}>{deal.badgeLabel}</Badge>
            </View>
            <View style={styles.dealStatusBar}>
              <Text variant="body" size="sm" color="secondary">
                {deal.statusText}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </>
  );

  const renderMatches = () => {
    // Group by section
    const readyToNegotiate = demoDeals.matches.filter(
      (m) => m.section === 'Ready to negotiate'
    );
    const somoneWants = demoDeals.matches.filter(
      (m) => m.section === 'Someone wants yours'
    );

    return (
      <>
        {readyToNegotiate.length > 0 && (
          <View style={styles.matchSection}>
            <Text variant="bodyMedium" size="sm" color="secondary" style={styles.sectionTitle}>
              Ready to negotiate
            </Text>
            {readyToNegotiate.map((match) => (
              <Card key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <View style={styles.itemThumb}>
                    <Text style={styles.itemEmoji}>{match.emoji}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                      {match.title}
                    </Text>
                    <View style={styles.matchBadges}>
                      {match.badges.map((badge, idx) => (
                        <Badge key={idx} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.matchPrices}>
                  <View style={styles.matchPrice}>
                    <Text variant="body" size="sm" color="secondary">
                      Your max
                    </Text>
                    <Text variant="heading" size="lg">
                      {match.yourMax}
                    </Text>
                  </View>
                  <View style={styles.matchPrice}>
                    <Text variant="body" size="sm" color="secondary">
                      Their ask
                    </Text>
                    <Text variant="heading" size="lg">
                      {match.theirAsk}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.matchBtn,
                    match.actionVariant === 'primary'
                      ? styles.matchBtnPrimary
                      : styles.matchBtnSecondary,
                  ]}
                >
                  <Text
                    variant="bodyMedium"
                    size="sm"
                    color={match.actionVariant === 'primary' ? 'white' : 'primary'}
                  >
                    {match.actionLabel}
                  </Text>
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        {somoneWants.length > 0 && (
          <View style={styles.matchSection}>
            <Text variant="bodyMedium" size="sm" color="secondary" style={styles.sectionTitle}>
              Someone wants yours
            </Text>
            {somoneWants.map((match) => (
              <Card key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <View style={styles.itemThumb}>
                    <Text style={styles.itemEmoji}>{match.emoji}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                      {match.title}
                    </Text>
                    <View style={styles.matchBadges}>
                      {match.badges.map((badge, idx) => (
                        <Badge key={idx} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.matchPrices}>
                  <View style={styles.matchPrice}>
                    <Text variant="body" size="sm" color="secondary">
                      Their max
                    </Text>
                    <Text variant="heading" size="lg">
                      {match.theirMax}
                    </Text>
                  </View>
                  <View style={styles.matchPrice}>
                    <Text variant="body" size="sm" color="secondary">
                      Your ask
                    </Text>
                    <Text variant="heading" size="lg">
                      {match.yourAsk}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.matchBtn,
                    match.actionVariant === 'primary'
                      ? styles.matchBtnPrimary
                      : styles.matchBtnSecondary,
                  ]}
                >
                  <Text
                    variant="bodyMedium"
                    size="sm"
                    color={match.actionVariant === 'primary' ? 'white' : 'primary'}
                  >
                    {match.actionLabel}
                  </Text>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </>
    );
  };

  const renderHistory = () => (
    <>
      {demoDeals.history.map((deal) => (
        <Card key={deal.id} style={styles.dealCard}>
          <View style={styles.itemCard}>
            <View style={styles.itemThumb}>
              <Text style={styles.itemEmoji}>{deal.emoji}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                {deal.title}
              </Text>
              <Text variant="body" size="sm" color="secondary">
                {deal.type} · {deal.price}
              </Text>
            </View>
            <Badge variant={deal.badgeVariant}>{deal.badgeLabel}</Badge>
          </View>
          <View style={styles.dealStatusBar}>
            <Text variant="body" size="sm" color="secondary">
              {deal.statusText}
            </Text>
          </View>
        </Card>
      ))}
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Deals
        </Text>
        <Text variant="body" size="md" color="secondary">
          Your transactions
        </Text>
      </View>

      {/* Tabs matching HTML spec */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            variant="bodyMedium"
            size="sm"
            color={activeTab === 'active' ? 'white' : 'primary'}
          >
            Active
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text
            variant="bodyMedium"
            size="sm"
            color={activeTab === 'matches' ? 'white' : 'primary'}
          >
            Matches
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            variant="bodyMedium"
            size="sm"
            color={activeTab === 'history' ? 'white' : 'primary'}
          >
            History
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'active' && renderActiveDeals()}
        {activeTab === 'matches' && renderMatches()}
        {activeTab === 'history' && renderHistory()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120, // Space for tab bar
  },
  dealCard: {
    marginBottom: spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemThumb: {
    width: 56,
    height: 56,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    marginBottom: 4,
  },
  dealStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  matchSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  matchCard: {
    marginBottom: spacing.md,
  },
  matchHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  matchBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  matchPrices: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  matchPrice: {},
  matchBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  matchBtnPrimary: {
    backgroundColor: colors.accent,
  },
  matchBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
