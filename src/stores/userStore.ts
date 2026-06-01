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
  profile: BusinessProfile | null;
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


export const useUserStore = create<UserState>()(
  immer((set) => ({
    profile: null,
    isEditModalOpen: false,
    isMenuModalOpen: false,

    setProfile: (p) =>
      set((s) => {
        s.profile = p;
      }),

    updateProfile: (partial) =>
      set((s) => {
        if (s.profile) Object.assign(s.profile, partial);
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
        s.profile?.menuItems.push(item);
      }),

    updateMenuItem: (id, partial) =>
      set((s) => {
        const item = s.profile?.menuItems.find((m) => m.id === id);
        if (item) Object.assign(item, partial);
      }),

    deleteMenuItem: (id) =>
      set((s) => {
        if (s.profile) s.profile.menuItems = s.profile.menuItems.filter((m) => m.id !== id);
      }),

    toggleMenuItemAvailability: (id) =>
      set((s) => {
        const item = s.profile?.menuItems.find((m) => m.id === id);
        if (item) item.isAvailable = !item.isAvailable;
      }),

    addDealTemplate: (tpl) =>
      set((s) => {
        s.profile?.dealTemplates.push(tpl);
      }),
  })),
);
