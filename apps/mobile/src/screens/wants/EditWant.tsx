import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WantsStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import {
  getWantById as getSupabaseWantById,
  updateWant as updateSupabaseWant,
  deleteWant as deleteSupabaseWant,
} from '../../services/supabaseWantsService';
import {
  getWantById as getLocalWantById,
  updateWant as updateLocalWant,
  deleteWant as deleteLocalWant,
  WantUrgency,
  WantDeliveryPref,
} from '../../services/wantsService';

// Map Supabase urgency to display urgency
type SupabaseUrgency = 'low' | 'normal' | 'high';
const mapFromSupabaseUrgency = (urgency: SupabaseUrgency): WantUrgency => {
  const map: Record<SupabaseUrgency, WantUrgency> = {
    low: 'casual',
    normal: 'interested',
    high: 'urgent',
  };
  return map[urgency];
};

const mapToSupabaseUrgency = (urgency: WantUrgency): SupabaseUrgency => {
  const map: Record<WantUrgency, SupabaseUrgency> = {
    casual: 'low',
    interested: 'normal',
    urgent: 'high',
  };
  return map[urgency];
};

type Props = NativeStackScreenProps<WantsStackParamList, 'EditWant'>;

export default function EditWantScreen({ navigation, route }: Props) {
  const { wantId } = route.params;
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [urgency, setUrgency] = useState<WantUrgency>('interested');
  const [deliveryPref, setDeliveryPref] = useState<WantDeliveryPref>('local_only');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSupabaseWant, setIsSupabaseWant] = useState(false);

  useEffect(() => {
    loadWant();
  }, [wantId]);

  const loadWant = async () => {
    // Check if it's a demo want
    if (wantId.startsWith('demo-')) {
      // Handle demo wants locally
      setLoading(false);
      return;
    }

    if (user) {
      // Try to fetch from Supabase first
      const { data, error } = await getSupabaseWantById(wantId);
      if (!error && data) {
        setQuery(data.query);
        setMaxPrice(data.max_price ? data.max_price.toString() : '');
        setUrgency(mapFromSupabaseUrgency(data.urgency));
        setDeliveryPref(data.delivery_pref as WantDeliveryPref);
        setIsSupabaseWant(true);
        setLoading(false);
        return;
      }
    }

    // Fall back to local storage
    const want = await getLocalWantById(wantId);
    if (want) {
      setQuery(want.query);
      setMaxPrice(want.max_price ? want.max_price.toString() : '');
      setUrgency(want.urgency);
      setDeliveryPref(want.delivery_pref);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!query.trim()) {
      Alert.alert('Missing Information', 'Please enter what you\'re looking for');
      return;
    }

    setSubmitting(true);
    try {
      if (isSupabaseWant && user) {
        // Update in Supabase
        const { error } = await updateSupabaseWant(wantId, {
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
        // Update locally
        await updateLocalWant(wantId, {
          query: query.trim(),
          max_price: maxPrice ? parseFloat(maxPrice) : undefined,
          urgency,
          delivery_pref: deliveryPref,
        });
      }

      setIsEditing(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update want');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Want',
      'Are you sure you want to delete this want?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isSupabaseWant && user) {
              await deleteSupabaseWant(wantId);
            } else {
              await deleteLocalWant(wantId);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

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
        {/* Header with back arrow, title, and edit button */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3" style={styles.headerTitle}>
            {query || 'Edit want'}
          </Text>
          <Pressable style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
            <Text variant="bodyMedium" size="md" color="primary">
              {isEditing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
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

        {/* Action Buttons - only visible in edit mode */}
        {isEditing && (
          <>
            <Button
              variant="primary"
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </Button>

            <Button
              variant="secondary"
              onPress={handleDelete}
              style={styles.deleteBtn}
            >
              Delete want
            </Button>
          </>
        )}
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
  loader: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
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
  headerTitle: {
    flex: 1,
    marginLeft: spacing.md,
  },
  editBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
  deleteBtn: {
    marginTop: 12,
  },
});
