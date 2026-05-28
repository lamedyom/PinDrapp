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

// Mock catalog so the offline demo profile shows a populated menu.
const mockCatalog: CatalogItem[] = [
  {
    id: 'c1',
    name: 'Margherita Pizza',
    description: 'San Marzano tomato, fior di latte, basil, stone oven.',
    category: 'Pizzas',
    photoUrl: null,
    regularPrice: 16,
    salePrice: null,
    tags: ['⭐ Popular'],
    isAvailable: true,
    sortOrder: 0,
  },
  {
    id: 'c2',
    name: 'Garden Grain Bowl',
    description: 'Quinoa, roasted veg, tahini drizzle.',
    category: 'Bowls',
    photoUrl: null,
    regularPrice: 14,
    salePrice: 11,
    tags: ['🌱 Vegan', '🍋 Gluten Free'],
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: 'c3',
    name: 'Cold Brew',
    description: 'Slow-steeped 18 hours, served over ice.',
    category: 'Drinks',
    photoUrl: null,
    regularPrice: 5,
    salePrice: null,
    tags: ['🆕 New'],
    isAvailable: false,
    sortOrder: 2,
  },
];

export const useCatalogStore = create<CatalogState>()(
  immer((set) => ({
    items: mockCatalog,
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
