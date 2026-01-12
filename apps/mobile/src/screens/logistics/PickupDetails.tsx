import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card, Input } from '../../ui/components';
import { colors, spacing } from '../../ui/tokens';
import { setLogistics } from '../../services/dealsService';

type Props = NativeStackScreenProps<DealsStackParamList, 'PickupDetails'>;

export default function PickupDetailsScreen({ navigation, route }: Props) {
  const { dealId } = route.params;
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!location || !date) {
      alert('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    const success = await setLogistics(dealId, {
      delivery_method: 'pickup',
      pickup_location: location,
      pickup_date: date,
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
            Pickup Details
          </Text>
        </View>

        <Card style={styles.infoCard}>
          <Text variant="bodyMedium" size="base" style={styles.infoText}>
            Coordinate a safe, public meeting location with the other party.
          </Text>
        </Card>

        <Input
          label="Pickup Location"
          placeholder="E.g., Starbucks on Main St"
          value={location}
          onChangeText={setLocation}
        />

        <Input
          label="Date & Time"
          placeholder="E.g., Tomorrow at 2pm"
          value={date}
          onChangeText={setDate}
        />

        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={submitting || !location || !date}
          style={styles.submitBtn}
        >
          {submitting ? 'Saving...' : 'Confirm Pickup'}
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
