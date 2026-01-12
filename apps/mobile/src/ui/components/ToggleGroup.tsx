import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from '../tokens';

interface ToggleGroupProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ToggleGroup({ options, selectedIndex, onSelect }: ToggleGroupProps) {
  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <Pressable
          key={index}
          style={[styles.button, selectedIndex === index && styles.buttonActive]}
          onPress={() => onSelect(index)}
        >
          <Text
            style={[
              styles.buttonText,
              selectedIndex === index && styles.buttonTextActive,
            ]}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  buttonTextActive: {
    color: colors.textPrimary,
  },
});
