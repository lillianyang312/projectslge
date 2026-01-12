import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Text } from '../ui/components';
import { colors, spacing, typography } from '../ui/tokens';

interface StubScreenProps {
  title: string;
  subtitle?: string;
}

export default function StubScreen({ title, subtitle }: StubScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text variant="headingMedium" size="heading2" style={styles.title}>
          {title}
        </Text>
        {subtitle && (
          <Text
            variant="body"
            size="lg"
            color="secondary"
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        )}
        <Text variant="body" size="base" color="muted" style={styles.note}>
          (Coming soon)
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.lg || 15),
    marginBottom: spacing.xl,
  },
  note: {
    marginTop: spacing.md,
  },
});
