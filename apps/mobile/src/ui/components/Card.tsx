import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { colors, radius, spacing, shadows } from '../tokens';

interface CardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  pressable?: boolean;
  style?: ViewStyle;
}

export function Card({ children, pressable = false, style, ...props }: CardProps) {
  if (pressable) {
    return (
      <Pressable
        style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.base, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
