import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Keys for secure storage
const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

// User profile type matching database schema
export type UserProfile = {
  id: string;
  full_name: string;
  gender: string | null;
  phone_number: string | null;
  harvard_email: string;
  graduation_year: number | null;
  house: string | null;
  dorm_building: string | null;
  dorm_room: string | null;
  login_preference: 'biometric' | 'email_code';
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
};

type AuthStore = {
  isAuthed: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricType: BiometricType;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  // Biometric methods
  checkBiometricAvailability: () => Promise<void>;
  enableBiometric: (email: string, password: string) => Promise<{ error: Error | null }>;
  enableBiometricForCurrentUser: () => Promise<{ error: Error | null }>;
  disableBiometric: () => Promise<void>;
  signInWithBiometric: () => Promise<{ error: Error | null }>;
  hasSavedCredentials: () => Promise<boolean>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthed: false,
  session: null,
  user: null,
  profile: null,
  loading: true,
  biometricAvailable: false,
  biometricEnabled: false,
  biometricType: 'none',

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthed: !!session,
      loading: false,
    });

    // Fetch profile when session is set
    if (session?.user) {
      get().fetchProfile();
    } else {
      set({ profile: null });
    }
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile row exists yet for this user — not a real error
          set({ profile: null });
          return;
        }
        console.error('Error fetching profile:', error);
        return;
      }

      set({ profile: data as UserProfile });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  },

  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      get().setSession(session);

      // Check biometric availability
      await get().checkBiometricAvailability();

      // Check if biometric is enabled
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      set({ biometricEnabled: enabled === 'true' });

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        get().setSession(session);
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },

  checkBiometricAvailability: async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;

      let biometricType: BiometricType = 'none';
      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = 'facial';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = 'fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'iris';
        }
      }

      set({ biometricAvailable: available, biometricType });
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      set({ biometricAvailable: false, biometricType: 'none' });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      get().setSession(data.session);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
          },
        },
      });

      if (error) {
        return { error };
      }

      get().setSession(data.session);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      get().setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },

  enableBiometric: async (email: string, password: string) => {
    try {
      // First verify the credentials work
      const { error: signInError } = await get().signIn(email, password);
      if (signInError) {
        return { error: signInError };
      }

      // Authenticate with biometric to confirm user intent
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        return { error: new Error('Biometric authentication cancelled') };
      }

      // Store credentials securely
      await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
      await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      set({ biometricEnabled: true });
      return { error: null };
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return { error: error as Error };
    }
  },

  enableBiometricForCurrentUser: async () => {
    try {
      const { session } = get();
      if (!session?.user?.email) {
        return { error: new Error('No user logged in') };
      }

      // Authenticate with biometric to confirm user intent
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        fallbackLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (!authResult.success) {
        return { error: new Error('Biometric authentication cancelled') };
      }

      // For passwordless auth, we store the email and a token
      // The actual auth happens via refresh token
      await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, session.user.email);
      await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, session.refresh_token || '');
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      set({ biometricEnabled: true });
      return { error: null };
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return { error: error as Error };
    }
  },

  disableBiometric: async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
      set({ biometricEnabled: false });
    } catch (error) {
      console.error('Error disabling biometric:', error);
    }
  },

  signInWithBiometric: async () => {
    try {
      // Check if credentials are saved
      const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const refreshToken = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);

      if (!email || !refreshToken) {
        return { error: new Error('No saved credentials. Please sign in with email first.') };
      }

      // Authenticate with biometric
      const { biometricType } = get();
      const promptMessage = biometricType === 'facial'
        ? 'Sign in with Face ID'
        : biometricType === 'fingerprint'
        ? 'Sign in with fingerprint'
        : 'Sign in with biometrics';

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use email code',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        if (authResult.error === 'user_cancel') {
          return { error: new Error('Authentication cancelled') };
        }
        return { error: new Error('Biometric authentication failed') };
      }

      // Try to refresh the session using stored refresh token
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        // Refresh token expired, need to re-authenticate
        console.log('Refresh token expired, clearing biometric credentials');
        await get().disableBiometric();
        return { error: new Error('Session expired. Please sign in with email again.') };
      }

      // Update stored refresh token
      if (data.session?.refresh_token) {
        await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, data.session.refresh_token);
      }

      get().setSession(data.session);
      return { error: null };
    } catch (error) {
      console.error('Error signing in with biometric:', error);
      return { error: error as Error };
    }
  },

  hasSavedCredentials: async () => {
    try {
      const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const token = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
      return !!(email && token);
    } catch {
      return false;
    }
  },
}));
