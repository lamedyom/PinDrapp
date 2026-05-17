import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';

export type DealCategory =
  | 'Food'
  | 'Shopping'
  | 'Beauty'
  | 'Services'
  | 'Entertainment'
  | 'Bakery'
  | 'Coffee';

export interface Deal {
  id: string;
  businessName: string;
  category: string;
  emoji: string;
  headline: string;
  description: string;
  originalPrice: number | null;
  dealPrice: number | null;
  discountPercent: number | null;
  expiresAt: Date;
  distanceMiles: number;
  isFeatured: boolean;
  stripeProductId: string;
  lat?: number;
  lng?: number;
}

export type CheckoutStatus = 'idle' | 'loading' | 'success' | 'error';

interface DealState {
  deals: Deal[];
  activeCategory: 'All' | string;
  checkoutOpen: boolean;
  checkoutDealId: string | null;
  checkoutQuantity: number;
  checkoutStatus: CheckoutStatus;
  checkoutError: string | null;

  setCategory: (c: string) => void;
  openCheckout: (dealId: string) => void;
  closeCheckout: () => void;
  setQuantity: (q: number) => void;
  processPayment: () => Promise<void>;
  addDeal: (deal: Deal) => void;
  resetCheckout: () => void;
}

const now = Date.now();
const hrs = (n: number) => new Date(now + n * 3600000);

const mockDeals: Deal[] = [
  {
    id: 'd1',
    businessName: 'Prime Grill',
    category: 'Food',
    emoji: '🥩',
    headline: 'Shabbos Early Bird — 3-Course for Two',
    description: 'Full dinner includes dessert. Walk-ins welcome while tables last.',
    originalPrice: 115,
    dealPrice: 79,
    discountPercent: null,
    expiresAt: hrs(3.5),
    distanceMiles: 0.3,
    isFeatured: true,
    stripeProductId: 'prod_1',
    lat: 40.751,
    lng: -73.982,
  },
  {
    id: 'd2',
    businessName: 'Green Garden',
    category: 'Food',
    emoji: '🥗',
    headline: 'Any Grain Bowl 30% Off',
    description: 'All grain bowls, today only until 8pm.',
    originalPrice: null,
    dealPrice: null,
    discountPercent: 30,
    expiresAt: hrs(4),
    distanceMiles: 0.6,
    isFeatured: false,
    stripeProductId: 'prod_2',
    lat: 40.749,
    lng: -73.987,
  },
  {
    id: 'd3',
    businessName: 'Challah Co.',
    category: 'Bakery',
    emoji: '🥐',
    headline: 'Buy 1 Dozen, Get 6 Free',
    description: 'All challah rolls. Friday pickup only.',
    originalPrice: 27,
    dealPrice: 18,
    discountPercent: null,
    expiresAt: hrs(1.5),
    distanceMiles: 0.8,
    isFeatured: false,
    stripeProductId: 'prod_3',
    lat: 40.7478,
    lng: -73.988,
  },
  {
    id: 'd4',
    businessName: "Rivka's Boutique",
    category: 'Shopping',
    emoji: '👗',
    headline: '20% Off All Summer Collection',
    description: 'New stock just arrived. Today only in-store.',
    originalPrice: null,
    dealPrice: null,
    discountPercent: 20,
    expiresAt: hrs(6),
    distanceMiles: 1.1,
    isFeatured: false,
    stripeProductId: 'prod_4',
    lat: 40.753,
    lng: -73.98,
  },
  {
    id: 'd5',
    businessName: 'Fresh Pressery',
    category: 'Coffee',
    emoji: '🥤',
    headline: 'Cold Press 2-for-1',
    description: 'Any cold press juice, buy one get one free. In-store only.',
    originalPrice: 12,
    dealPrice: 6,
    discountPercent: null,
    expiresAt: hrs(2),
    distanceMiles: 2.0,
    isFeatured: false,
    stripeProductId: 'prod_5',
    lat: 40.757,
    lng: -73.974,
  },
];

export const useDealStore = create<DealState>()(
  immer((set, get) => ({
    deals: mockDeals,
    activeCategory: 'All',
    checkoutOpen: false,
    checkoutDealId: null,
    checkoutQuantity: 1,
    checkoutStatus: 'idle',
    checkoutError: null,

    setCategory: (c) =>
      set((s) => {
        s.activeCategory = c;
      }),

    openCheckout: (dealId) =>
      set((s) => {
        s.checkoutOpen = true;
        s.checkoutDealId = dealId;
        s.checkoutQuantity = 1;
        s.checkoutStatus = 'idle';
        s.checkoutError = null;
      }),

    closeCheckout: () =>
      set((s) => {
        s.checkoutOpen = false;
        s.checkoutDealId = null;
        s.checkoutQuantity = 1;
        s.checkoutStatus = 'idle';
        s.checkoutError = null;
      }),

    setQuantity: (q) =>
      set((s) => {
        s.checkoutQuantity = Math.max(1, Math.min(20, q));
      }),

    resetCheckout: () =>
      set((s) => {
        s.checkoutStatus = 'idle';
        s.checkoutError = null;
      }),

    processPayment: async () => {
      const dealId = get().checkoutDealId;
      if (!dealId) return;
      set((s) => {
        s.checkoutStatus = 'loading';
        s.checkoutError = null;
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      set((s) => {
        s.checkoutStatus = 'success';
      });
      const deal = get().deals.find((d) => d.id === dealId);
      if (deal) {
        useMapStore.getState().addSavedPlace({
          id: `deal_${deal.id}`,
          name: deal.businessName,
          emoji: deal.emoji,
          type: 'social',
          category: deal.category.toLowerCase(),
          hasDeal: true,
          lat: deal.lat ?? 40.7505,
          lng: deal.lng ?? -73.9845,
        });
      }
    },

    addDeal: (deal) =>
      set((s) => {
        s.deals.unshift(deal);
      }),
  })),
);
