import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';
import { useAuthStore } from './authStore';
import {
  recordDealClaim,
  savePlaceFor,
  toggleDealHype,
  toggleDealLike,
  toggleFollow,
  unsavePlaceFor,
} from '../lib/supabaseApi';
import { autoPin } from '../lib/autoPin';
import { showToast } from './toastStore';

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
  /** Per-user social state — populated when fetched with forUserId. */
  isLiked?: boolean;
  likeCount?: number;
  isHyped?: boolean;
  hypeCount?: number;
  isFollowing?: boolean;
  isPinned?: boolean;
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
  removeDeal: (id: string) => void;
  resetCheckout: () => void;
  hydrate: (deals: Deal[]) => void;
  /** Social toggles for the deal card action row. All four auto-pin the
   *  business when activated, and surface the guest prompt for visitors. */
  likeDeal: (id: string) => void;
  hypeDeal: (id: string) => void;
  followDealBusiness: (id: string) => void;
  pinDealBusiness: (id: string) => void;
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
      const auth = useAuthStore.getState();
      // Guest → close checkout and surface the sign-up prompt instead.
      if (!auth.profile) {
        set((s) => {
          s.checkoutOpen = false;
          s.checkoutDealId = null;
          s.checkoutStatus = 'idle';
        });
        auth.showGuestPrompt('claim');
        return;
      }
      set((s) => {
        s.checkoutStatus = 'loading';
        s.checkoutError = null;
      });
      // Stand-in for Stripe confirmation latency; the real PaymentIntent
      // flow happens in CheckoutModal before this resolves.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      set((s) => {
        s.checkoutStatus = 'success';
      });

      const deal = get().deals.find((d) => d.id === dealId);
      const qty = get().checkoutQuantity;

      // Local pin (only when the deal carries real coordinates).
      if (deal && deal.lat != null && deal.lng != null) {
        useMapStore.getState().addSavedPlace({
          id: `deal_${deal.id}`,
          name: deal.businessName,
          emoji: deal.emoji,
          type: 'social',
          category: deal.category.toLowerCase(),
          hasDeal: true,
          businessId: deal.businessId,
          lat: deal.lat,
          lng: deal.lng,
        });
      }

      if (!deal?.businessId) return;
      const amountPaid = (deal.dealPrice ?? 0) * qty;

      // Persist claim + auto-save the business; failures don't block the
      // success UI (payment already cleared) but we log + toast.
      try {
        await recordDealClaim({
          userId: auth.profile.id,
          dealId,
          businessId: deal.businessId,
          amountPaid,
        });
        await savePlaceFor(auth.profile.id, deal.businessId);
        showToast('Deal claimed! Business saved to your map 📍');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[pindrapp] failed to record claim:', err);
        showToast('Deal claimed — saved to your map');
      }
    },

    addDeal: (deal) =>
      set((s) => {
        s.deals.unshift(deal);
      }),

    removeDeal: (id) =>
      set((s) => {
        s.deals = s.deals.filter((d) => d.id !== id);
      }),

    hydrate: (deals) =>
      set((s) => {
        s.deals = deals;
        s.hydrated = true;
        s.loading = false;
      }),

    likeDeal: (id) => {
      const auth = useAuthStore.getState();
      if (!auth.profile) {
        auth.showGuestPrompt('like');
        return;
      }
      const pre = get().deals.find((d) => d.id === id);
      if (!pre) return;
      const next = !(pre.isLiked ?? false);
      set((s) => {
        const d = s.deals.find((x) => x.id === id);
        if (!d) return;
        d.isLiked = next;
        d.likeCount = next
          ? (d.likeCount ?? 0) + 1
          : Math.max(0, (d.likeCount ?? 0) - 1);
      });
      const userId = auth.profile.id;
      void toggleDealLike(userId, id, next).catch(() => {
        set((s) => {
          const d = s.deals.find((x) => x.id === id);
          if (!d) return;
          d.isLiked = !next;
          d.likeCount = next
            ? Math.max(0, (d.likeCount ?? 0) - 1)
            : (d.likeCount ?? 0) + 1;
        });
        showToast('Could not save like. Try again.');
      });
      if (next && pre.businessId) void autoPin(pre.businessId, userId);
    },

    hypeDeal: (id) => {
      const auth = useAuthStore.getState();
      if (!auth.profile) {
        auth.showGuestPrompt('hype');
        return;
      }
      const pre = get().deals.find((d) => d.id === id);
      if (!pre) return;
      const next = !(pre.isHyped ?? false);
      set((s) => {
        const d = s.deals.find((x) => x.id === id);
        if (!d) return;
        d.isHyped = next;
        d.hypeCount = next
          ? (d.hypeCount ?? 0) + 1
          : Math.max(0, (d.hypeCount ?? 0) - 1);
      });
      const userId = auth.profile.id;
      void toggleDealHype(userId, id, next).catch(() => {
        set((s) => {
          const d = s.deals.find((x) => x.id === id);
          if (!d) return;
          d.isHyped = !next;
          d.hypeCount = next
            ? Math.max(0, (d.hypeCount ?? 0) - 1)
            : (d.hypeCount ?? 0) + 1;
        });
        showToast('Could not save hype. Try again.');
      });
      if (next && pre.businessId) void autoPin(pre.businessId, userId);
    },

    followDealBusiness: (id) => {
      const auth = useAuthStore.getState();
      const deal = get().deals.find((d) => d.id === id);
      if (!deal || !deal.businessId) return;
      if (!auth.profile) {
        auth.showGuestPrompt('follow');
        return;
      }
      const wasFollowing = deal.isFollowing ?? false;
      const userId = auth.profile.id;
      set((s) => {
        for (const d of s.deals) {
          if (d.businessId === deal.businessId) d.isFollowing = !wasFollowing;
        }
      });
      showToast(wasFollowing ? `Unfollowed ${deal.businessName}` : `Following ${deal.businessName}`);
      void toggleFollow(userId, deal.businessId, !wasFollowing).catch(() => {
        set((s) => {
          for (const d of s.deals) {
            if (d.businessId === deal.businessId) d.isFollowing = wasFollowing;
          }
        });
        showToast('Could not update follow. Try again.');
      });
      if (!wasFollowing) void autoPin(deal.businessId, userId);
    },

    pinDealBusiness: (id) => {
      const auth = useAuthStore.getState();
      const deal = get().deals.find((d) => d.id === id);
      if (!deal || !deal.businessId) return;
      if (!auth.profile) {
        auth.showGuestPrompt('save');
        return;
      }
      const wasPinned = deal.isPinned ?? false;
      const userId = auth.profile.id;
      set((s) => {
        for (const d of s.deals) {
          if (d.businessId === deal.businessId) d.isPinned = !wasPinned;
        }
      });
      if (wasPinned) {
        useMapStore.getState().removeSavedPlace(`deal_${deal.id}`);
        useMapStore.getState().removeSavedPlace(deal.businessId);
        showToast('Removed from your map');
        void unsavePlaceFor(userId, deal.businessId).catch(() => {
          set((s) => {
            for (const d of s.deals) {
              if (d.businessId === deal.businessId) d.isPinned = true;
            }
          });
          showToast('Could not remove. Try again.');
        });
      } else {
        if (deal.lat != null && deal.lng != null) {
          useMapStore.getState().addSavedPlace({
            id: `deal_${deal.id}`,
            name: deal.businessName,
            emoji: deal.emoji,
            type: 'social',
            category: deal.category.toLowerCase(),
            hasDeal: true,
            businessId: deal.businessId,
            lat: deal.lat,
            lng: deal.lng,
          });
        }
        showToast(`${deal.businessName} saved to your map 📍`);
        void savePlaceFor(userId, deal.businessId).catch(() => {
          set((s) => {
            for (const d of s.deals) {
              if (d.businessId === deal.businessId) d.isPinned = false;
            }
          });
          useMapStore.getState().removeSavedPlace(`deal_${deal.id}`);
          showToast('Could not save. Try again.');
        });
      }
    },
  })),
);
