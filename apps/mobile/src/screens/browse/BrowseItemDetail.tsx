import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SwipeStackParamList, AppTabsParamList } from '../../navigation/types';
import { Text, Button, Input, Card } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';

type Props = NativeStackScreenProps<SwipeStackParamList, 'BrowseItemDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

// Demo data matching HTML spec lines 862-900
const demoItems: Record<string, {
  emoji: string;
  title: string;
  category: string;
  distance: string;
  askingPrice: number;
  marketEstimate: string;
  condition: string;
  sellerPreference: string;
  description: string;
}> = {
  '1': {
    emoji: '🛋️',
    title: 'Mid-century Modern Sofa',
    category: 'Furniture',
    distance: '~0.8 mi away',
    askingPrice: 650,
    marketEstimate: '$600 – $750',
    condition: 'Good',
    sellerPreference: 'Local pickup',
    description: 'Walnut frame, original cushions, minor wear on armrests. Non-smoking home.',
  },
  '2': {
    emoji: '🖥️',
    title: 'Studio Display',
    category: 'Electronics',
    distance: '~1.2 mi away',
    askingPrice: 1100,
    marketEstimate: '$1000 – $1200',
    condition: 'Like new',
    sellerPreference: 'Shipping OK',
    description: 'Apple Studio Display, barely used, includes original box.',
  },
  '3': {
    emoji: '🚴',
    title: 'Road Bike',
    category: 'Sports',
    distance: '~2.5 mi away',
    askingPrice: 450,
    marketEstimate: '$400 – $550',
    condition: 'Good',
    sellerPreference: 'Local pickup',
    description: 'Specialized road bike, well maintained, new tires.',
  },
};

export default function BrowseItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const itemData = demoItems[itemId] || demoItems['1'];
  const tabNavigation = useNavigation<TabNavProp>();

  const [showBidForm, setShowBidForm] = useState(false);
  const [maxBid, setMaxBid] = useState('');
  const [interestedFor, setInterestedFor] = useState<'1 week' | '2 weeks' | '1 month' | 'Flexible'>('2 weeks');

  const handleSendInterest = () => {
    // Navigate directly to Deals tab (Buying section)
    tabNavigation.navigate('Deals', { initialMode: 'buying' });
  };

  const handleAskQuestion = () => {
    // Navigate directly to chat thread for this item
    navigation.navigate('ChatThread', { conversationId: `item-${itemId}` });
  };

  if (showBidForm) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => setShowBidForm(false)} style={styles.backBtn}>
              <Text size="xl">←</Text>
            </Pressable>
            <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
              Express Interest
            </Text>
          </View>

          {/* Scrollable Form */}
          <ScrollView style={styles.compactForm} contentContainerStyle={styles.compactFormContent}>
            {/* Item Summary - Smaller */}
            <Card style={styles.compactItemCard}>
              <View style={styles.compactItemRow}>
                <Text style={styles.compactEmoji}>{itemData.emoji}</Text>
                <View style={styles.compactItemInfo}>
                  <Text variant="bodyMedium" size="md" style={styles.compactItemName}>
                    {itemData.title}
                  </Text>
                  <Text variant="body" size="xs" color="secondary">
                    Est. {itemData.marketEstimate}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Max Bid - Compact */}
            <View style={styles.compactInputGroup}>
              <Text variant="body" size="sm" color="secondary" style={styles.compactLabel}>
                Max bid (optional)
              </Text>
              <Input
                placeholder="$0"
                value={maxBid}
                onChangeText={setMaxBid}
                keyboardType="numeric"
                style={styles.compactInput}
              />
              <Text variant="body" size="xs" color="muted" style={styles.compactHint}>
                Including a price makes sellers more likely to respond
              </Text>
            </View>

            {/* Interested For - NEW */}
            <View style={styles.compactInputGroup}>
              <Text variant="body" size="sm" color="secondary" style={styles.compactLabel}>
                Interested for
              </Text>
              <View style={styles.compactPills}>
                {(['1 week', '2 weeks', '1 month', 'Flexible'] as const).map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.compactPill, interestedFor === option && styles.compactPillActive]}
                    onPress={() => setInterestedFor(option)}
                  >
                    <Text
                      variant="bodyMedium"
                      size="xs"
                      color={interestedFor === option ? undefined : 'secondary'}
                      style={interestedFor === option && styles.compactPillTextActive}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Buttons at bottom */}
          <View style={styles.compactButtonArea}>
            <Button variant="primary" onPress={handleSendInterest}>
              Submit bid
            </Button>
            <Button variant="secondary" onPress={handleAskQuestion}>
              Ask question
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            Item
          </Text>
        </View>

        {/* Item Image */}
        <View style={styles.detailImage}>
          <Text style={styles.imageEmoji}>{itemData.emoji}</Text>
        </View>

        <Text variant="headingMedium" size="heading3" style={styles.detailTitle}>
          {itemData.title}
        </Text>

        <Text variant="body" size="md" color="secondary" style={styles.detailCategory}>
          {itemData.category} · {itemData.distance}
        </Text>

        {/* Agent Summary */}
        <View style={styles.agentSummary}>
          <View style={styles.agentRow}>
            <Text variant="body" size="md" color="secondary">
              Estimated value
            </Text>
            <Text variant="bodyMedium" size="md">
              {itemData.marketEstimate}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="md" color="secondary">
              Condition
            </Text>
            <Text variant="bodyMedium" size="md">
              {itemData.condition}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="md" color="secondary">
              Seller preference
            </Text>
            <Text variant="bodyMedium" size="md">
              {itemData.sellerPreference}
            </Text>
          </View>
        </View>

        <Text variant="body" size="md" color="secondary" style={styles.description}>
          {itemData.description}
        </Text>

        <Button variant="primary" onPress={() => setShowBidForm(true)}>
          Express Interest
        </Button>
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
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
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
    marginLeft: spacing.sm,
  },
  headerTitle: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  imageEmoji: {
    fontSize: 80,
  },
  detailTitle: {
    marginBottom: 4,
  },
  detailCategory: {
    marginBottom: spacing.xl,
  },
  agentSummary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  agentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  description: {
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  itemSummaryCard: {
    marginBottom: spacing.xl,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  interestCard: {
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  interestTitle: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Compact form styles
  container: {
    flex: 1,
  },
  compactForm: {
    flex: 1,
  },
  compactFormContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  compactItemCard: {
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  compactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactEmoji: {
    fontSize: 32,
  },
  compactItemInfo: {
    flex: 1,
  },
  compactItemName: {
    marginBottom: 2,
  },
  compactInputGroup: {
    marginBottom: spacing.md,
  },
  compactLabel: {
    marginBottom: spacing.xs,
  },
  compactInput: {
    height: 40,
  },
  compactHint: {
    marginTop: spacing.xs,
  },
  compactPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  compactPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  compactPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  compactPillTextActive: {
    color: '#FFFFFF',
  },
  compactTextarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  compactButtonArea: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
});
