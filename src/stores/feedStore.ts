import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';
import { showToast } from './toastStore';
import { useAuthStore } from './authStore';
import { savePlaceFor, togglePostLike } from '../lib/supabaseApi';

export type FeedTab = 'updates' | 'nearby' | 'ai';

export type FeedCategory =
  | 'announcement'
  | 'menuItem'
  | 'event'
  | 'behindTheScenes'
  | 'newStock'
  | 'update';

export interface FeedPost {
  id: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  businessEmoji: string;
  caption: string;
  likeCount: number;
  commentCount?: number;
  distanceMiles: number;
  isLiked: boolean;
  isPinned: boolean;
  /** Feed posts are pure video updates — never carry pricing/deals. */
  postCategory?: FeedCategory;
  createdAt: Date;
  videoUrl?: string;
  thumbnailGradient: string;
  isLive?: boolean;
  isPro?: boolean;
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


export const useFeedStore = create<FeedState>()(
  immer((set, get) => ({
    posts: [],
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
      // Only add to the local map if the post carries real coordinates —
      // no city fallbacks. The Supabase saved_places row is the source of
      // truth and will hydrate the pin with whatever the business has.
      if (post.lat != null && post.lng != null) {
        useMapStore.getState().addSavedPlace({
          id: `feed_${post.id}`,
          name: post.businessName,
          emoji: post.businessEmoji,
          type: 'social',
          category: post.businessCategory.toLowerCase(),
          hasDeal: false,
          businessId: post.businessId,
          lat: post.lat,
          lng: post.lng,
        });
      }
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
