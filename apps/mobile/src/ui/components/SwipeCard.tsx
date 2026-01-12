import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Badge } from './Badge';
import { colors, spacing, radius, shadows, typography } from '../tokens';

interface SwipeCardProps {
  emoji: string;
  title: string;
  subtitle?: string;
  badges: Array<{
    label: string;
    variant: 'success' | 'warning' | 'neutral' | 'danger' | 'purple' | 'blue';
  }>;
  leftLabel: string;
  leftValue: string;
  leftSubtext?: string;
  rightLabel: string;
  rightValue: string;
  rightSubtext?: string;
  leftValueColor?: string;
  gradientColor?: string;
  style?: ViewStyle;
}

export function SwipeCard({
  emoji,
  title,
  subtitle,
  badges,
  leftLabel,
  leftValue,
  leftSubtext,
  rightLabel,
  rightValue,
  rightSubtext,
  leftValueColor,
  gradientColor,
  style,
}: SwipeCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View
        style={[
          styles.imageArea,
          gradientColor && { backgroundColor: gradientColor },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.content}>
        {subtitle && (
          <Text variant="body" size="base" color="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
        <Text variant="bodySemiBold" size="xxxl" style={styles.title}>
          {title}
        </Text>
        <View style={styles.badges}>
          {badges.map((badge, index) => (
            <Badge key={index} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </View>
        <View style={styles.pricesContainer}>
          <View style={styles.priceCol}>
            <Text variant="body" size="xs" color="muted" style={styles.priceLabel}>
              {leftLabel}
            </Text>
            <Text
              variant="heading"
              size="xxxl"
              style={[styles.priceValue, leftValueColor && { color: leftValueColor }]}
            >
              {leftValue}
            </Text>
            {leftSubtext && (
              <Text variant="body" size="xs" color="muted" style={styles.priceSubtext}>
                {leftSubtext}
              </Text>
            )}
          </View>
          <View style={[styles.priceCol, styles.priceColRight]}>
            <Text variant="body" size="xs" color="muted" style={styles.priceLabel}>
              {rightLabel}
            </Text>
            <Text variant="heading" size="xxxl" style={styles.priceValue}>
              {rightValue}
            </Text>
            {rightSubtext && (
              <Text variant="body" size="xs" color="muted" style={styles.priceSubtext}>
                {rightSubtext}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadows.lg,
    marginBottom: spacing.xxl,
  },
  imageArea: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 64,
  },
  content: {
    padding: spacing.xl,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pricesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceCol: {
    alignItems: 'flex-start',
  },
  priceColRight: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  priceValue: {
    fontFamily: typography?.fonts?.heading || 'Fraunces_400Regular',
  },
  priceSubtext: {
    marginTop: 4,
  },
});

