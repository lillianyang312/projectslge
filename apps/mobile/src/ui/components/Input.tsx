import React, { forwardRef } from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, typography } from '../tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const InputComponent = forwardRef<TextInput, InputProps>(
  function Input({ label, error, style, ...props }, ref) {
    return (
      <View style={styles.container}>
        {label && (
          <Text variant="body" size="sm" color="secondary" style={styles.label}>
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
        {error && (
          <Text variant="body" size="sm" color="danger" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

export const Input = InputComponent;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  input: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: typography?.sizes?.sm || 14,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: spacing.xs,
  },
});
