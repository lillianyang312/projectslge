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

  const [displayName, setDisplayName] = useState('Lillian');
  const [location, setLocation] = useState('San Francisco, CA');
  const [availability, setAvailability] = useState<Set<Availability>>(
    new Set(['weekdays', 'weekends'])
  );

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

        {/* Display name - matching HTML spec line 1225 */}
        <Input
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How others will see you"
        />

        {/* Location - matching HTML spec line 1230 */}
        <Input
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="City or neighborhood"
        />

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

        {/* Privacy note - matching HTML spec lines 1243-1246 */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text variant="body" size="sm" style={styles.privacyText}>
            Your exact location is never shared.
          </Text>
        </View>

        {/* Sign out - matching HTML spec line 1248 */}
        <Button variant="secondary" onPress={handleSignOut}>
          Sign out
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
});

