import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, shadows } from '../tokens';

interface SwipeActionsProps {
  onReject: () => void;
  onSave: () => void;
  onAccept: () => void;
}

export function SwipeActions({ onReject, onSave, onAccept }: SwipeActionsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.rejectButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onReject}
      >
        <Text style={styles.rejectIcon}>✕</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.saveButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onSave}
      >
        <Text style={styles.saveIcon}>☆</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.acceptButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onAccept}
      >
        <Text style={styles.acceptIcon}>✓</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonPressed: {
    transform: [{ scale: 1.1 }],
  },
  rejectButton: {
    backgroundColor: colors.dangerSoft,
  },
  saveButton: {
    backgroundColor: colors.warningSoft,
  },
  acceptButton: {
    backgroundColor: colors.successSoft,
  },
  rejectIcon: {
    fontSize: 24,
    color: colors.danger,
  },
  saveIcon: {
    fontSize: 24,
    color: colors.warning,
  },
  acceptIcon: {
    fontSize: 24,
    color: colors.success,
  },
});

