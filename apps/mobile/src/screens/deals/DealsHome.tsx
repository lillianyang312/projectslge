import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { Deal, DealStatus } from '../../types/models';
import { getMyDeals, getDealsByStatus } from '../../services/dealsService';
import { getSignedUrl } from '../../services/imageService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealsHome'>;

type TabType = 'active' | 'agreed' | 'history';

export default function DealsHomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadDeals();
  }, [activeTab]);

  async function loadDeals() {
    if (!user) return;

    setLoading(true);

    let dealList: Deal[];
    if (activeTab === 'active') {
      dealList = await getDealsByStatus(user.id, 'negotiating');
    } else if (activeTab === 'agreed') {
      const agreed = await getDealsByStatus(user.id, 'agreed');
      const logistics = await getDealsByStatus(user.id, 'logistics');
      dealList = [...agreed, ...logistics];
    } else {
      const completed = await getDealsByStatus(user.id, 'completed');
      const cancelled = await getDealsByStatus(user.id, 'cancelled');
      dealList = [...completed, ...cancelled];
    }

    setDeals(dealList);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headingMedium" size="heading2">
          Deals
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            variant="bodyMedium"
            size="base"
            color={activeTab === 'active' ? 'primary' : 'secondary'}
          >
            Active
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'agreed' && styles.tabActive]}
          onPress={() => setActiveTab('agreed')}
        >
          <Text
            variant="bodyMedium"
            size="base"
            color={activeTab === 'agreed' ? 'primary' : 'secondary'}
          >
            Agreed
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            variant="bodyMedium"
            size="base"
            color={activeTab === 'history' ? 'primary' : 'secondary'}
          >
            History
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
        ) : deals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="headingMedium" size="heading4" style={styles.emptyTitle}>
              {activeTab === 'active'
                ? 'No active deals'
                : activeTab === 'agreed'
                ? 'No agreed deals'
                : 'No past deals'}
            </Text>
            <Text variant="body" size="base" color="secondary" style={styles.emptyText}>
              {activeTab === 'active'
                ? 'Start negotiating with your matches to create deals.'
                : activeTab === 'agreed'
                ? 'Agreed deals will appear here.'
                : 'Completed and cancelled deals will appear here.'}
            </Text>
          </View>
        ) : (
          <>
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                currentUserId={user?.id || ''}
                onPress={() => navigation.navigate('DealDetail', { dealId: deal.id })}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface DealCardProps {
  deal: Deal;
  currentUserId: string;
  onPress: () => void;
}

function DealCard({ deal, currentUserId, onPress }: DealCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (deal.item?.image_path) {
      getSignedUrl(deal.item.image_path).then(setImageUrl);
    }
  }, [deal]);

  const isBuyer = deal.buyer_id === currentUserId;
  const otherUser = isBuyer ? deal.seller : deal.buyer;
  const role = isBuyer ? 'Buying from' : 'Selling to';

  const statusBadge = getStatusBadge(deal.status);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.dealCard}>
        <View style={styles.dealRow}>
          {/* Item Image */}
          <View style={styles.imageContainer}>
            {imageUrl && <Image source={{ uri: imageUrl }} style={styles.dealImage} />}
          </View>

          {/* Deal Info */}
          <View style={styles.dealInfo}>
            <Text variant="headingMedium" size="heading5" style={styles.dealTitle}>
              {deal.item?.label || deal.item?.category || 'Item'}
            </Text>

            <Text variant="body" size="sm" color="secondary" style={styles.dealRole}>
              {role} {otherUser?.email || 'Unknown user'}
            </Text>

            {deal.current_offer ? (
              <View style={styles.priceRow}>
                <Text variant="body" size="sm" color="muted">
                  Current offer:
                </Text>
                <Text variant="bodyMedium" size="base">
                  ${deal.current_offer}
                </Text>
              </View>
            ) : deal.agreed_price ? (
              <View style={styles.priceRow}>
                <Text variant="body" size="sm" color="muted">
                  Agreed:
                </Text>
                <Text variant="bodyMedium" size="base" color="success">
                  ${deal.agreed_price}
                </Text>
              </View>
            ) : null}

            <View style={styles.dealFooter}>
              <Badge variant={statusBadge.variant} text={statusBadge.text} />
              <Text variant="body" size="xs" color="muted">
                {new Date(deal.updated_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Arrow */}
          <Text variant="body" size="xl" color="muted">
            →
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function getStatusBadge(status: DealStatus): { variant: any; text: string } {
  switch (status) {
    case 'negotiating':
      return { variant: 'warning', text: 'Negotiating' };
    case 'agreed':
      return { variant: 'success', text: 'Agreed' };
    case 'logistics':
      return { variant: 'accent', text: 'Logistics' };
    case 'completed':
      return { variant: 'success', text: 'Completed' };
    case 'cancelled':
      return { variant: 'soft', text: 'Cancelled' };
    default:
      return { variant: 'soft', text: status };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  emptyState: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 300,
  },
  dealCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgAlt,
  },
  dealImage: {
    width: '100%',
    height: '100%',
  },
  dealInfo: {
    flex: 1,
  },
  dealTitle: {
    marginBottom: spacing.xs,
  },
  dealRole: {
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'baseline',
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
