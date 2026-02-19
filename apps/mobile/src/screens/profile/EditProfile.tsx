import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Keyboard,
  TextInput as RNTextInput,
  findNodeHandle,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

const harvardHouses = [
  'Adams', 'Cabot', 'Currier', 'Dunster', 'Eliot', 'Kirkland',
  'Leverett', 'Lowell', 'Mather', 'Pforzheimer', 'Quincy', 'Winthrop',
  'Dudley', 'Off-campus',
];

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 8 }, (_, i) => String(currentYear - 2 + i));

const paymentOptions = ['Cash', 'Zelle', 'Venmo'] as const;
type PaymentMethod = typeof paymentOptions[number];

export default function EditProfileScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [house, setHouse] = useState('');
  const [dormBuilding, setDormBuilding] = useState('');
  const [dormRoom, setDormRoom] = useState('');
  const [dormLocation, setDormLocation] = useState('');
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentMethod[]>([]);
  const [zelleHandle, setZelleHandle] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');

  // Dropdowns
  const [showHouseDropdown, setShowHouseDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const phoneInputRef = useRef<RNTextInput>(null);
  const buildingInputRef = useRef<RNTextInput>(null);
  const roomInputRef = useRef<RNTextInput>(null);
  const dormLocationInputRef = useRef<RNTextInput>(null);
  const zelleInputRef = useRef<RNTextInput>(null);
  const venmoInputRef = useRef<RNTextInput>(null);

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
      } else if (data) {
        // Handle first/last name - fallback to splitting full_name if separate fields not set
        if (data.first_name) {
          setFirstName(data.first_name);
          setLastName(data.last_name || '');
        } else if (data.full_name) {
          const nameParts = data.full_name.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        }
        setPhone(formatPhoneNumber(data.phone_number || ''));
        setGraduationYear(data.graduation_year?.toString() || '');
        setHouse(data.house || '');
        setDormBuilding(data.dorm_building || '');
        setDormRoom(data.dorm_room || '');
        setDormLocation(data.dorm_location || '');
        // Parse payment preferences from comma-separated string
        if (data.payment_preference) {
          const prefs = data.payment_preference.split(',').map((p: string) => p.trim()) as PaymentMethod[];
          setPaymentPreferences(prefs.filter(p => paymentOptions.includes(p)));
        }
        setZelleHandle(data.zelle_handle || '');
        setVenmoHandle(data.venmo_handle || '');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const scrollToInput = (inputRef: React.RefObject<RNTextInput>) => {
    setTimeout(() => {
      if (inputRef.current && scrollViewRef.current) {
        const nodeHandle = findNodeHandle(inputRef.current);
        if (nodeHandle) {
          scrollViewRef.current.scrollResponderScrollNativeHandleToKeyboard(
            nodeHandle,
            120,
            true
          );
        }
      }
    }, 100);
  };

  const closeDropdowns = () => {
    setShowHouseDropdown(false);
    setShowYearDropdown(false);
  };

  const togglePaymentPreference = (method: PaymentMethod) => {
    setPaymentPreferences(prev => {
      if (prev.includes(method)) {
        return prev.filter(p => p !== method);
      }
      return [...prev, method];
    });
  };

  const handleSave = async () => {
    Keyboard.dismiss();

    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (!graduationYear) {
      Alert.alert('Error', 'Please select your graduation year');
      return;
    }

    if (!house) {
      Alert.alert('Error', 'Please select your house');
      return;
    }

    setSaving(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phoneDigits || null,
          graduation_year: parseInt(graduationYear),
          house,
          dorm_building: dormBuilding.trim() || null,
          dorm_room: dormRoom.trim() || null,
          dorm_location: dormLocation.trim() || null,
          payment_preference: paymentPreferences.length > 0 ? paymentPreferences.join(',') : null,
          zelle_handle: paymentPreferences.includes('Zelle') ? zelleHandle.trim() || null : null,
          venmo_handle: paymentPreferences.includes('Venmo') ? venmoHandle.trim() || null : null,
        })
        .eq('id', user?.id);

      if (error) {
        Alert.alert('Error', 'Failed to save changes. Please try again.');
        console.error('Error updating profile:', error);
      } else {
        Alert.alert('Success', 'Your profile has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="xxl">←</Text>
        </Pressable>
        <Text variant="headingMedium" size="lg">Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closeDropdowns}
      >
        {/* Name Row */}
        <View style={styles.rowInputs}>
          <View style={styles.halfInput}>
            <Input
              label="First name"
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              onFocus={closeDropdowns}
            />
          </View>
          <View style={styles.halfInput}>
            <Input
              label="Last name"
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              onFocus={closeDropdowns}
            />
          </View>
        </View>

        <Input
          ref={phoneInputRef}
          label="Phone number"
          placeholder="(617) 555-1234"
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          autoComplete="tel"
          onFocus={() => {
            closeDropdowns();
            scrollToInput(phoneInputRef);
          }}
        />

        <View style={styles.rowInputs}>
          {/* Graduation Year */}
          <View style={[styles.halfInput, { zIndex: showYearDropdown ? 20 : 10 }]}>
            <Text variant="body" size="sm" color="secondary" style={styles.label}>
              Year
            </Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowHouseDropdown(false);
              }}
            >
              <Text variant="body" size="sm" color={graduationYear ? 'primary' : 'muted'}>
                {graduationYear || 'Select'}
              </Text>
              <Text size="xs" color="muted">{showYearDropdown ? '▲' : '▼'}</Text>
            </Pressable>
            {showYearDropdown && (
              <View style={styles.dropdownOptions}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                  {graduationYears.map((year) => (
                    <Pressable
                      key={year}
                      style={[styles.dropdownOption, graduationYear === year && styles.dropdownOptionSelected]}
                      onPress={() => { setGraduationYear(year); setShowYearDropdown(false); }}
                    >
                      <Text variant={graduationYear === year ? 'bodyMedium' : 'body'} size="sm">{year}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* House */}
          <View style={[styles.halfInput, { zIndex: showHouseDropdown ? 20 : 10 }]}>
            <Text variant="body" size="sm" color="secondary" style={styles.label}>
              House
            </Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowHouseDropdown(!showHouseDropdown);
                setShowYearDropdown(false);
              }}
            >
              <Text variant="body" size="sm" color={house ? 'primary' : 'muted'}>
                {house || 'Select'}
              </Text>
              <Text size="xs" color="muted">{showHouseDropdown ? '▲' : '▼'}</Text>
            </Pressable>
            {showHouseDropdown && (
              <View style={[styles.dropdownOptions, styles.houseDropdown]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                  {harvardHouses.map((h) => (
                    <Pressable
                      key={h}
                      style={[styles.dropdownOption, house === h && styles.dropdownOptionSelected]}
                      onPress={() => { setHouse(h); setShowHouseDropdown(false); }}
                    >
                      <Text variant={house === h ? 'bodyMedium' : 'body'} size="sm">{h}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={styles.halfInput}>
            <Input
              ref={buildingInputRef}
              label="Building"
              placeholder="e.g. B-entry"
              value={dormBuilding}
              onChangeText={setDormBuilding}
              onFocus={() => {
                closeDropdowns();
                scrollToInput(buildingInputRef);
              }}
            />
          </View>
          <View style={styles.halfInput}>
            <Input
              ref={roomInputRef}
              label="Room"
              placeholder="e.g. 301"
              value={dormRoom}
              onChangeText={setDormRoom}
              onFocus={() => {
                closeDropdowns();
                scrollToInput(roomInputRef);
              }}
            />
          </View>
        </View>

        {/* Dorm Location - full address for sharing during scheduling */}
        <Input
          ref={dormLocationInputRef}
          label="Dorm location (for meetups)"
          placeholder="e.g. Adams House, B-entry, 3rd floor"
          value={dormLocation}
          onChangeText={setDormLocation}
          onFocus={() => {
            closeDropdowns();
            scrollToInput(dormLocationInputRef);
          }}
        />

        {/* Payment Preferences */}
        <View style={styles.paymentSection}>
          <Text variant="body" size="sm" color="secondary" style={styles.label}>
            Payment preferences
          </Text>
          <Text variant="body" size="xs" color="muted" style={styles.paymentHint}>
            Select all payment methods you accept
          </Text>
          <View style={styles.paymentOptions}>
            {paymentOptions.map((method) => (
              <Pressable
                key={method}
                style={[
                  styles.paymentOption,
                  paymentPreferences.includes(method) && styles.paymentOptionSelected,
                ]}
                onPress={() => togglePaymentPreference(method)}
              >
                <Text
                  variant={paymentPreferences.includes(method) ? 'bodyMedium' : 'body'}
                  size="sm"
                  style={paymentPreferences.includes(method) ? styles.paymentOptionTextSelected : undefined}
                >
                  {method}
                </Text>
              </Pressable>
            ))}
          </View>

          {paymentPreferences.includes('Zelle') && (
            <Input
              ref={zelleInputRef}
              label="Zelle handle"
              placeholder="Phone number or email"
              value={zelleHandle}
              onChangeText={setZelleHandle}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => {
                closeDropdowns();
                scrollToInput(zelleInputRef);
              }}
              style={styles.paymentHandleInput}
            />
          )}

          {paymentPreferences.includes('Venmo') && (
            <Input
              ref={venmoInputRef}
              label="Venmo handle"
              placeholder="@username"
              value={venmoHandle}
              onChangeText={setVenmoHandle}
              autoCapitalize="none"
              onFocus={() => {
                closeDropdowns();
                scrollToInput(venmoInputRef);
              }}
              style={styles.paymentHandleInput}
            />
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
    zIndex: 10,
  },
  halfInput: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  dropdownOptions: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  houseDropdown: {
    maxHeight: 180,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  dropdownOptionSelected: {
    backgroundColor: colors.accentSoft,
  },
  spacer: {
    height: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  paymentSection: {
    marginBottom: spacing.lg,
  },
  paymentHint: {
    marginBottom: spacing.sm,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  paymentOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  paymentOptionTextSelected: {
    color: '#FFFFFF',
  },
  paymentHandleInput: {
    marginTop: spacing.md,
  },
});
