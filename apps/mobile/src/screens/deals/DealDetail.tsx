import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppTabsParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealDetail'>;
type TabNavProp = BottomTabNavigationProp<AppTabsParamList>;

// Demo deal details data matching HTML spec lines 1093-1136
const demoDeals: Record<string, {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  status: string;
  badgeVariant: 'warning' | 'success' | 'purple';
  agreedPrice: string;
  otherParty: string;
  delivery: string;
  statusText: string;
  agentStatus: string;
  chatButtonText: string;
  isSelling: boolean;
}> = {
  '1': {
    id: '1',
    emoji: '🪑',
    title: 'Herman Miller Aeron',
    subtitle: "You're selling",
    status: 'Scheduling',
    badgeVariant: 'warning',
    agreedPrice: '$550',
    otherParty: 'Anonymous · 1.2 mi',
    delivery: 'Local pickup',
    statusText: 'Coordinating time',
    agentStatus: 'Finding a time that works',
    chatButtonText: 'Chat with buyer',
    isSelling: true,
  },
  '2': {
    id: '2',
    emoji: '🎸',
    title: 'Fender Stratocaster',
    subtitle: "You're selling",
    status: 'Complete',
    badgeVariant: 'success',
    agreedPrice: '$425',
    otherParty: 'Mike Johnson · 2.5 mi',
    delivery: 'Local pickup',
    statusText: 'Deal completed',
    agentStatus: 'Payment received, item picked up',
    chatButtonText: 'Chat with buyer',
    isSelling: true,
  },
  '3': {
    id: '3',
    emoji: '🛋️',
    title: 'Mid-century Sofa',
    subtitle: "You're buying",
    status: 'Pending',
    badgeVariant: 'purple',
    agreedPrice: '$580',
    otherParty: 'Emma Wilson · 0.8 mi',
    delivery: 'Local pickup',
    statusText: 'Waiting for seller response',
    agentStatus: 'Bid sent, awaiting response',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
  '4': {
    id: '4',
    emoji: '🖥️',
    title: 'Studio Display',
    subtitle: "You're buying",
    status: 'Pending',
    badgeVariant: 'purple',
    agreedPrice: '$1,050',
    otherParty: 'Tech Seller · 3.1 mi',
    delivery: 'Shipping OK',
    statusText: 'Waiting for seller response',
    agentStatus: 'Bid sent, awaiting response',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
  '5': {
    id: '5',
    emoji: '🚴',
    title: 'Road Bike',
    subtitle: "You're buying",
    status: 'Scheduling',
    badgeVariant: 'warning',
    agreedPrice: '$420',
    otherParty: 'Bike Shop · 1.5 mi',
    delivery: 'Local pickup',
    statusText: 'Coordinating pickup',
    agentStatus: 'Bid accepted, scheduling pickup',
    chatButtonText: 'Chat with seller',
    isSelling: false,
  },
};

export default function DealDetailScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const deal = demoDeals[dealId] || demoDeals['1'];
  const tabNavigation = useNavigation<TabNavProp>();

  const handleChatPress = () => {
    navigation.navigate('ChatThread', { conversationId: dealId });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleItemPress = () => {
    // Navigate to List tab and open ItemDetail
    tabNavigation.navigate('List');
    // Note: In a real implementation, we'd pass the itemId and navigate to ItemDetail
  };

  const handleCancelDeal = () => {
    Alert.alert(
      'Cancel Deal',
      'Are you sure you want to cancel this deal? This action cannot be undone.',
      [
        {
          text: 'Keep Deal',
          style: 'cancel',
        },
        {
          text: 'Cancel Deal',
          style: 'destructive',
          onPress: () => {
            // Navigate back to deals list
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading2">
            Deal
          </Text>
        </View>

        {/* Item Card - matching HTML lines 1099-1108 */}
        <Pressable onPress={handleItemPress}>
          <Card style={styles.itemCard}>
            <View style={styles.itemContent}>
              <View style={styles.itemThumb}>
                <Text style={styles.itemEmoji}>{deal.emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text variant="bodyMedium" size="lg" style={styles.itemName}>
                  {deal.title}
                </Text>
                <Text variant="body" size="sm" color="secondary">
                  {deal.subtitle}
                </Text>
              </View>
              <Badge variant={deal.badgeVariant}>{deal.status}</Badge>
            </View>
          </Card>
        </Pressable>

        {/* Agent Summary - matching HTML lines 1110-1127 */}
        <View style={styles.agentSummary}>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Agreed price
            </Text>
            <Text variant="bodyMedium" size="md">
              {deal.agreedPrice}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              {deal.isSelling ? 'Buyer' : 'Seller'}
            </Text>
            <Text variant="bodyMedium" size="md">
              {deal.otherParty}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Delivery
            </Text>
            <Text variant="bodyMedium" size="md">
              {deal.delivery}
            </Text>
          </View>
          <View style={styles.agentRow}>
            <Text variant="body" size="sm" color="secondary">
              Status
            </Text>
            <Text variant="bodyMedium" size="md">
              {deal.statusText}
            </Text>
          </View>
        </View>

        {/* Agent Recommendation - matching HTML lines 1129-1132 */}
        <View style={styles.agentRecommendation}>
          <Text variant="body" size="sm" color="secondary" style={styles.agentRecLabel}>
            Agent status
          </Text>
          <Text variant="bodyMedium" size="md" style={styles.agentRecValue}>
            {deal.agentStatus}
          </Text>
        </View>

        {/* Buttons - matching HTML lines 1134-1135 */}
        <Button variant="primary" onPress={handleChatPress}>
          {deal.chatButtonText}
        </Button>

        <Button variant="secondary" onPress={handleCancelDeal} style={styles.cancelButton}>
          Cancel deal
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
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    marginBottom: spacing.xl,
  },
  itemContent: {
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
  agentSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  agentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  agentRecommendation: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  agentRecLabel: {
    marginBottom: spacing.xs,
  },
  agentRecValue: {
    lineHeight: 22,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
