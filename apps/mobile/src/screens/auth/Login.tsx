import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSavedCreds, setHasSavedCreds] = useState(false);

  const biometricAvailable = useAuthStore((state) => state.biometricAvailable);
  const biometricEnabled = useAuthStore((state) => state.biometricEnabled);
  const biometricType = useAuthStore((state) => state.biometricType);
  const signInWithBiometric = useAuthStore((state) => state.signInWithBiometric);
  const hasSavedCredentials = useAuthStore((state) => state.hasSavedCredentials);

  useEffect(() => {
    const checkCreds = async () => {
      const hasCreds = await hasSavedCredentials();
      setHasSavedCreds(hasCreds);
    };
    checkCreds();
  }, []);

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'facial':
        return '👤';
      case 'fingerprint':
        return '👆';
      default:
        return '🔐';
    }
  };

  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'facial':
        return 'Sign in with Face ID';
      case 'fingerprint':
        return 'Sign in with Touch ID';
      default:
        return 'Sign in with biometrics';
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await signInWithBiometric();
      if (authError) {
        setError(authError.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const validateHarvardEmail = (emailInput: string): boolean => {
    const harvardDomains = [
      '@college.harvard.edu',
      '@fas.harvard.edu',
      '@harvard.edu',
      '@hbs.edu',
      '@hks.harvard.edu',
      '@law.harvard.edu',
      '@gsd.harvard.edu',
      '@hsph.harvard.edu',
    ];
    return harvardDomains.some((domain) => emailInput.toLowerCase().endsWith(domain));
  };

  const handleEmailLogin = async () => {
    Keyboard.dismiss();
    setError('');

    if (!email.trim()) {
      setError('Please enter your Harvard email');
      return;
    }

    if (!validateHarvardEmail(email)) {
      setError('Please enter a valid Harvard email address');
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    setLoading(true);

    try {
      // Check if user exists using the RPC function (works without auth)
      const { data: exists, error: checkError } = await supabase.rpc(
        'check_email_exists',
        { p_email: normalizedEmail }
      );

      if (checkError) {
        console.error('Error checking user:', checkError);
        // Continue to verification even if check fails
      } else if (!exists) {
        // User doesn't exist - prompt to sign up
        setError('No account found with this email. Please sign up first.');
        setLoading(false);
        return;
      }

      // User exists, proceed to verification
      navigation.navigate('VerifyEmail', {
        email: normalizedEmail,
      });
    } catch (err: any) {
      console.error('Error checking user:', err);
      // Continue to verification even if check fails
      navigation.navigate('VerifyEmail', {
        email: normalizedEmail,
      });
    } finally {
      setLoading(false);
    }
  };

  const showBiometricButton = biometricAvailable && biometricEnabled && hasSavedCreds;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="xxl">←</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headingMedium" size="xl" style={styles.title}>
          Welcome back
        </Text>

        <Text variant="body" size="base" color="secondary" style={styles.subtitle}>
          Sign in to see your items, wants, and active deals.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="body" size="sm" style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {showBiometricButton && (
          <>
            <Pressable
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Text style={styles.biometricIcon}>{getBiometricIcon()}</Text>
              <Text variant="bodyMedium" size="sm">
                {getBiometricLabel()}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text variant="body" size="sm" color="muted" style={styles.dividerText}>
                or use email
              </Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        <Input
          label="Harvard email"
          placeholder="you@college.harvard.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          returnKeyType="done"
          onSubmitEditing={handleEmailLogin}
        />

        <Text variant="body" size="xs" color="muted" style={styles.hint}>
          We'll send a verification code to your email.
        </Text>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleEmailLogin}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Continue with email'}
        </Button>

        <Text variant="body" size="sm" color="muted" style={styles.footerText}>
          Don't have an account?{' '}
          <Text
            variant="bodyMedium"
            size="sm"
            color="accent"
            onPress={() => navigation.navigate('SignupStep1')}
          >
            Sign up
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  biometricIcon: {
    fontSize: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
  },
  hint: {
    marginTop: -spacing.sm,
  },
  spacer: {
    height: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerText: {
    textAlign: 'center',
  },
});
