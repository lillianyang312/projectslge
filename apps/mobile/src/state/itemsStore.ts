import { create } from 'zustand';

export type Item = {
  id: string;
  title: string;
  category: string;
  intent: 'owned' | 'wants';
  condition?: string;
  notes?: string;
  imageUri?: string;
  createdAt: number;
};

export type DraftItem = Omit<Item, 'id' | 'createdAt'>;

type ItemsStore = {
  items: Item[];
  draft: DraftItem | null;
  seedDemoItems: () => void;
  setDraftFromImage: (uri: string) => void;
  updateDraft: (patch: Partial<DraftItem>) => void;
  commitDraft: () => void;
  clearDraft: () => void;
};

export const useItemsStore = create<ItemsStore>((set, get) => ({
  items: [],
  draft: null,

  seedDemoItems: () => {
    const { items } = get();
    if (items.length === 0) {
      set({
        items: [
          {
            id: '1',
            title: 'Herman Miller Aeron Chair',
            category: 'Furniture',
            intent: 'owned',
            condition: 'Like new',
            notes: 'Barely used, great condition',
            imageUri: undefined,
            createdAt: Date.now() - 86400000, // 1 day ago
          },
        ],
      });
    }
  },

  setDraftFromImage: (uri: string) => {
    set({
      draft: {
        title: '',
        category: '',
        intent: 'owned',
        imageUri: uri,
      },
    });
  },

  updateDraft: (patch: Partial<DraftItem>) => {
    const { draft } = get();
    if (draft) {
      set({
        draft: {
          ...draft,
          ...patch,
        },
      });
    }
  },

  commitDraft: () => {
    const { draft, items } = get();
    if (draft && draft.title && draft.category) {
      const newItem: Item = {
        ...draft,
        id: Date.now().toString(),
        createdAt: Date.now(),
        title: draft.title,
        category: draft.category,
        intent: draft.intent,
      };
      set({
        items: [newItem, ...items],
        draft: null,
      });
    }
  },

  clearDraft: () => {
    set({ draft: null });
  },
}));
