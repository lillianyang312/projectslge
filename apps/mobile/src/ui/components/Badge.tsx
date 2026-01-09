import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../tokens';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'purple' | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
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
};

export function Badge({ variant = 'neutral', children, style }: BadgeProps) {
  const variantStyle = variantStyles[variant];

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
        {children}
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
