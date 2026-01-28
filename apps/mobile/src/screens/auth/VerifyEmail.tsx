import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
  Alert,
  Keyboard,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, radius } from '../../ui/tokens';
import { useAuthStore } from '../../state/authStore';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CODE_BOX_SIZE = Math.min(48, (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 5) / 6);

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, signupData } = route.params;
  const isLogin = !signupData;

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [showSlideshowModal, setShowSlideshowModal] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    sendVerificationCode();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendVerificationCode = async () => {
    try {
      setResendCooldown(60);
      console.log('Sending verification email to:', email);

      const { data, error: sendError } = await supabase.functions.invoke('sendVerificationEmail', {
        body: { email },
      });

      if (sendError) {
        console.error('Error sending verification email:', sendError);
      } else {
        console.log('Verification email response:', data);
        if (data?.devCode) {
          Alert.alert('Dev Mode', `Your verification code is: ${data.devCode}`);
        }
      }
    } catch (err) {
      console.error('Failed to send verification code:', err);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        Keyboard.dismiss();
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    const fullCode = verificationCode || code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // For login, use the loginWithCode function which verifies code and creates session
        let loginResult: any = null;
        try {
          const { data, error: loginError } = await supabase.functions.invoke(
            'loginWithCode',
            { body: { email, code: fullCode } }
          );
          loginResult = data;

          if (loginError) {
            console.error('Login error:', loginError);
            console.error('Login error context:', loginError?.context);
            console.error('Login error message:', loginError?.message);
            console.error('Login error name:', loginError?.name);

            // FunctionsHttpError contains the response body in context.json()
            // Also check if loginResult contains the error (sometimes returned even with error)
            let errorMessage = 'Login failed. Please try again.';

            try {
              // Try to get error from context if it's a FunctionsHttpError
              if (loginError.context) {
                const errorBody = await loginError.context.json();
                console.error('Error body from context:', errorBody);
                if (errorBody?.error) {
                  errorMessage = errorBody.error;
                }
              }
            } catch (contextError) {
              console.error('Failed to parse context:', contextError);
              // Fallback to checking loginResult
              if (loginResult?.error) {
                errorMessage = loginResult.error;
              }
            }

            // Show a user-friendly message for "account not found"
            if (errorMessage.includes('Account not found') || errorMessage.includes('sign up')) {
              setError('No account found with this email. Please sign up first.');
            } else {
              setError(errorMessage);
            }
            setLoading(false);
            return;
          }
        } catch (invokeError: any) {
          console.error('Exception in loginWithCode invoke:', invokeError);
          let errorMessage = 'Login failed. Please try again.';

          try {
            if (invokeError?.context) {
              const errorBody = await invokeError.context.json();
              if (errorBody?.error) {
                errorMessage = errorBody.error;
              }
            }
          } catch {
            errorMessage = invokeError?.message || 'Login failed. Please try again.';
          }

          setError(errorMessage);
          setLoading(false);
          return;
        }

        if (!loginResult?.success) {
          // Check if it's an account not found error
          if (loginResult?.error?.includes('Account not found') || loginResult?.error?.includes('sign up')) {
            setError('No account found with this email. Please sign up first.');
          } else {
            setError(loginResult?.error || 'Invalid or expired code. Please try again.');
          }
          setLoading(false);
          return;
        }

        // Set the session from the response
        if (loginResult.session) {
          await supabase.auth.setSession({
            access_token: loginResult.session.access_token,
            refresh_token: loginResult.session.refresh_token,
          });

          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            setSession(sessionData.session);
          }
        }
      } else if (signupData) {
        // For signup, verify the code first
        try {
          const { data: verifyResult, error: verifyError } = await supabase.functions.invoke(
            'verifyEmailCode',
            { body: { email, code: fullCode } }
          );

          if (verifyError) {
            console.error('Verification error:', verifyError);
            let errorMessage = 'Invalid or expired code. Please try again.';

            try {
              // Try to get error from context if it's a FunctionsHttpError
              if (verifyError.context) {
                const errorBody = await verifyError.context.json();
                if (errorBody?.error) {
                  errorMessage = errorBody.error;
                }
              }
            } catch {
              // Fallback to checking verifyResult
              if (verifyResult?.error) {
                errorMessage = verifyResult.error;
              }
            }

            setError(errorMessage);
            setLoading(false);
            return;
          }

          if (!verifyResult?.valid) {
            setError('Invalid or expired code. Please try again.');
            setLoading(false);
            return;
          }
        } catch (invokeError: any) {
          console.error('Exception in verifyEmailCode invoke:', invokeError);
          let errorMessage = 'Invalid or expired code. Please try again.';

          try {
            if (invokeError?.context) {
              const errorBody = await invokeError.context.json();
              if (errorBody?.error) {
                errorMessage = errorBody.error;
              }
            }
          } catch {
            errorMessage = invokeError?.message || 'Invalid or expired code. Please try again.';
          }

          setError(errorMessage);
          setLoading(false);
          return;
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: signupData.harvardEmail,
          password: generateSecurePassword(),
          options: { data: { full_name: `${signupData.firstName} ${signupData.lastName}`.trim() } },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Check if user already exists - Supabase returns empty identities array for existing users
        if (authData.user && (!authData.user.identities || authData.user.identities.length === 0)) {
          setError('An account with this email already exists. Please log in instead.');
          setLoading(false);
          return;
        }

        if (authData.user) {
          // Construct full name from first and last name
          const fullName = `${signupData.firstName} ${signupData.lastName}`.trim();

          const { error: profileError } = await supabase.from('user_profiles').insert({
            id: authData.user.id,
            full_name: fullName,
            first_name: signupData.firstName,
            last_name: signupData.lastName,
            gender: signupData.gender,
            phone_number: signupData.phone,
            harvard_email: signupData.harvardEmail,
            graduation_year: parseInt(signupData.graduationYear),
            house: signupData.house,
            dorm_building: signupData.dormBuilding || null,
            dorm_room: signupData.dormRoom || null,
            dorm_location: signupData.dormLocation || null,
            payment_preference: signupData.paymentPreference || null,
            zelle_handle: signupData.zelleHandle || null,
            venmo_handle: signupData.venmoHandle || null,
            login_preference: signupData.loginPreference,
            email_verified: true,
          });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }

          if (authData.session) {
            setSession(authData.session);
          }

          // Show slideshow upload prompt after account creation
          setShowSlideshowModal(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setCode(Array(CODE_LENGTH).fill(''));
    sendVerificationCode();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="xxl">←</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headingMedium" size="xl" style={styles.title}>
          Check your email
        </Text>

        <Text variant="body" size="base" color="secondary" style={styles.subtitle}>
          We sent a 6-digit code to
        </Text>
        <Text variant="bodyMedium" size="base" color="primary" style={styles.emailText}>
          {email}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="body" size="sm" style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        <View style={styles.resendContainer}>
          <Text variant="body" size="sm" color="secondary">
            Didn't receive the code?{' '}
          </Text>
          {resendCooldown > 0 ? (
            <Text variant="body" size="sm" color="muted">
              Resend in {resendCooldown}s
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text variant="bodyMedium" size="sm" color="accent">
                Resend code
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => navigation.goBack()} style={styles.changeEmail}>
          <Text variant="body" size="sm" color="muted">
            Use a different email
          </Text>
        </Pressable>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={() => handleVerify()}
          disabled={loading || code.join('').length !== CODE_LENGTH}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
      </View>

      {/* Slideshow Upload Modal - shown after account creation */}
      <Modal
        visible={showSlideshowModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSlideshowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="headingMedium" size="heading3" style={styles.modalTitle}>
              Upload a slideshow?
            </Text>
            <Text variant="body" size="md" color="secondary" style={styles.modalText}>
              You can upload a PDF slideshow of items you want to sell to get started quickly.
            </Text>
            <View style={styles.modalButtons}>
              <Button variant="primary" onPress={async () => {
                setShowSlideshowModal(false);
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: 'application/pdf',
                    copyToCacheDirectory: true,
                  });
                  if (!result.canceled && result.assets && result.assets.length > 0) {
                    // Session is already set, user will be navigated to app by auth state
                    // PDF will be handled on the List screen
                    Alert.alert('Slideshow uploaded!', `${result.assets[0].name} will be processed.`);
                  }
                } catch (err) {
                  console.error('Error picking document:', err);
                }
              }}>
                Yes, upload slideshow
              </Button>
              <Button variant="secondary" onPress={() => {
                setShowSlideshowModal(false);
                // Session is already set, auth state will navigate to app
              }}>
                No, skip for now
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  emailText: {
    marginBottom: spacing.xl,
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  codeInput: {
    width: CODE_BOX_SIZE,
    height: CODE_BOX_SIZE + 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  codeInputFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  codeInputError: {
    borderColor: colors.danger,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  changeEmail: {
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  modalButtons: {
    gap: spacing.md,
  },
});
