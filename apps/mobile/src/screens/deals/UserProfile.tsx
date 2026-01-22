import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../../navigation/types';
import { Text, Button, Card } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<DealsStackParamList, 'Profile'>;

interface UserProfileData {
  full_name: string;
  harvard_email: string;
  graduation_year: number | null;
  house: string | null;
  created_at: string;
}

export default function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('full_name, harvard_email, graduation_year, house, created_at')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user profile:', fetchError);
        setError('Unable to load profile. You may only view profiles of users you have accepted deals with.');
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPress = () => {
    if (profile?.harvard_email) {
      Linking.openURL(`mailto:${profile.harvard_email}`);
    }
  };

  const getMemberSince = () => {
    if (!profile?.created_at) return '';
    const date = new Date(profile.created_at);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading2" style={styles.headerTitle}>
            Profile
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text variant="body" color="secondary" style={styles.errorText}>
            {error || 'Profile not found'}
          </Text>
          <Button variant="secondary" onPress={handleBackPress} style={styles.backBtn}>
            Go back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text size="xl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading2" style={styles.headerTitle}>
            Profile
          </Text>
        </View>

        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text variant="headingMedium" size="lg" style={styles.name}>
            {profile.full_name}
          </Text>
          <Text variant="body" size="xs" color="muted" style={styles.memberSince}>
            Member since {getMemberSince()}
          </Text>
        </View>

        {/* Harvard Details */}
        <Text variant="bodyMedium" size="sm" style={styles.sectionTitle}>
          Harvard Details
        </Text>

        <Card style={styles.infoCard}>
          {profile.house && (
            <View style={styles.infoRow}>
              <Text variant="body" size="sm" color="secondary">House</Text>
              <Text variant="body" size="sm">{profile.house}</Text>
            </View>
          )}
          {profile.graduation_year && (
            <View style={[styles.infoRow, !profile.house && styles.infoRowFirst, styles.infoRowLast]}>
              <Text variant="body" size="sm" color="secondary">Class of</Text>
              <Text variant="body" size="sm">{profile.graduation_year}</Text>
            </View>
          )}
        </Card>

        {/* Contact */}
        <Text variant="bodyMedium" size="sm" style={styles.sectionTitle}>
          Contact
        </Text>

        <Pressable onPress={handleEmailPress}>
          <Card style={styles.infoCard}>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text variant="body" size="sm" color="secondary">Email</Text>
              <Text variant="body" size="sm" style={styles.emailLink}>
                {profile.harvard_email}
              </Text>
            </View>
          </Card>
        </Pressable>

        <Text variant="body" size="xs" color="muted" style={styles.contactHint}>
          Tap to send an email
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backBtn: {
    minWidth: 120,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: colors.accentSoft,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarIcon: {
    fontSize: 32,
  },
  name: {
    marginBottom: spacing.xs,
  },
  memberSince: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  infoCard: {
    padding: 0,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRowFirst: {
    borderTopWidth: 0,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  emailLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  contactHint: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
