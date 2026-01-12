import React from 'react';
import { View, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, typography } from '../../ui/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Reset password
          </Text>
        </View>

        <Text variant="body" size="lg" color="secondary" style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <Input
          label="Email"
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Button
          variant="primary"
          onPress={() => navigation.navigate('ResetPassword')}
          style={styles.submitBtn}
        >
          Send reset link
        </Button>

        <Text variant="body" size="base" color="secondary" style={styles.footer}>
          Remember your password?{' '}
          <Text
            variant="bodyMedium"
            size="base"
            color="accent"
            onPress={() => navigation.navigate('Auth')}
          >
            Sign in
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xxl,
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
  subtitle: {
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.lg || 15),
    marginBottom: spacing.xxxl,
  },
  submitBtn: {
    marginTop: spacing.xxl,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
