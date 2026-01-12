import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, radius } from '../tokens';

interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Pill({ label, selected = false, onPress, style }: PillProps) {
  return (
    <Pressable
      style={[
        styles.pill,
        selected && styles.pillSelected,
        style,
      ]}
      onPress={onPress}
    >
      <Text
        variant="bodyMedium"
        size="md"
        color={selected ? 'white' : 'primary'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  pillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});

