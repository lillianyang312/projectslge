import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Pressable, ScrollView, Image, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../navigation/types';
import { Text, Card, Badge, Button } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import {
  Listing,
  ListingPhase,
  formatCurrency,
  getPhaseDisplayText,
  hasClarificationData,
  hasNegotiationData,
} from '../../schemas/schema';
import { handleListingError, safeGetListingData } from '../../schemas/errorHandling';

type Props = NativeStackScreenProps<HomeStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const getListingById = useItemsStore((state) => state.getListingById);
  const seedDemoListings = useItemsStore((state) => state.seedDemoListings);
  const [listing, setListing] = useState<Listing | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Seed demo listings if needed
    seedDemoListings();
    
    // Try to get listing by ID (could be legacy item ID or new listing ID)
    const foundListing = getListingById(itemId);
    if (foundListing) {
      setListing(foundListing);
      setError(null);
    } else {
      // Check if it's a legacy item ID and try to find it
      // For now, set error if not found
      setError('Listing not found');
    }
  }, [itemId, getListingById, seedDemoListings]);

  const displayData = listing ? safeGetListingData(listing) : null;

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  if (error && !listing) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Item Detail
          </Text>
        </View>
        <View style={styles.errorContent}>
          <Text variant="body" size="lg" color="danger">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!listing || !displayData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Item Detail
          </Text>
        </View>
        <View style={styles.content}>
          <Text variant="body" size="lg" color="secondary">
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="xxxl">←</Text>
        </Pressable>
        <Text variant="headingMedium" size="heading3">
          Item Detail
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Phase Badge */}
        <View style={styles.badgeContainer}>
          <Badge variant={getPhaseBadgeVariant(listing.phase)}>
            {getPhaseDisplayText(listing.phase)}
          </Badge>
        </View>

        {/* Images */}
        {displayData.imageUris.length > 0 && (
          <View style={styles.imageContainer}>
            {displayData.imageUris.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.image} />
            ))}
          </View>
        )}

        {/* Basic Info */}
        <Card style={styles.section}>
          <Text variant="headingMedium" size="heading3" style={styles.title}>
            {displayData.title}
          </Text>
          <Text variant="body" size="base" color="secondary" style={styles.category}>
            {displayData.category}
          </Text>
          {listing.original.condition && (
            <Badge variant="info" style={styles.conditionBadge}>
              {listing.original.condition}
            </Badge>
          )}
        </Card>

        {/* Description */}
        <Card style={styles.section}>
          <Text variant="bodyMedium" size="md" style={styles.sectionTitle}>
            Description
          </Text>
          <Text variant="body" size="base" color="secondary" style={styles.description}>
            {displayData.description}
          </Text>
          {listing.original.notes && (
            <Text variant="body" size="sm" color="muted" style={styles.notes}>
              {listing.original.notes}
            </Text>
          )}
        </Card>

        {/* Clarification Data */}
        {hasClarificationData(listing) && (
          <Card style={styles.section}>
            <Text variant="bodyMedium" size="md" style={styles.sectionTitle}>
              Location & Details
            </Text>
            {listing.clarification.sellerLocation?.displayAddress && (
              <Text variant="body" size="base" color="secondary">
                📍 {listing.clarification.sellerLocation.displayAddress}
              </Text>
            )}
            {listing.clarification.pickupMethod && (
              <Text variant="body" size="base" color="secondary" style={styles.detailRow}>
                Pickup: {listing.clarification.pickupMethod}
              </Text>
            )}
            {listing.clarification.shippingAvailable !== undefined && (
              <Text variant="body" size="base" color="secondary" style={styles.detailRow}>
                Shipping: {listing.clarification.shippingAvailable ? 'Available' : 'Not available'}
              </Text>
            )}
            {listing.clarification.availability && (
              <Text variant="body" size="base" color="secondary" style={styles.detailRow}>
                Availability: {listing.clarification.availability}
              </Text>
            )}
          </Card>
        )}

        {/* Negotiation Data */}
        {hasNegotiationData(listing) && (
          <>
            <Card style={styles.section}>
              <Text variant="bodyMedium" size="md" style={styles.sectionTitle}>
                Pricing
              </Text>
              {listing.negotiation.estimatedMarketValue && (
                <View style={styles.priceRow}>
                  <Text variant="body" size="base" color="secondary">
                    Estimated Value:
                  </Text>
                  <Text variant="bodyMedium" size="lg">
                    {formatCurrency(listing.negotiation.estimatedMarketValue)}
                  </Text>
                </View>
              )}
              {listing.negotiation.askingPrice && (
                <View style={styles.priceRow}>
                  <Text variant="body" size="base" color="secondary">
                    Asking Price:
                  </Text>
                  <Text variant="bodyMedium" size="lg" style={styles.primaryPrice}>
                    {formatCurrency(listing.negotiation.askingPrice)}
                  </Text>
                </View>
              )}
              {listing.negotiation.minimumPrice && (
                <Text variant="body" size="sm" color="muted">
                  Minimum: {formatCurrency(listing.negotiation.minimumPrice)}
                </Text>
              )}
            </Card>

            {/* Bids */}
            {listing.negotiation.bids.length > 0 && (
              <Card style={styles.section}>
                <Text variant="bodyMedium" size="md" style={styles.sectionTitle}>
                  Bids ({listing.negotiation.bids.filter((b) => b.isActive).length} active)
                </Text>
                {listing.negotiation.bids
                  .filter((bid) => bid.isActive)
                  .sort((a, b) => b.amount - a.amount)
                  .map((bid) => (
                    <View key={bid.id} style={styles.bidCard}>
                      <View style={styles.bidHeader}>
                        <Text variant="bodyMedium" size="base">
                          {bid.buyerName || `Buyer ${bid.buyerId.slice(-6)}`}
                        </Text>
                        <Text variant="headingMedium" size="lg" style={styles.bidAmount}>
                          {formatCurrency(bid.amount)}
                        </Text>
                      </View>
                      {bid.buyerRating && (
                        <View style={styles.bidRating}>
                          <Text variant="body" size="sm" color="secondary">
                            ⭐ {bid.buyerRating.toFixed(1)}
                          </Text>
                          {bid.buyerReviewCount && (
                            <Text variant="body" size="sm" color="muted">
                              ({bid.buyerReviewCount} reviews)
                            </Text>
                          )}
                        </View>
                      )}
                      {bid.message && (
                        <Text variant="body" size="sm" color="muted" style={styles.bidMessage}>
                          "{bid.message}"
                        </Text>
                      )}
                    </View>
                  ))}
              </Card>
            )}
          </>
        )}

        {/* Tags */}
        {listing.original.tags && listing.original.tags.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.tagsContainer}>
              {listing.original.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" style={styles.tag}>
                  {tag}
                </Badge>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getPhaseBadgeVariant(phase: ListingPhase): 'primary' | 'warning' | 'success' | 'info' {
  switch (phase) {
    case ListingPhase.ORIGINAL:
      return 'info';
    case ListingPhase.CLARIFICATION:
      return 'warning';
    case ListingPhase.NEGOTIATION:
      return 'primary';
    case ListingPhase.COMPLETED:
      return 'success';
    default:
      return 'info';
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
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
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  badgeContainer: {
    marginVertical: spacing.lg,
    alignItems: 'flex-start',
  },
  imageContainer: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  section: {
    marginBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  category: {
    marginBottom: spacing.md,
  },
  conditionBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  description: {
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  notes: {
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  detailRow: {
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryPrice: {
    color: colors.accent,
  },
  bidCard: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bidAmount: {
    color: colors.accent,
  },
  bidRating: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  bidMessage: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    marginRight: spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  backButton: {
    marginTop: spacing.md,
  },
});
