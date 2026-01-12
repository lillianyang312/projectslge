import React from 'react';
import { View, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, typography } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);

  const handleGuestMode = () => {
    continueAsGuest(); // Set isAuthed to true to go to app
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text
          variant="heading"
          size="md"
          color="muted"
          style={styles.logo}
        >
          passive
        </Text>
        <Text
          variant="headingMedium"
          size="display"
          color="primary"
          style={styles.headline}
        >
          Passive{'\n'}shopping
        </Text>
        <Text
          variant="body"
          size="xl"
          color="secondary"
          style={styles.subtext}
        >
          List what you own. Share what you want. We'll handle the rest.
        </Text>
        <View style={styles.buttons}>
          <Button
            variant="primary"
            onPress={() => navigation.navigate('Auth', { mode: 'signup' } as any)}
          >
            Get started
          </Button>
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('Auth', { mode: 'login' } as any)}
          >
            I have an account
          </Button>
        </View>
        <Pressable onPress={handleGuestMode} style={styles.guestButton}>
          <Text
            variant="body"
            size="base"
            color="muted"
            style={styles.guestText}
          >
            Continue as a guest
          </Text>
        </Pressable>
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
    lineHeight: typography.lineHeights.tight * typography.sizes.display,
    marginBottom: spacing.lg,
  },
  subtext: {
    lineHeight: typography.lineHeights.relaxed * typography.sizes.xl,
    marginBottom: spacing.huge,
  },
  buttons: {
    gap: spacing.md,
  },
  guestButton: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
  },
  guestText: {
    textDecorationLine: 'underline',
  },
});
