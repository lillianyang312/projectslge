import React from 'react';
import {
  Pressable,
  StyleSheet,
  ViewStyle,
  PressableProps,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../tokens';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSmall = size === 'sm';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isSmall ? styles.sm : styles.md,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : colors.textPrimary} />
      ) : (
        <Text
          variant="bodyMedium"
          size={isSmall ? 'md' : 'lg'}
          color={isPrimary ? 'white' : 'primary'}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    width: '100%',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  md: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  sm: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
