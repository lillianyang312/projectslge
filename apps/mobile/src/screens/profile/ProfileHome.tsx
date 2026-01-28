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
import { ProfileStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

interface UserProfile {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string;
  phone_number: string;
  harvard_email: string;
  graduation_year: number;
  house: string;
  dorm_building: string | null;
  dorm_room: string | null;
  dorm_location: string | null;
  payment_preference: string | null;
  login_preference: string;
  email_verified: boolean;
  created_at: string;
  // Stats
  rating: number | null;
  rating_count: number;
  sales_completed: number;
  purchases_completed: number;
}

export default function ProfileHomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getMemberSince = () => {
    if (!profile?.created_at) return '';
    const date = new Date(profile.created_at);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headingMedium" size="xl">
            Profile
          </Text>
          <Pressable
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text variant="bodyMedium" size="sm" color="accent">
              Edit
            </Text>
          </Pressable>
        </View>

        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text variant="headingMedium" size="lg" style={styles.name}>
            {profile?.full_name || 'User'}
          </Text>
          <Text variant="body" size="sm" color="secondary">
            {profile?.harvard_email || user?.email || ''}
          </Text>
          {profile && (
            <Text variant="body" size="xs" color="muted" style={styles.memberSince}>
              Member since {getMemberSince()}
            </Text>
          )}
        </View>

        {/* Stats Card */}
        {profile && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text variant="headingMedium" size="xl">
                {profile.rating ? profile.rating.toFixed(1) : '—'}
              </Text>
              <Text variant="body" size="xs" color="muted">
                Rating {profile.rating_count > 0 ? `(${profile.rating_count})` : ''}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="headingMedium" size="xl">
                {profile.sales_completed || 0}
              </Text>
              <Text variant="body" size="xs" color="muted">Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="headingMedium" size="xl">
                {profile.purchases_completed || 0}
              </Text>
              <Text variant="body" size="xs" color="muted">Purchases</Text>
            </View>
          </View>
        )}

        {/* Profile Info */}
        {profile && (
          <>
            <Text variant="bodyMedium" size="sm" style={styles.sectionTitle}>
              Harvard Details
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text variant="body" size="sm" color="secondary">House</Text>
                <Text variant="body" size="sm">{profile.house}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="body" size="sm" color="secondary">Class of</Text>
                <Text variant="body" size="sm">{profile.graduation_year}</Text>
              </View>
              {profile.dorm_building && (
                <View style={styles.infoRow}>
                  <Text variant="body" size="sm" color="secondary">Building</Text>
                  <Text variant="body" size="sm">{profile.dorm_building}</Text>
                </View>
              )}
              {profile.dorm_room && (
                <View style={styles.infoRow}>
                  <Text variant="body" size="sm" color="secondary">Room</Text>
                  <Text variant="body" size="sm">{profile.dorm_room}</Text>
                </View>
              )}
              {profile.dorm_location && (
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text variant="body" size="sm" color="secondary">Location notes</Text>
                  <Text variant="body" size="sm" numberOfLines={2} style={styles.locationText}>
                    {profile.dorm_location}
                  </Text>
                </View>
              )}
            </View>

            <Text variant="bodyMedium" size="sm" style={styles.sectionTitle}>
              Contact
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text variant="body" size="sm" color="secondary">Email</Text>
                <Text variant="body" size="sm" numberOfLines={1} style={styles.emailText}>
                  {profile.harvard_email}
                </Text>
              </View>
              {profile.phone_number && (
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text variant="body" size="sm" color="secondary">Phone</Text>
                  <Text variant="body" size="sm">{formatPhoneNumber(profile.phone_number)}</Text>
                </View>
              )}
            </View>

            {/* Payment Preferences */}
            {profile.payment_preference && (
              <>
                <Text variant="bodyMedium" size="sm" style={styles.sectionTitle}>
                  Payment
                </Text>

                <View style={styles.infoCard}>
                  <View style={[styles.infoRow, styles.infoRowLast]}>
                    <Text variant="body" size="sm" color="secondary">Accepted</Text>
                    <Text variant="body" size="sm">
                      {profile.payment_preference.split(',').join(', ')}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* Sign out */}
        <Button variant="secondary" onPress={handleSignOut} style={styles.signOutBtn}>
          Sign out
        </Button>

        <View style={styles.bottomSpacer} />
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  editBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
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
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
  infoRowLast: {
    borderBottomWidth: 0,
  },
  emailText: {
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  locationText: {
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  signOutBtn: {
    marginTop: spacing.lg,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
