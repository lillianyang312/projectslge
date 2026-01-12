import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, radius } from '../tokens';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'purple' | 'blue' | 'primary' | 'info' | 'secondary' | 'soft';

interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  text?: string; // Legacy prop for backward compatibility
  style?: ViewStyle;
}

const variantStyles = {
  neutral: {
    backgroundColor: colors.accentSoft,
    textColor: 'secondary' as const,
  },
  success: {
    backgroundColor: colors.successSoft,
    textColor: 'success' as const,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    textColor: 'warning' as const,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    textColor: 'danger' as const,
  },
  purple: {
    backgroundColor: colors.purpleSoft,
    textColor: 'purple' as const,
  },
  blue: {
    backgroundColor: colors.blueSoft,
    textColor: 'blue' as const,
  },
  primary: {
    backgroundColor: colors.accent,
    textColor: 'white' as const,
  },
  info: {
    backgroundColor: colors.blueSoft,
    textColor: 'blue' as const,
  },
  secondary: {
    backgroundColor: colors.accentSoft,
    textColor: 'secondary' as const,
  },
  soft: {
    backgroundColor: colors.accentSoft,
    textColor: 'secondary' as const,
  },
};

export function Badge({ variant = 'neutral', children, text, style }: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const displayContent = children ?? text;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: variantStyle.backgroundColor },
        style,
      ]}
    >
      <Text
        variant="bodyMedium"
        size="sm"
        color={variantStyle.textColor}
      >
        {displayContent}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
