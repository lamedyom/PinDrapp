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
  removePost: (id: string) => void;
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
      const auth = useAuthStore.getState();
      // Guests get the sign-up sheet instead of an optimistic UI bump.
      if (!auth.profile) {
        auth.showGuestPrompt('like');
        return;
      }
      // Snapshot the pre-toggle state so we can revert if Supabase rejects.
      const pre = get().posts.find((p) => p.id === id);
      if (!pre) return;
      const nextLiked = !pre.isLiked;
      set((s) => {
        const post = s.posts.find((p) => p.id === id);
        if (!post) return;
        post.isLiked = nextLiked;
        post.likeCount = nextLiked
          ? post.likeCount + 1
          : Math.max(0, post.likeCount - 1);
      });
      void togglePostLike(auth.profile.id, id, nextLiked).catch(() => {
        // Revert the optimistic update; the row never landed.
        set((s) => {
          const post = s.posts.find((p) => p.id === id);
          if (!post) return;
          post.isLiked = !nextLiked;
          post.likeCount = nextLiked
            ? Math.max(0, post.likeCount - 1)
            : post.likeCount + 1;
        });
        showToast('Could not save like. Try again.');
      });
    },

    pinPost: (id) => {
      const auth = useAuthStore.getState();
      const post = get().posts.find((p) => p.id === id);
      if (!post || post.isPinned) return;
      if (!auth.profile) {
        auth.showGuestPrompt('save');
        return;
      }
      if (!post.businessId) return; // we need a real business to save

      // Optimistic UI first.
      set((s) => {
        const p = s.posts.find((x) => x.id === id);
        if (p) p.isPinned = true;
      });
      // Drop a local pin when we have coordinates — no city fallbacks.
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
      showToast(`${post.businessName} saved to your map 📍`);

      // Persist; if the row never lands, revert the optimistic state.
      void savePlaceFor(auth.profile.id, post.businessId).catch(() => {
        set((s) => {
          const p = s.posts.find((x) => x.id === id);
          if (p) p.isPinned = false;
        });
        useMapStore.getState().removeSavedPlace(`feed_${post.id}`);
        showToast('Could not save. Try again.');
      });
    },

    setTab: (tab) =>
      set((s) => {
        s.activeTab = tab;
      }),

    prependPost: (post) =>
      set((s) => {
        s.posts.unshift(post);
      }),

    removePost: (id) =>
      set((s) => {
        s.posts = s.posts.filter((p) => p.id !== id);
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
