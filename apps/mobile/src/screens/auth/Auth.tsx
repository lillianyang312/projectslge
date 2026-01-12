import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Auth'>;

export default function AuthScreen({ navigation, route }: Props) {
  const initialMode = (route.params as any)?.mode || 'signup';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);

  useEffect(() => {
    if ((route.params as any)?.mode) {
      setMode((route.params as any).mode);
    }
  }, [(route.params as any)?.mode]);

  const isLogin = mode === 'login';

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: authError } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authError) {
        setError(authError.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>
        </View>

        <Text variant="body" size="lg" color="secondary" style={styles.subtitle}>
          {isLogin
            ? 'Sign in to see your items, wants, and active deals.'
            : 'Join thousands of people passively buying and selling in their neighborhood.'}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="body" size="base" style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <Input
          label="Email"
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Input
          label="Password"
          placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!isLogin && (
          <>
            <Input
              label="Display name"
              placeholder="How others will see you"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <Input
              label="Your neighborhood"
              placeholder="ZIP code or neighborhood"
              value={neighborhood}
              onChangeText={setNeighborhood}
            />
            <Text variant="body" size="sm" color="muted" style={styles.hint}>
              We'll show you items nearby. Your exact location is never shared.
            </Text>
          </>
        )}

        {isLogin && (
          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text
              variant="body"
              size="base"
              color="secondary"
              style={styles.forgotLink}
            >
              Forgot password?
            </Text>
          </Pressable>
        )}

        <Button
          variant="primary"
          onPress={handleSubmit}
          style={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Loading...' : isLogin ? 'Sign in' : 'Create account'}
        </Button>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text variant="body" size="base" color="muted" style={styles.dividerText}>
            or continue with
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <Button variant="secondary" style={styles.socialBtn}>
            <Text variant="bodyMedium" size="md">
              G
            </Text>
            {' Google'}
          </Button>
          <Button variant="secondary" style={styles.socialBtn}>
            {'🍎 Apple'}
          </Button>
        </View>

        <Text variant="body" size="base" color="secondary" style={styles.footer}>
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <Text
                variant="bodyMedium"
                size="base"
                color="accent"
                onPress={() => navigation.navigate('Auth', { mode: 'signup' } as any)}
              >
                Sign up
              </Text>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Text
                variant="bodyMedium"
                size="base"
                color="accent"
                onPress={() => navigation.navigate('Auth', { mode: 'login' } as any)}
              >
                Sign in
              </Text>
            </>
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
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
    lineHeight: typography.lineHeights.relaxed * typography.sizes.lg,
    marginBottom: spacing.xxxl,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xxl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  toggleBtnActive: {
    backgroundColor: colors.card,
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hint: {
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
  },
  forgotLink: {
    textAlign: 'right',
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
  },
  submitBtn: {
    marginTop: spacing.xxl,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.lg,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialBtn: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
  },
});
