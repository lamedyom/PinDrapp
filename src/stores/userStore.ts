import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  isAvailable: boolean;
}

export interface DealTemplate {
  id: string;
  name: string;
  headline: string;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  defaultDuration: number;
  emoji: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  category: string;
  bio: string;
  imageUrl: string | null;
  coverEmoji: string;
  website: string;
  instagram: string;
  phone: string;
  address: string;
  followerCount: number;
  postCount: number;
  mapSaveCount: number;
  dealClaimCount: number;
  menuItems: MenuItem[];
  dealTemplates: DealTemplate[];
}

interface UserState {
  profile: BusinessProfile;
  isEditModalOpen: boolean;
  isMenuModalOpen: boolean;

  setProfile: (p: BusinessProfile) => void;
  updateProfile: (partial: Partial<BusinessProfile>) => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  openMenuModal: () => void;
  closeMenuModal: () => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, partial: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  toggleMenuItemAvailability: (id: string) => void;
  addDealTemplate: (tpl: DealTemplate) => void;
}

const mockProfile: BusinessProfile = {
  id: 'biz1',
  name: 'Prime Grill',
  category: 'Steakhouse',
  coverEmoji: '🥩',
  bio: 'Crown Heights finest steakhouse. Kosher certified. Open Sun–Thu 5pm, Fri 12–3pm.',
  imageUrl: null,
  website: 'primegrill.com',
  instagram: '@primegrillnyc',
  phone: '(718) 555-0123',
  address: '123 Kingston Ave, Crown Heights, Brooklyn, NY 11213',
  followerCount: 847,
  postCount: 34,
  mapSaveCount: 412,
  dealClaimCount: 89,
  menuItems: [
    {
      id: 'm1',
      name: 'Hand-Cut Ribeye',
      description: '12oz dry-aged, seasonal veg',
      price: 44,
      category: 'Mains',
      emoji: '🥩',
      isAvailable: true,
    },
    {
      id: 'm2',
      name: '3-Course Dinner for Two',
      description: 'Starter, main, dessert. Ask about tonight.',
      price: 79,
      category: 'Specials',
      emoji: '🍽️',
      isAvailable: true,
    },
    {
      id: 'm3',
      name: 'Wagyu Carpaccio',
      description: 'Paper thin, truffle oil, capers, arugula',
      price: 28,
      category: 'Appetizers',
      emoji: '🥗',
      isAvailable: true,
    },
    {
      id: 'm4',
      name: 'Dark Chocolate Lava Cake',
      description: 'Warm, vanilla bean ice cream',
      price: 16,
      category: 'Desserts',
      emoji: '🍫',
      isAvailable: true,
    },
    {
      id: 'm5',
      name: 'House Wine Carafe',
      description: 'Red or white, 500ml',
      price: 34,
      category: 'Drinks',
      emoji: '🍷',
      isAvailable: false,
    },
  ],
  dealTemplates: [
    {
      id: 'dt1',
      name: 'Early Bird Special',
      headline: '3-Course for Two — Limited Tables',
      discountType: 'fixed',
      discountValue: 36,
      defaultDuration: 4,
      emoji: '🌅',
    },
    {
      id: 'dt2',
      name: 'End of Day Clearance',
      headline: 'Selected items — today only',
      discountType: 'percent',
      discountValue: 25,
      defaultDuration: 2,
      emoji: '🌙',
    },
    {
      id: 'dt3',
      name: 'Weekend Special',
      headline: 'Exclusive weekend pricing',
      discountType: 'percent',
      discountValue: 15,
      defaultDuration: 8,
      emoji: '🎉',
    },
  ],
};

export const useUserStore = create<UserState>()(
  immer((set) => ({
    profile: mockProfile,
    isEditModalOpen: false,
    isMenuModalOpen: false,

    setProfile: (p) =>
      set((s) => {
        s.profile = p;
      }),

    updateProfile: (partial) =>
      set((s) => {
        Object.assign(s.profile, partial);
      }),

    openEditModal: () =>
      set((s) => {
        s.isEditModalOpen = true;
      }),
    closeEditModal: () =>
      set((s) => {
        s.isEditModalOpen = false;
      }),

    openMenuModal: () =>
      set((s) => {
        s.isMenuModalOpen = true;
      }),
    closeMenuModal: () =>
      set((s) => {
        s.isMenuModalOpen = false;
      }),

    addMenuItem: (item) =>
      set((s) => {
        s.profile.menuItems.push(item);
      }),

    updateMenuItem: (id, partial) =>
      set((s) => {
        const item = s.profile.menuItems.find((m) => m.id === id);
        if (item) Object.assign(item, partial);
      }),

    deleteMenuItem: (id) =>
      set((s) => {
        s.profile.menuItems = s.profile.menuItems.filter((m) => m.id !== id);
      }),

    toggleMenuItemAvailability: (id) =>
      set((s) => {
        const item = s.profile.menuItems.find((m) => m.id === id);
        if (item) item.isAvailable = !item.isAvailable;
      }),

    addDealTemplate: (tpl) =>
      set((s) => {
        s.profile.dealTemplates.push(tpl);
      }),
  })),
);
