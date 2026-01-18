import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, ViewStyle } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { colors, spacing, radius, typography } from '../tokens';

interface BroadcastAnnouncementProps {
  onSend?: (message: string) => void | Promise<void>;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  style?: ViewStyle;
}

export function BroadcastAnnouncement({
  onSend,
  label = '🔈Broadcast announcement to all interested buyers',
  placeholder = 'Type your announcement message...',
  maxLength = 500,
  style,
}: BroadcastAnnouncementProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) {
      return;
    }

    if (onSend) {
      onSend(message);
    }

    // Clear message after sending
    setMessage('');
  };

  return (
    <Card style={[styles.card, style]}>
      <Text variant="bodyMedium" size="base" style={styles.label}>
        {label}
      </Text>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={maxLength}
        textAlignVertical="top"
      />
      <View style={styles.actions}>
        <Text variant="body" size="xs" color="secondary" style={styles.charCount}>
          {message.length}/{maxLength}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (!message.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Text variant="bodyMedium" size="sm" color="white">
            Send
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.body,
    color: colors.textPrimary,
    minHeight: 100,
    maxHeight: 150,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    flex: 1,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: colors.bgAlt,
    opacity: 0.5,
  },
});

