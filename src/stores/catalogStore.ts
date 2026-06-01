import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface CatalogItem {
  id: string;
  businessId?: string;
  name: string;
  description: string;
  category: string;
  photoUrl: string | null;
  regularPrice: number | null;
  salePrice: number | null;
  tags: string[];
  isAvailable: boolean;
  sortOrder: number;
}

// The fixed tag palette shown in the editor (custom tags allowed on top).
export const CATALOG_TAGS = [
  '🌱 Vegan',
  '🌶️ Spicy',
  '⭐ Popular',
  '🆕 New',
  '🥜 Contains Nuts',
  '🍋 Gluten Free',
  '🔥 Hot',
  '💯 Bestseller',
] as const;

interface CatalogState {
  items: CatalogItem[];
  loading: boolean;
  hydrated: boolean;

  hydrate: (items: CatalogItem[]) => void;
  setLoading: (loading: boolean) => void;
  upsertItem: (item: CatalogItem) => void;
  removeItem: (id: string) => void;
  toggleAvailability: (id: string) => void;
}


export const useCatalogStore = create<CatalogState>()(
  immer((set) => ({
    items: [],
    loading: false,
    hydrated: false,

    hydrate: (items) =>
      set((s) => {
        s.items = items;
        s.hydrated = true;
        s.loading = false;
      }),

    setLoading: (loading) =>
      set((s) => {
        s.loading = loading;
      }),

    upsertItem: (item) =>
      set((s) => {
        const idx = s.items.findIndex((i) => i.id === item.id);
        if (idx >= 0) s.items[idx] = item;
        else s.items.unshift(item);
      }),

    removeItem: (id) =>
      set((s) => {
        s.items = s.items.filter((i) => i.id !== id);
      }),

    toggleAvailability: (id) =>
      set((s) => {
        const item = s.items.find((i) => i.id === id);
        if (item) item.isAvailable = !item.isAvailable;
      }),
  })),
);
