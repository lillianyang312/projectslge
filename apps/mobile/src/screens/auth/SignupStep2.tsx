import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList, SignupData } from '../../navigation/types';
import { Text, Button, Input } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupStep2'>;

type LoginPreference = 'biometric' | 'email_code';

const harvardHouses = [
  'Adams', 'Cabot', 'Currier', 'Dunster', 'Eliot', 'Kirkland',
  'Leverett', 'Lowell', 'Mather', 'Pforzheimer', 'Quincy', 'Winthrop',
  'Dudley', 'Off-campus',
];

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 5 }, (_, i) => String(currentYear + i));

export default function SignupStep2Screen({ navigation, route }: Props) {
  const { fullName, gender, phone } = route.params;

  const [harvardEmail, setHarvardEmail] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [house, setHouse] = useState('');
  const [dormBuilding, setDormBuilding] = useState('');
  const [dormRoom, setDormRoom] = useState('');
  const [loginPreference, setLoginPreference] = useState<LoginPreference>('biometric');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states for dropdowns
  const [showYearModal, setShowYearModal] = useState(false);
  const [showHouseModal, setShowHouseModal] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const validateHarvardEmail = (email: string): boolean => {
    const harvardDomains = [
      '@college.harvard.edu', '@fas.harvard.edu', '@harvard.edu',
      '@hbs.edu', '@hks.harvard.edu', '@law.harvard.edu',
      '@gsd.harvard.edu', '@hsph.harvard.edu',
    ];
    return harvardDomains.some((domain) => email.toLowerCase().endsWith(domain));
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    setError('');

    if (!harvardEmail.trim()) {
      setError('Please enter your Harvard email');
      return;
    }

    if (!validateHarvardEmail(harvardEmail)) {
      setError('Please enter a valid Harvard email address');
      return;
    }

    if (!graduationYear) {
      setError('Please select your graduation year');
      return;
    }

    if (!house) {
      setError('Please select your house');
      return;
    }

    const normalizedEmail = harvardEmail.toLowerCase().trim();
    setLoading(true);

    try {
      // Check if email already exists in user_profiles
      const { data: exists, error: checkError } = await supabase.rpc(
        'check_email_exists',
        { p_email: normalizedEmail }
      );

      if (checkError) {
        console.error('Error checking email:', checkError);
        // Continue anyway if check fails
      } else if (exists) {
        setError('An account with this email already exists. Please log in instead.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error checking email:', err);
      // Continue anyway if check fails
    }

    const signupData: SignupData = {
      fullName,
      gender,
      phone,
      harvardEmail: normalizedEmail,
      graduationYear,
      house,
      dormBuilding: dormBuilding.trim(),
      dormRoom: dormRoom.trim(),
      loginPreference,
    };

    setLoading(false);
    navigation.navigate('VerifyEmail', {
      email: signupData.harvardEmail,
      signupData,
    });
  };

  const renderYearItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.modalOption, graduationYear === item && styles.modalOptionSelected]}
      onPress={() => {
        setGraduationYear(item);
        setShowYearModal(false);
      }}
    >
      <Text variant={graduationYear === item ? 'bodyMedium' : 'body'} size="base">
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderHouseItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.modalOption, house === item && styles.modalOptionSelected]}
      onPress={() => {
        setHouse(item);
        setShowHouseModal(false);
      }}
    >
      <Text variant={house === item ? 'bodyMedium' : 'body'} size="base">
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="xxl">←</Text>
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="headingMedium" size="xl" style={styles.title}>
            Harvard details
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text variant="body" size="sm" style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <Input
            label="Harvard email"
            placeholder="you@college.harvard.edu"
            value={harvardEmail}
            onChangeText={setHarvardEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View style={styles.rowInputs}>
            {/* Graduation Year */}
            <View style={styles.halfInput}>
              <Text variant="body" size="sm" color="secondary" style={styles.label}>
                Year
              </Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setShowYearModal(true)}
              >
                <Text variant="body" size="sm" color={graduationYear ? 'primary' : 'muted'}>
                  {graduationYear || 'Select'}
                </Text>
                <Text size="xs" color="muted">▼</Text>
              </Pressable>
            </View>

            {/* House */}
            <View style={styles.halfInput}>
              <Text variant="body" size="sm" color="secondary" style={styles.label}>
                House
              </Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setShowHouseModal(true)}
              >
                <Text variant="body" size="sm" color={house ? 'primary' : 'muted'}>
                  {house || 'Select'}
                </Text>
                <Text size="xs" color="muted">▼</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Input
                label="Building"
                placeholder="e.g. B-entry"
                value={dormBuilding}
                onChangeText={setDormBuilding}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Room"
                placeholder="e.g. 301"
                value={dormRoom}
                onChangeText={setDormRoom}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text variant="body" size="sm" color="secondary" style={styles.label}>
              Login method
            </Text>
            <View style={styles.loginOptions}>
              <Pressable
                style={[styles.loginOption, loginPreference === 'biometric' && styles.loginOptionSelected]}
                onPress={() => setLoginPreference('biometric')}
              >
                <Text style={styles.loginOptionIcon}>👤</Text>
                <Text variant={loginPreference === 'biometric' ? 'bodyMedium' : 'body'} size="sm">
                  Face ID
                </Text>
              </Pressable>
              <Pressable
                style={[styles.loginOption, loginPreference === 'email_code' && styles.loginOptionSelected]}
                onPress={() => setLoginPreference('email_code')}
              >
                <Text style={styles.loginOptionIcon}>📧</Text>
                <Text variant={loginPreference === 'email_code' ? 'bodyMedium' : 'body'} size="sm">
                  Email code
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Verify email'}
        </Button>

        <Text variant="body" size="xs" color="muted" style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>

      {/* Year Selection Modal */}
      <Modal
        visible={showYearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowYearModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text variant="headingMedium" size="lg" style={styles.modalTitle}>
                  Select Year
                </Text>
                <FlatList
                  data={graduationYears}
                  renderItem={renderYearItem}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* House Selection Modal */}
      <Modal
        visible={showHouseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHouseModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowHouseModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text variant="headingMedium" size="lg" style={styles.modalTitle}>
                  Select House
                </Text>
                <FlatList
                  data={harvardHouses}
                  renderItem={renderHouseItem}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoid: {
    flex: 1,
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
  progressContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: colors.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
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
  loginOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  loginOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  loginOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  loginOptionIcon: {
    fontSize: 18,
  },
  spacer: {
    height: 100,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  termsText: {
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    width: '100%',
    maxHeight: '60%',
    overflow: 'hidden',
  },
  modalTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: colors.accentSoft,
  },
});
