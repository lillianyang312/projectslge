import { create } from 'zustand';

type AuthStore = {
  isAuthed: boolean;
  setIsAuthed: (value: boolean) => void;
  login: () => void;
  signup: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthed: false,

  setIsAuthed: (value: boolean) => {
    set({ isAuthed: value });
  },

  login: () => {
    // Mock login - just set isAuthed to true
    set({ isAuthed: true });
  },

  signup: () => {
    // Mock signup - just set isAuthed to true
    set({ isAuthed: true });
  },

  logout: () => {
    set({ isAuthed: false });
  },
}));
