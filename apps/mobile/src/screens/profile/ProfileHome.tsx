import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { Text, Button, Input, Pill } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

type LocationPrecision = 'campus' | 'neighborhood' | 'zip';
type Availability = 'weekdays' | 'weekends' | 'evenings';

export default function ProfileHomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [displayName, setDisplayName] = useState(
    user?.email?.split('@')[0] || 'Lillian'
  );
  const [locationPrecision, setLocationPrecision] = useState<LocationPrecision>('neighborhood');
  const [availability, setAvailability] = useState<Set<Availability>>(
    new Set(['weekdays', 'weekends'])
  );

  const locationOptions: { value: LocationPrecision; label: string }[] = [
    { value: 'campus', label: 'Campus' },
    { value: 'neighborhood', label: 'Neighborhood' },
    { value: 'zip', label: 'Zip-ish' },
  ];

  const availabilityOptions: { value: Availability; label: string }[] = [
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekends', label: 'Weekends' },
    { value: 'evenings', label: 'Evenings' },
  ];

  const toggleAvailability = (value: Availability) => {
    const newSet = new Set(availability);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    setAvailability(newSet);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headingMedium" size="heading2">
            Profile
          </Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>

        {/* Display name */}
        <Input
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How others will see you"
        />

        {/* Location precision */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="sm" color="secondary" style={styles.label}>
            Location precision
          </Text>
          <View style={styles.pills}>
            {locationOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={locationPrecision === option.value}
                onPress={() => setLocationPrecision(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Pickup availability */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="sm" color="secondary" style={styles.label}>
            Pickup availability
          </Text>
          <View style={styles.pills}>
            {availabilityOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={availability.has(option.value)}
                onPress={() => toggleAvailability(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text variant="body" size="sm" style={styles.privacyText}>
            Your exact location is never shared. Meeting points are suggested by the agent.
          </Text>
        </View>

        {/* Messages button */}
        <View style={styles.buttonGroup}>
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('Conversations')}
          >
            Messages
          </Button>
        </View>

        {/* Demo controls section */}
        <View style={styles.demoSection}>
          <Text variant="bodyMedium" size="sm" color="secondary" style={styles.demoTitle}>
            Demo controls
          </Text>
          <View style={styles.demoButtons}>
            <Pressable style={styles.demoBtn}>
              <Text variant="bodyMedium" size="sm">Load demo</Text>
            </Pressable>
            <Pressable style={styles.demoBtn}>
              <Text variant="bodyMedium" size="sm">Reset</Text>
            </Pressable>
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <Button variant="secondary" onPress={handleSignOut}>
            Sign out
          </Button>
        </View>
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
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120, // Space for tab bar
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: colors.accentSoft,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xxl,
  },
  avatarIcon: {
    fontSize: 32,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  privacyNote: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  privacyIcon: {
    fontSize: 16,
  },
  privacyText: {
    flex: 1,
    color: colors.success,
  },
  buttonGroup: {
    marginTop: spacing.xl,
  },
  demoSection: {
    marginTop: spacing.xxl,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  demoTitle: {
    marginBottom: spacing.md,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  signOutSection: {
    marginTop: spacing.xxl,
  },
});

