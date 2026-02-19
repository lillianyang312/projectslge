import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Input } from '../../ui/components';
import { colors, spacing } from '../../ui/tokens';
import { setLogistics } from '../../services/dealsService';

type Props = NativeStackScreenProps<DealsStackParamList, 'Shipping'>;

export default function ShippingScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!address) {
      alert('Please enter shipping address');
      return;
    }

    setSubmitting(true);
    const success = await setLogistics(dealId, {
      delivery_method: 'shipping',
      shipping_address: address,
    });
    setSubmitting(false);

    if (success) {
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Shipping Details
          </Text>
        </View>

        <Card style={styles.infoCard}>
          <Text variant="bodyMedium" size="base" style={styles.infoText}>
            Enter the shipping address. We'll help track the package once the owner provides tracking info.
          </Text>
        </Card>

        <Input
          label="Shipping Address"
          placeholder="Full address including ZIP"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
        />

        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={submitting || !address}
          style={styles.submitBtn}
        >
          {submitting ? 'Saving...' : 'Confirm Address'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
  infoCard: {
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.xl,
  },
  infoText: {
    lineHeight: 22,
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
