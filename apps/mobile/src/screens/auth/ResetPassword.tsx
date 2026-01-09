import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, typography } from '../../ui/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.icon}>✉️</Text>
        <Text variant="headingMedium" size="heading3" style={styles.title}>
          Check your email
        </Text>
        <Text variant="body" size="lg" color="secondary" style={styles.message}>
          We've sent a password reset link to your email address. It may take a few
          minutes to arrive.
        </Text>
        <Button variant="secondary" onPress={() => navigation.navigate('Auth')}>
          Back to sign in
        </Button>
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
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.md,
  },
  message: {
    textAlign: 'center',
    lineHeight: typography.lineHeights.relaxed * typography.sizes.lg,
    marginBottom: spacing.xxxl,
  },
});
