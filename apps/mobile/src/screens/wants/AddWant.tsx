import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WantsStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { createWant as createSupabaseWant } from '../../services/supabaseWantsService';
import { createWant as createLocalWant, WantUrgency, WantDeliveryPref } from '../../services/wantsService';

// Map display urgency to Supabase urgency
type SupabaseUrgency = 'low' | 'normal' | 'high';
const mapToSupabaseUrgency = (urgency: WantUrgency): SupabaseUrgency => {
  const map: Record<WantUrgency, SupabaseUrgency> = {
    casual: 'low',
    interested: 'normal',
    urgent: 'high',
  };
  return map[urgency];
};

type Props = NativeStackScreenProps<WantsStackParamList, 'AddWant'>;

export default function AddWantScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [urgency, setUrgency] = useState<WantUrgency>('interested');
  const [deliveryPref, setDeliveryPref] = useState<WantDeliveryPref>('local_only');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim()) {
      Alert.alert('Missing Information', 'Please enter what you\'re looking for');
      return;
    }

    setSubmitting(true);
    try {
      if (user) {
        // Save to Supabase for authenticated users
        const { error } = await createSupabaseWant({
          query: query.trim(),
          max_price: maxPrice ? parseFloat(maxPrice) : undefined,
          urgency: mapToSupabaseUrgency(urgency),
          delivery_pref: deliveryPref,
        });

        if (error) {
          Alert.alert('Error', error);
          return;
        }
      } else {
        // Save locally for guest users
        await createLocalWant({
          query: query.trim(),
          max_price: maxPrice ? parseFloat(maxPrice) : undefined,
          urgency,
          delivery_pref: deliveryPref,
        });
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create want');
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyOptions: { value: WantUrgency; label: string }[] = [
    { value: 'casual', label: 'Casual' },
    { value: 'interested', label: 'Interested' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const deliveryOptions: { value: WantDeliveryPref; label: string }[] = [
    { value: 'local_only', label: 'Local only' },
    { value: 'shipping_ok', label: 'Shipping OK' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Add want
          </Text>
        </View>

        <Input
          label="What are you looking for?"
          placeholder="e.g. Standing desk, vintage lamp..."
          value={query}
          onChangeText={setQuery}
        />

        <Input
          label="Max price"
          placeholder="$0"
          value={maxPrice}
          onChangeText={setMaxPrice}
          keyboardType="numeric"
        />

        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            How urgently?
          </Text>
          <View style={styles.pills}>
            {urgencyOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.pill, urgency === option.value && styles.pillActive]}
                onPress={() => setUrgency(option.value)}
              >
                <Text
                  variant="bodyMedium"
                  size="md"
                  color={urgency === option.value ? 'white' : 'primary'}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            Delivery preference
          </Text>
          <View style={styles.pills}>
            {deliveryOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.pill, deliveryPref === option.value && styles.pillActive]}
                onPress={() => setDeliveryPref(option.value)}
              >
                <Text
                  variant="bodyMedium"
                  size="md"
                  color={deliveryPref === option.value ? 'white' : 'primary'}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={submitting}
          style={styles.submitBtn}
        >
          {submitting ? 'Adding...' : 'Add want'}
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
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingBottom: 24,
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 6,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  submitBtn: {
    marginTop: 24,
  },
});
