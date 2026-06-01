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

export type DealMediaType = 'image' | 'video';

export interface Deal {
  id: string;
  businessId?: string;
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
  /** Deals can be backed by an image OR a video. */
  mediaUrl?: string;
  mediaType?: DealMediaType;
  /** Flash Sale, Event Deal, Limited Offer, Bundle Deal, Clearance. */
  dealCategory?: string;
  /** True when the owning business is on Pindrapp Pro. */
  isPro?: boolean;
  viewCount?: number;
  claimCount?: number;
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
  loading: boolean;
  hydrated: boolean;

  setCategory: (c: string) => void;
  setLoading: (loading: boolean) => void;
  openCheckout: (dealId: string) => void;
  closeCheckout: () => void;
  setQuantity: (q: number) => void;
  processPayment: () => Promise<void>;
  addDeal: (deal: Deal) => void;
  resetCheckout: () => void;
  hydrate: (deals: Deal[]) => void;
}

export const useDealStore = create<DealState>()(
  immer((set, get) => ({
    deals: [],
    activeCategory: 'All',
    checkoutOpen: false,
    checkoutDealId: null,
    checkoutQuantity: 1,
    checkoutStatus: 'idle',
    checkoutError: null,
    loading: false,
    hydrated: false,

    setLoading: (loading) =>
      set((s) => {
        s.loading = loading;
      }),

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
      // Only auto-pin a deal to the map when it carries real coordinates.
      if (deal && deal.lat != null && deal.lng != null) {
        useMapStore.getState().addSavedPlace({
          id: `deal_${deal.id}`,
          name: deal.businessName,
          emoji: deal.emoji,
          type: 'social',
          category: deal.category.toLowerCase(),
          hasDeal: true,
          lat: deal.lat,
          lng: deal.lng,
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
        s.hydrated = true;
        s.loading = false;
      }),
  })),
);
