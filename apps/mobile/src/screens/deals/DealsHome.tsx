import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Card, Badge, ToggleGroup } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useRoute, RouteProp } from '@react-navigation/native';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealsHome'>;
type DealsRouteProp = RouteProp<AppTabsParamList, 'Deals'>;

// Demo data matching HTML spec exactly - lines 955-1032
const sellingDeals = [
  {
    id: '1',
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    meta: 'Selling for $550',
    badgeLabel: 'Scheduling',
    badgeVariant: 'warning' as const,
  },
  {
    id: '2',
    emoji: '🎸',
    title: 'Fender Stratocaster',
    meta: 'Sold for $425',
    badgeLabel: 'Complete',
    badgeVariant: 'success' as const,
  },
];

const buyingDeals = [
  {
    id: '3',
    emoji: '🛋️',
    title: 'Mid-century Sofa',
    meta: 'Your bid: $580',
    badgeLabel: 'Pending',
    badgeVariant: 'purple' as const,
  },
  {
    id: '4',
    emoji: '🖥️',
    title: 'Studio Display',
    meta: 'Your bid: $1,050',
    badgeLabel: 'Pending',
    badgeVariant: 'purple' as const,
  },
  {
    id: '5',
    emoji: '🚴',
    title: 'Road Bike',
    meta: 'Accepted at $420',
    badgeLabel: 'Scheduling',
    badgeVariant: 'warning' as const,
  },
];

export default function DealsHomeScreen({ navigation, route }: Props) {
  const tabRoute = useRoute<DealsRouteProp>();
  // Get initialMode from both tab params and route params
  const initialModeFromTab = tabRoute.params?.initialMode;
  const initialModeFromRoute = route.params?.initialMode;
  const initialMode = initialModeFromRoute || initialModeFromTab || 'selling';

  const [mode, setMode] = useState<'selling' | 'buying'>(initialMode);

  useEffect(() => {
    // Update mode when params change
    const newMode = initialModeFromRoute || initialModeFromTab;
    if (newMode) {
      setMode(newMode);
    }
  }, [initialModeFromRoute, initialModeFromTab]);

  const currentDeals = mode === 'selling' ? sellingDeals : buyingDeals;
  const sectionLabel = mode === 'selling' ? 'Pending sales' : 'Bids you\'ve sent';

  const handleToggle = (index: number) => {
    setMode(index === 0 ? 'selling' : 'buying');
  };

  const handleDealPress = (dealId: string) => {
    // Navigate to deal detail
    navigation.navigate('DealDetail', { dealId });
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Deals
        </Text>
      </View>

      {/* Toggle: Selling / Buying */}
      <View style={styles.toggleContainer}>
        <ToggleGroup
          options={['Selling', 'Buying']}
          selectedIndex={mode === 'selling' ? 0 : 1}
          onSelect={handleToggle}
        />
      </View>

      {/* Section Label */}
      <Text variant="body" size="sm" color="secondary" style={styles.sectionLabel}>
        {sectionLabel}
      </Text>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentDeals.map((deal) => (
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
                    {deal.meta}
                  </Text>
                </View>
                <Badge variant={deal.badgeVariant}>{deal.badgeLabel}</Badge>
              </View>
            </Card>
          </Pressable>
        ))}
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
  toggleContainer: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
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
});
