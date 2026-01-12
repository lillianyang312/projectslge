import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, shadows } from '../tokens';

interface FABProps {
  onPress: () => void;
  icon?: string;
}

export function FAB({ onPress, icon = '+' }: FABProps) {
  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 92, // Touching tab bar
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: colors.accent,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    zIndex: 100,
  },
  icon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
  },
});
