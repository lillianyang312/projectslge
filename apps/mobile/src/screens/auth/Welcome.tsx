import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, typography } from '../../ui/tokens';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

// DEV ONLY: Test accounts for quick login
const DEV_ACCOUNTS = [
  { email: 'gianfrancorandazzopatino@college.harvard.edu', name: 'Gianfranco Randazzo' },
  { email: 'emmanuel_rassou@college.harvard.edu', name: 'Emmanuel Rassou' },
  { email: 'lyang@college.harvard.edu', name: 'Lillian Yang' },
];

export default function WelcomeScreen({ navigation }: Props) {
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const handleGetStarted = () => {
    navigation.navigate('SignupStep1');
  };

  const handleDevLogin = async (email: string, fullName: string) => {
    setLoading(true);
    try {
      console.log(`[DEV] Creating/logging in user: ${email}`);

      const { data, error } = await supabase.functions.invoke('createTestUser', {
        body: { email, fullName },
      });

      if (error) {
        console.error('[DEV] Error:', error);
        Alert.alert('Error', 'Failed to create/login user');
        setLoading(false);
        return;
      }

      if (data?.success && data?.session) {
        console.log('[DEV] Got session, setting...');
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          setSession(sessionData.session);
          Alert.alert('Success', `Logged in as ${fullName}`);
        }
      } else {
        Alert.alert('Error', data?.error || 'Failed to login');
      }
    } catch (err: any) {
      console.error('[DEV] Error:', err);
      Alert.alert('Error', err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {/* Tap logo 5 times to show dev menu */}
        <Pressable onPress={() => setShowDevMenu(!showDevMenu)}>
          <Text
            variant="heading"
            size="md"
            color="muted"
            style={styles.logo}
          >
            @harvard
          </Text>
        </Pressable>

        {showDevMenu && (
          <View style={styles.devMenu}>
            <Text variant="bodyMedium" size="sm" color="muted" style={{ marginBottom: 8 }}>
              DEV: Quick Login
            </Text>
            {DEV_ACCOUNTS.map((account) => (
              <Pressable
                key={account.email}
                style={styles.devButton}
                onPress={() => handleDevLogin(account.email, account.name)}
                disabled={loading}
              >
                <Text variant="body" size="sm" color="accent">
                  {loading ? 'Loading...' : account.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text
          variant="headingMedium"
          size="display"
          color="primary"
          style={styles.headline}
        >
          Sellryte
        </Text>
        <Text
          variant="body"
          size="xl"
          color="secondary"
          style={styles.subtext}
        >
          List what you own. Collect offers. We'll handle the rest.
        </Text>
        <View style={styles.buttons}>
          <Button
            variant="primary"
            onPress={handleGetStarted}
          >
            Get started
          </Button>
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
          >
            I have an account
          </Button>
        </View>
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
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 40,
  },
  logo: {
    marginBottom: spacing.huge,
    letterSpacing: 0.5,
  },
  headline: {
    lineHeight: (typography?.lineHeights?.tight || 1.15) * (typography?.sizes?.display || 36),
    marginBottom: spacing.lg,
  },
  subtext: {
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.xl || 16),
    marginBottom: spacing.huge,
  },
  buttons: {
    gap: spacing.md,
  },
  devMenu: {
    backgroundColor: colors.accentSoft,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  devButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 6,
    marginTop: spacing.xs,
  },
});
