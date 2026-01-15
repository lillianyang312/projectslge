import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../tokens';

type PriceKind =
  | 'listing_price'
  | 'buyer_bid'
  | 'seller_counter'
  | 'agreed_price'
  | 'market_low'
  | 'market_high'
  | 'our_take';

export interface PriceReference {
  kind: PriceKind;
  amount: number;
  currency?: string;
  itemId?: string;
  dealId?: string;
}

interface RichPriceTextProps {
  text: string;
  references?: PriceReference[];
  /**
   * Base text color name for non-pill text.
   * Mirrors the `Text` component's color prop.
   */
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'blue' | 'white';
  /**
   * Font size token for message text.
   */
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'heading3' | 'heading2' | 'heading1' | 'display';
}

/**
 * Lightweight rich-text renderer that scans for price-like tokens
 * in the message text (e.g., "$550") and, when those amounts match
 * structured PriceReference entries, renders them as inline pill tags.
 *
 * This component is intentionally conservative: only exact numeric
 * matches (e.g., "550") that also appear in `references` are pill-ified.
 */
export function RichPriceText({
  text,
  references,
  color = 'primary',
  size = 'base',
}: RichPriceTextProps) {
  if (!text || !references || references.length === 0) {
    return (
      <Text variant="body" size={size} color={color}>
        {text}
      </Text>
    );
  }

  // Map amount -> first reference for styling.
  const byAmount = new Map<number, PriceReference>();
  for (const ref of references) {
    if (!byAmount.has(ref.amount)) {
      byAmount.set(ref.amount, ref);
    }
  }

  // Regex for price-like tokens: "$550", "550", "550.00"
  const priceRegex = /\$?\d+(?:\.\d+)?/g;
  const segments: React.ReactNode[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // eslint-disable-next-line no-cond-assign
  while ((match = priceRegex.exec(text)) !== null) {
    const [raw] = match;
    const start = match.index;
    const end = start + raw.length;

    if (start > lastIndex) {
      const plain = text.slice(lastIndex, start);
      segments.push(
        <Text key={`t-${key++}`} variant="body" size={size} color={color}>
          {plain}
        </Text>,
      );
    }

    const numeric = parseFloat(raw.replace('$', ''));
    const ref = byAmount.get(numeric);

    if (ref) {
      segments.push(
        <Text
          key={`p-${key++}`}
          variant="bodyMedium"
          size={size}
          color={pillColorForKind(ref.kind)}
          style={styles.pill}
        >
          {formatDisplayAmount(raw, ref)}
        </Text>,
      );
    } else {
      // No structured reference – render as plain text
      segments.push(
        <Text key={`t-${key++}`} variant="body" size={size} color={color}>
          {raw}
        </Text>,
      );
    }

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex);
    segments.push(
      <Text key={`t-${key++}`} variant="body" size={size} color={color}>
        {trailing}
      </Text>,
    );
  }

  // Wrap in a parent Text so React Native treats it as a single text node.
  return (
    <Text variant="body" size={size} color={color} style={styles.container}>
      {segments}
    </Text>
  );
}

function pillColorForKind(kind: PriceKind) {
  switch (kind) {
    case 'listing_price':
      return 'blue';
    case 'buyer_bid':
    case 'seller_counter':
      return 'success';
    case 'agreed_price':
      return 'purple';
    case 'market_low':
    case 'market_high':
      return 'secondary';
    case 'our_take':
      return 'warning';
    default:
      return 'primary';
  }
}

function formatDisplayAmount(raw: string, ref: PriceReference) {
  // Prefer the currency symbol from the raw text if present,
  // otherwise fall back to USD-style formatting.
  const hasDollar = raw.trim().startsWith('$');
  const amount = ref.amount;

  if (hasDollar) return raw;

  return `$${amount}`;
}

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginHorizontal: 1,
  },
});


