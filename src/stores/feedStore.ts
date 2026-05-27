import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';
import { showToast } from './toastStore';
import { useAuthStore } from './authStore';
import { savePlaceFor, togglePostLike } from '../lib/supabaseApi';

export type FeedTab = 'updates' | 'deals' | 'nearby' | 'ai';

export interface FeedPost {
  id: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  businessEmoji: string;
  caption: string;
  likeCount: number;
  distanceMiles: number;
  isLiked: boolean;
  isPinned: boolean;
  hasDeal: boolean;
  dealId?: string;
  createdAt: Date;
  videoUrl?: string;
  thumbnailGradient: string;
  isLive?: boolean;
  lat?: number;
  lng?: number;
}

interface FeedState {
  posts: FeedPost[];
  activeTab: FeedTab;
  /** True while the first Supabase fetch is in flight. */
  loading: boolean;
  /** True once a real Supabase fetch has completed (even if it returned 0). */
  hydrated: boolean;

  likePost: (id: string) => void;
  pinPost: (id: string) => void;
  setTab: (tab: FeedTab) => void;
  prependPost: (post: FeedPost) => void;
  hydrate: (posts: FeedPost[]) => void;
  setLoading: (loading: boolean) => void;
}

// Hollywood, FL feed seed — business names and coordinates match the same
// businesses surfaced on the map (mapStore) and the deals (dealStore).
const mockPosts: FeedPost[] = [
  {
    id: 'p1',
    businessId: 'b1',
    businessName: "GG's Waterfront",
    businessCategory: 'Steakhouse',
    businessEmoji: '🥩',
    caption: 'Sunset Surf & Turf on the Broadwalk tonight — $79 for two. Walk-ins welcome.',
    likeCount: 148,
    distanceMiles: 1.7,
    isLiked: false,
    isPinned: true,
    hasDeal: true,
    dealId: 'd1',
    createdAt: new Date(Date.now() - 3600000),
    thumbnailGradient: 'linear-gradient(160deg,#1a0d2e,#0d1f3c)',
    lat: 26.0177,
    lng: -80.1148,
  },
  {
    id: 'p2',
    businessId: 'b2',
    businessName: 'Green Garden Bowls',
    businessCategory: 'Vegan',
    businessEmoji: '🥗',
    caption: 'Flash deal: any grain bowl 30% off today only until 8pm. Come in!',
    likeCount: 87,
    distanceMiles: 0.5,
    isLiked: false,
    isPinned: false,
    hasDeal: true,
    dealId: 'd2',
    createdAt: new Date(Date.now() - 7200000),
    thumbnailGradient: 'linear-gradient(160deg,#0f1f0f,#1a2a1a)',
    isLive: true,
    lat: 26.0098,
    lng: -80.1465,
  },
  {
    id: 'p3',
    businessId: 'b3',
    businessName: 'Sage Bagel & Deli',
    businessCategory: 'Bakery',
    businessEmoji: '🥐',
    caption: 'Fresh from the kettle — sesame bagels. Buy a dozen this Friday, get 6 free.',
    likeCount: 203,
    distanceMiles: 0.6,
    isLiked: true,
    isPinned: false,
    hasDeal: true,
    dealId: 'd3',
    createdAt: new Date(Date.now() - 10800000),
    thumbnailGradient: 'linear-gradient(160deg,#2a1a00,#1a1000)',
    lat: 26.015,
    lng: -80.152,
  },
  {
    id: 'p4',
    businessId: 'b4',
    businessName: 'Hollywood Boulevard Boutique',
    businessCategory: 'Fashion',
    businessEmoji: '👗',
    caption: 'New summer collection just dropped. 20% off everything today — in store only.',
    likeCount: 56,
    distanceMiles: 0.2,
    isLiked: false,
    isPinned: false,
    hasDeal: true,
    dealId: 'd4',
    createdAt: new Date(Date.now() - 14400000),
    thumbnailGradient: 'linear-gradient(160deg,#0d1f3c,#1a0d2e)',
    lat: 26.0125,
    lng: -80.1502,
  },
  {
    id: 'p5',
    businessId: 'b5',
    businessName: 'Solo Pizza Napoletana',
    businessCategory: 'Italian',
    businessEmoji: '🍕',
    caption: 'Just pulled this margherita out of the stone oven. Come hungry tonight.',
    likeCount: 312,
    distanceMiles: 0.3,
    isLiked: false,
    isPinned: false,
    hasDeal: false,
    createdAt: new Date(Date.now() - 18000000),
    thumbnailGradient: 'linear-gradient(160deg,#2a0a0a,#1a1020)',
    lat: 26.0107,
    lng: -80.148,
  },
  {
    id: 'p6',
    businessId: 'b6',
    businessName: 'Tap 42 Hollywood',
    businessCategory: 'Coffee',
    businessEmoji: '☕',
    caption: 'Monday morning reset. Ethiopian pour-over, slow batch. In before 9 for 10% off.',
    likeCount: 74,
    distanceMiles: 0.4,
    isLiked: false,
    isPinned: false,
    hasDeal: false,
    createdAt: new Date(Date.now() - 21600000),
    thumbnailGradient: 'linear-gradient(160deg,#1a1000,#2a1a00)',
    lat: 26.0095,
    lng: -80.1455,
  },
];

export const useFeedStore = create<FeedState>()(
  immer((set, get) => ({
    posts: mockPosts,
    activeTab: 'updates',
    loading: false,
    hydrated: false,

    likePost: (id) => {
      let nextLiked = false;
      set((s) => {
        const post = s.posts.find((p) => p.id === id);
        if (!post) return;
        if (post.isLiked) {
          post.isLiked = false;
          post.likeCount = Math.max(0, post.likeCount - 1);
          nextLiked = false;
        } else {
          post.isLiked = true;
          post.likeCount += 1;
          nextLiked = true;
        }
      });
      // Persist to Supabase if we have an authed session + profile.
      const auth = useAuthStore.getState();
      if (auth.profile) {
        void togglePostLike(auth.profile.id, id, nextLiked).catch(() => {
          /* keep optimistic UI; user will see eventual consistency */
        });
      }
    },

    pinPost: (id) => {
      const post = get().posts.find((p) => p.id === id);
      if (!post || post.isPinned) return;
      set((s) => {
        const p = s.posts.find((x) => x.id === id);
        if (p) p.isPinned = true;
      });
      useMapStore.getState().addSavedPlace({
        id: `feed_${post.id}`,
        name: post.businessName,
        emoji: post.businessEmoji,
        type: 'social',
        category: post.businessCategory.toLowerCase(),
        hasDeal: post.hasDeal,
        lat: post.lat ?? 40.7505,
        lng: post.lng ?? -73.9845,
      });
      // Persist saved_places row when authed.
      const auth = useAuthStore.getState();
      if (auth.profile && post.businessId) {
        void savePlaceFor(auth.profile.id, post.businessId).catch(() => {});
      }
      showToast(`${post.businessName} saved to your map`);
    },

    setTab: (tab) =>
      set((s) => {
        s.activeTab = tab;
      }),

    prependPost: (post) =>
      set((s) => {
        s.posts.unshift(post);
      }),

    hydrate: (posts) =>
      set((s) => {
        s.posts = posts;
        s.hydrated = true;
        s.loading = false;
      }),

    setLoading: (loading) =>
      set((s) => {
        s.loading = loading;
      }),
  })),
);
