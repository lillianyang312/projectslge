import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../tokens';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({ title, onBack, rightElement, style }: HeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text size="xxl">←</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text variant="headingMedium" size="heading3" style={styles.title}>
        {title}
      </Text>
      {rightElement || <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl,
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
  title: {
    flex: 1,
  },
  spacer: {
    width: 36,
  },
});

