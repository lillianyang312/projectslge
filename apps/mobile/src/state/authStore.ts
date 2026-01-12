import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type AuthStore = {
  isAuthed: boolean;
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthed: false,
  session: null,
  user: null,
  loading: true,

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthed: !!session,
      loading: false,
    });
  },

  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      get().setSession(session);

      // Listen for auth changes
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

  signUp: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
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

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      get().setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },

  continueAsGuest: () => {
    // Set as authenticated without a session (guest mode)
    set({
      isAuthed: true,
      session: null,
      user: null,
      loading: false,
    });
  },
}));
