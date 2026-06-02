import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useMapStore } from './mapStore';
import { showToast } from './toastStore';
import { useAuthStore } from './authStore';
import {
  savePlaceFor,
  toggleFollow,
  togglePostHype,
  togglePostLike,
  unsavePlaceFor,
} from '../lib/supabaseApi';
import { autoPin } from '../lib/autoPin';

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
  hypeCount: number;
  commentCount?: number;
  distanceMiles: number;
  isLiked: boolean;
  isHyped: boolean;
  isPinned: boolean;
  isFollowing: boolean;
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
  /** Global mute flag — persists as the user scrolls between full-screen cards. */
  isMuted: boolean;

  likePost: (id: string) => void;
  hypePost: (id: string) => void;
  pinPost: (id: string) => void;
  followFromPost: (id: string) => void;
  setTab: (tab: FeedTab) => void;
  prependPost: (post: FeedPost) => void;
  removePost: (id: string) => void;
  hydrate: (posts: FeedPost[]) => void;
  setLoading: (loading: boolean) => void;
  toggleMute: () => void;
}


export const useFeedStore = create<FeedState>()(
  immer((set, get) => ({
    posts: [],
    activeTab: 'updates',
    isMuted: true,
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
      const userId = auth.profile.id;
      void togglePostLike(userId, id, nextLiked).catch(() => {
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
      // Liking a post auto-pins the business to the user's map. Side-effect;
      // we don't block on it or surface a toast.
      if (nextLiked && pre.businessId) void autoPin(pre.businessId, userId);
    },

    hypePost: (id) => {
      const auth = useAuthStore.getState();
      if (!auth.profile) {
        auth.showGuestPrompt('hype');
        return;
      }
      const pre = get().posts.find((p) => p.id === id);
      if (!pre) return;
      const nextHyped = !pre.isHyped;
      set((s) => {
        const post = s.posts.find((p) => p.id === id);
        if (!post) return;
        post.isHyped = nextHyped;
        post.hypeCount = nextHyped
          ? post.hypeCount + 1
          : Math.max(0, post.hypeCount - 1);
      });
      const userId = auth.profile.id;
      void togglePostHype(userId, id, nextHyped).catch(() => {
        set((s) => {
          const post = s.posts.find((p) => p.id === id);
          if (!post) return;
          post.isHyped = !nextHyped;
          post.hypeCount = nextHyped
            ? Math.max(0, post.hypeCount - 1)
            : post.hypeCount + 1;
        });
        showToast('Could not save hype. Try again.');
      });
      // Hype = public recommendation; auto-pin so the user's map grows along
      // with what they recommend to others.
      if (nextHyped && pre.businessId) void autoPin(pre.businessId, userId);
    },

    pinPost: (id) => {
      const auth = useAuthStore.getState();
      const post = get().posts.find((p) => p.id === id);
      if (!post) return;
      if (!auth.profile) {
        auth.showGuestPrompt('save');
        return;
      }
      if (!post.businessId) return; // we need a real business to save

      const wasPinned = post.isPinned;
      const userId = auth.profile.id;

      // Optimistic toggle first.
      set((s) => {
        const p = s.posts.find((x) => x.id === id);
        if (p) p.isPinned = !wasPinned;
      });

      if (wasPinned) {
        // UNPIN — drop the local pin and delete the saved_places row.
        useMapStore.getState().removeSavedPlace(`feed_${post.id}`);
        useMapStore.getState().removeSavedPlace(post.businessId);
        showToast('Removed from your map');
        void unsavePlaceFor(userId, post.businessId).catch(() => {
          // Restore optimistic state on failure.
          set((s) => {
            const p = s.posts.find((x) => x.id === id);
            if (p) p.isPinned = true;
          });
          showToast('Could not remove. Try again.');
        });
      } else {
        // PIN — add a local pin (if we have coords) and write the row.
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
        void savePlaceFor(userId, post.businessId).catch(() => {
          set((s) => {
            const p = s.posts.find((x) => x.id === id);
            if (p) p.isPinned = false;
          });
          useMapStore.getState().removeSavedPlace(`feed_${post.id}`);
          showToast('Could not save. Try again.');
        });
      }
    },

    followFromPost: (id) => {
      const auth = useAuthStore.getState();
      const post = get().posts.find((p) => p.id === id);
      if (!post || !post.businessId) return;
      if (!auth.profile) {
        auth.showGuestPrompt('follow');
        return;
      }
      const wasFollowing = post.isFollowing;
      const userId = auth.profile.id;
      // Mirror the new follow state across every card belonging to this
      // business — that's the whole point of follow being per-business, not
      // per-post.
      set((s) => {
        for (const p of s.posts) {
          if (p.businessId === post.businessId) p.isFollowing = !wasFollowing;
        }
      });
      showToast(wasFollowing ? `Unfollowed ${post.businessName}` : `Following ${post.businessName}`);
      void toggleFollow(userId, post.businessId, !wasFollowing).catch(() => {
        // Revert across the same set.
        set((s) => {
          for (const p of s.posts) {
            if (p.businessId === post.businessId) p.isFollowing = wasFollowing;
          }
        });
        showToast('Could not update follow. Try again.');
      });
      // Auto-pin the business when the user starts following.
      if (!wasFollowing) void autoPin(post.businessId, userId);
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

    toggleMute: () =>
      set((s) => {
        s.isMuted = !s.isMuted;
      }),
  })),
);
