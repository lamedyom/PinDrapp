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
  hydrate: (deals: Deal[]) => void;
}

const now = Date.now();
const hrs = (n: number) => new Date(now + n * 3600000);

// Hollywood, FL anchored deals. IDs are kept in sync with the feed posts that
// link to them (p1→d1, p2→d2, p3→d3, p4→d4).
const mockDeals: Deal[] = [
  {
    id: 'd1',
    businessName: "GG's Waterfront",
    category: 'Food',
    emoji: '🥩',
    headline: 'Sunset Surf & Turf for Two',
    description: 'Filet + lobster tail + dessert on the Broadwalk. Walk-ins welcome.',
    originalPrice: 115,
    dealPrice: 79,
    discountPercent: null,
    expiresAt: hrs(3.5),
    distanceMiles: 1.7,
    isFeatured: true,
    stripeProductId: 'prod_1',
    lat: 26.0177,
    lng: -80.1148,
  },
  {
    id: 'd2',
    businessName: 'Green Garden Bowls',
    category: 'Food',
    emoji: '🥗',
    headline: 'Any Grain Bowl 30% Off',
    description: 'All grain bowls, today only until 8pm on Hollywood Blvd.',
    originalPrice: null,
    dealPrice: null,
    discountPercent: 30,
    expiresAt: hrs(4),
    distanceMiles: 0.5,
    isFeatured: false,
    stripeProductId: 'prod_2',
    lat: 26.0098,
    lng: -80.1465,
  },
  {
    id: 'd3',
    businessName: 'Sage Bagel & Deli',
    category: 'Bakery',
    emoji: '🥐',
    headline: 'Bagel Baker’s Dozen — Buy 12, Get 6 Free',
    description: 'Fresh from the kettle. Friday morning pickup only.',
    originalPrice: 27,
    dealPrice: 18,
    discountPercent: null,
    expiresAt: hrs(1.5),
    distanceMiles: 0.6,
    isFeatured: false,
    stripeProductId: 'prod_3',
    lat: 26.015,
    lng: -80.152,
  },
  {
    id: 'd4',
    businessName: 'Hollywood Boulevard Boutique',
    category: 'Shopping',
    emoji: '👗',
    headline: '20% Off All Summer Collection',
    description: 'New stock just arrived. Today only in-store on Hollywood Blvd.',
    originalPrice: null,
    dealPrice: null,
    discountPercent: 20,
    expiresAt: hrs(6),
    distanceMiles: 0.2,
    isFeatured: false,
    stripeProductId: 'prod_4',
    lat: 26.0125,
    lng: -80.1502,
  },
  {
    id: 'd5',
    businessName: 'The Juice Lab Broadwalk',
    category: 'Coffee',
    emoji: '🥤',
    headline: 'Cold Press 2-for-1',
    description: 'Any cold press juice, buy one get one free. Broadwalk only.',
    originalPrice: 12,
    dealPrice: 6,
    discountPercent: null,
    expiresAt: hrs(2),
    distanceMiles: 1.7,
    isFeatured: false,
    stripeProductId: 'prod_5',
    lat: 26.0173,
    lng: -80.1153,
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

    hydrate: (deals) =>
      set((s) => {
        s.deals = deals;
      }),
  })),
);
