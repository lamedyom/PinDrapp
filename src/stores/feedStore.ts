import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';
import { showToast } from './toastStore';

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

  likePost: (id: string) => void;
  pinPost: (id: string) => void;
  setTab: (tab: FeedTab) => void;
  prependPost: (post: FeedPost) => void;
}

const mockPosts: FeedPost[] = [
  {
    id: 'p1',
    businessId: 'b1',
    businessName: 'Prime Grill',
    businessCategory: 'Steakhouse',
    businessEmoji: '🥩',
    caption: 'Shabbos special tonight — hand-cut ribeye, $44. Tables available, walk-ins welcome.',
    likeCount: 148,
    distanceMiles: 0.3,
    isLiked: false,
    isPinned: true,
    hasDeal: true,
    dealId: 'd1',
    createdAt: new Date(Date.now() - 3600000),
    thumbnailGradient: 'linear-gradient(160deg,#1a0d2e,#0d1f3c)',
    lat: 40.751,
    lng: -73.982,
  },
  {
    id: 'p2',
    businessId: 'b2',
    businessName: 'Green Garden',
    businessCategory: 'Vegan',
    businessEmoji: '🥗',
    caption: 'Flash deal: any grain bowl 30% off today only until 8pm. Come in!',
    likeCount: 87,
    distanceMiles: 0.6,
    isLiked: false,
    isPinned: false,
    hasDeal: true,
    dealId: 'd2',
    createdAt: new Date(Date.now() - 7200000),
    thumbnailGradient: 'linear-gradient(160deg,#0f1f0f,#1a2a1a)',
    isLive: true,
    lat: 40.749,
    lng: -73.987,
  },
  {
    id: 'p3',
    businessId: 'b3',
    businessName: 'Challah Co.',
    businessCategory: 'Bakery',
    businessEmoji: '🥐',
    caption: 'Fresh out the oven — sesame challah rolls. Buy a dozen this Friday, get 6 free.',
    likeCount: 203,
    distanceMiles: 0.8,
    isLiked: true,
    isPinned: false,
    hasDeal: true,
    dealId: 'd3',
    createdAt: new Date(Date.now() - 10800000),
    thumbnailGradient: 'linear-gradient(160deg,#2a1a00,#1a1000)',
    lat: 40.7478,
    lng: -73.988,
  },
  {
    id: 'p4',
    businessId: 'b4',
    businessName: "Rivka's Boutique",
    businessCategory: 'Fashion',
    businessEmoji: '👗',
    caption: 'New summer collection just dropped. 20% off everything today — in store only.',
    likeCount: 56,
    distanceMiles: 1.1,
    isLiked: false,
    isPinned: false,
    hasDeal: true,
    dealId: 'd4',
    createdAt: new Date(Date.now() - 14400000),
    thumbnailGradient: 'linear-gradient(160deg,#0d1f3c,#1a0d2e)',
    lat: 40.753,
    lng: -73.98,
  },
  {
    id: 'p5',
    businessId: 'b5',
    businessName: 'Solo Pizza',
    businessCategory: 'Italian',
    businessEmoji: '🍕',
    caption: 'Just pulled this margarita out of the stone oven. Come hungry tonight.',
    likeCount: 312,
    distanceMiles: 0.4,
    isLiked: false,
    isPinned: false,
    hasDeal: false,
    createdAt: new Date(Date.now() - 18000000),
    thumbnailGradient: 'linear-gradient(160deg,#2a0a0a,#1a1020)',
    lat: 40.7505,
    lng: -73.9845,
  },
  {
    id: 'p6',
    businessId: 'b6',
    businessName: 'Café Beit',
    businessCategory: 'Coffee',
    businessEmoji: '☕',
    caption: 'Monday morning reset. Ethiopian pour-over, slow batch. In before 9 for 10% off.',
    likeCount: 74,
    distanceMiles: 0.9,
    isLiked: false,
    isPinned: false,
    hasDeal: false,
    createdAt: new Date(Date.now() - 21600000),
    thumbnailGradient: 'linear-gradient(160deg,#1a1000,#2a1a00)',
    lat: 40.752,
    lng: -73.98,
  },
];

export const useFeedStore = create<FeedState>()(
  immer((set, get) => ({
    posts: mockPosts,
    activeTab: 'updates',

    likePost: (id) =>
      set((s) => {
        const post = s.posts.find((p) => p.id === id);
        if (!post) return;
        if (post.isLiked) {
          post.isLiked = false;
          post.likeCount = Math.max(0, post.likeCount - 1);
        } else {
          post.isLiked = true;
          post.likeCount += 1;
        }
      }),

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
  })),
);
