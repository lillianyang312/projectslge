import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { DealsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<DealsStackParamList, 'LogisticsShipping'>;

export default function LogisticsShippingScreen({ navigation, route }: Props) {
  const { dealId } = route.params;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Logistics & Shipping</Text>
        <Text style={styles.subtitle}>Deal ID: {dealId}</Text>
        <Text style={styles.text}>Pickup / Shipping Choices & Status</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
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
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
  },
});
