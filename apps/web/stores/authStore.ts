import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type UserProfile = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  phone_number: string | null;
  harvard_email: string;
  graduation_year: number | null;
  house: string | null;
  dorm_building: string | null;
  dorm_room: string | null;
  dorm_location: string | null;
  payment_preference: string | null;
  zelle_handle: string | null;
  venmo_handle: string | null;
  login_preference: 'biometric' | 'email_code';
  email_verified: boolean;
  phone_verified: boolean;
  rating: number | null;
  rating_count: number;
  sales_completed: number;
  purchases_completed: number;
  created_at: string;
  updated_at: string;
};

type AuthStore = {
  isAuthed: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthed: false,
  session: null,
  user: null,
  profile: null,
  loading: true,

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthed: !!session,
      loading: false,
    });

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
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      get().setSession(session);

      supabase.auth.onAuthStateChange((_event, session) => {
        get().setSession(session);
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const supabase = createClient();
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
      const supabase = createClient();
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
      const supabase = createClient();
      await supabase.auth.signOut();
      get().setSession(null);
      // Redirect to browse after sign out
      if (typeof window !== 'undefined') {
        window.location.href = '/browse';
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },
}));
