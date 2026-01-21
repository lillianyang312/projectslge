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
import { MatchesStackParamList } from '../../navigation/types';
import { Text, Button, Card, Badge } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { Match } from '../../types/models';
import { getMyMatches } from '../../services/matchingService';
import { getSignedUrlCached } from '../../services/imageService';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchesHome'>;

export default function MatchesHomeScreen({ navigation }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    if (!user) return;

    setLoading(true);
    const matchList = await getMyMatches(user.id);
    setMatches(matchList);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headingMedium" size="heading2">
            Matches
          </Text>
          <Text variant="body" size="base" color="secondary">
            {matches.length} active {matches.length === 1 ? 'match' : 'matches'}
          </Text>
        </View>

        {/* Empty State */}
        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="headingMedium" size="heading3" style={styles.emptyTitle}>
              No matches yet
            </Text>
            <Text variant="body" size="base" color="secondary" style={styles.emptyText}>
              Start swiping to find items you want to buy or people interested in your items!
            </Text>
            <View style={styles.emptyActions}>
              <Button
                variant="primary"
                onPress={() => navigation.navigate('SwipeBuy' as any)}
                style={styles.emptyBtn}
              >
                Swipe to Buy
              </Button>
              <Button
                variant="secondary"
                onPress={() => navigation.navigate('SwipeSell' as any)}
                style={styles.emptyBtn}
              >
                Swipe to Sell
              </Button>
            </View>
          </View>
        ) : (
          <>
            {/* Match Cards */}
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                currentUserId={user?.id || ''}
                onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface MatchCardProps {
  match: Match;
  currentUserId: string;
  onPress: () => void;
}

function MatchCard({ match, currentUserId, onPress }: MatchCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (match.item?.image_path) {
      getSignedUrlCached(match.item.image_path).then(setImageUrl);
    }
  }, [match]);

  const isBuyer = match.buyer_id === currentUserId;
  const otherUser = isBuyer ? match.seller : match.buyer;
  const role = isBuyer ? 'Buying from' : 'Selling to';

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.matchCard}>
        <View style={styles.matchRow}>
          {/* Item Image */}
          <View style={styles.imageContainer}>
            {imageUrl && <Image source={{ uri: imageUrl }} style={styles.matchImage} />}
          </View>

          {/* Match Info */}
          <View style={styles.matchInfo}>
            <Text variant="headingMedium" size="heading5" style={styles.matchTitle}>
              {match.item?.label || match.item?.category || 'Item'}
            </Text>

            <Text variant="body" size="sm" color="secondary" style={styles.matchRole}>
              {role} {otherUser?.email || 'Unknown user'}
            </Text>

            {match.item?.user_min_price && (
              <Text variant="bodyMedium" size="base" style={styles.matchPrice}>
                ${match.item.user_min_price}
              </Text>
            )}

            <View style={styles.matchFooter}>
              <Badge
                variant={match.match_score >= 75 ? 'success' : 'soft'}
                text={`${match.match_score}% match`}
              />
              <Text variant="body" size="xs" color="muted">
                {new Date(match.created_at).toLocaleDateString()}
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
    paddingVertical: spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    marginBottom: spacing.xl,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyActions: {
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
    maxWidth: 300,
  },
  emptyBtn: {
    width: '100%',
  },
  matchCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  matchRow: {
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
  matchImage: {
    width: '100%',
    height: '100%',
  },
  matchInfo: {
    flex: 1,
  },
  matchTitle: {
    marginBottom: spacing.xs,
  },
  matchRole: {
    marginBottom: spacing.xs,
  },
  matchPrice: {
    marginBottom: spacing.sm,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
