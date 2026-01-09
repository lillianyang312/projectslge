import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { DealsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<DealsStackParamList, 'DealDetail'>;

export default function DealDetailScreen({ navigation, route }: Props) {
  const { dealId } = route.params;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Deal Detail</Text>
        <Text style={styles.subtitle}>Deal ID: {dealId}</Text>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('LogisticsShipping', { dealId })}
        >
          <Text style={styles.buttonText}>Logistics & Shipping →</Text>
        </Pressable>
        <Pressable
          style={[styles.button, { marginTop: 12 }]}
          onPress={() => navigation.navigate('DealChat', { dealId })}
        >
          <Text style={styles.buttonText}>Deal Chat →</Text>
        </Pressable>
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
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
  },
});
