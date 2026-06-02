import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMapStore } from '../stores/mapStore';
import { useFeedStore } from '../stores/feedStore';
import { useDealStore } from '../stores/dealStore';
import { useCatalogStore } from '../stores/catalogStore';
import { supabase } from '../lib/supabase';
import { showToast } from '../stores/toastStore';
import {
  fetchCatalog,
  fetchDeals,
  fetchExploreBusinesses,
  fetchFeed,
  fetchSavedPlaces,
} from '../lib/supabaseApi';

// Cap any Supabase round-trip on initial bootstrap at 5s. A slow network
// or paused project shouldn't leave the user staring at a skeleton forever —
// the screens have empty states ready to render.
const QUERY_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS}ms`)),
      QUERY_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Hydrates the public stores (feed / deals / explore businesses) from
 * Supabase as soon as the client is configured, and keeps them live via a
 * realtime channel. Per-user reads (likes, saved places, catalog) only run
 * when a profile is signed in.
 *
 * In offline demo mode (no Supabase) the stores stay empty and screens
 * show their normal empty states.
 */
export function useBootstrap(): void {
  const stage = useAuthStore((s) => s.stage);
  const userId = useAuthStore((s) => s.profile?.id);
  const businessId = useAuthStore((s) => s.business?.id);
  const userLat = useMapStore((s) => s.userLocation?.lat);
  const userLng = useMapStore((s) => s.userLocation?.lng);

  useEffect(() => {
    // We want feed/deals/explore to show up for guests too — Supabase RLS
    // already gates writes; public SELECTs are open. We only bail out when
    // Supabase isn't configured at all, or while auth init is still pending.
    if (!supabase || stage === 'loading') return;
    let cancelled = false;
    const sb = supabase;
    const near =
      userLat != null && userLng != null ? { lat: userLat, lng: userLng } : null;

    const loadFeed = async () => {
      try {
        const feed = await withTimeout(fetchFeed(near, userId), 'feed');
        if (!cancelled) useFeedStore.getState().hydrate(feed);
      } catch (e) {
        if (!cancelled) {
          useFeedStore.getState().setLoading(false);
          showToast(`Couldn't load feed${msg(e)}`);
        }
      }
    };

    const loadDeals = async () => {
      try {
        const deals = await withTimeout(fetchDeals(near, userId), 'deals');
        if (!cancelled) useDealStore.getState().hydrate(deals);
      } catch (e) {
        if (!cancelled) {
          useDealStore.getState().setLoading(false);
          showToast(`Couldn't load deals${msg(e)}`);
        }
      }
    };

    const loadMap = async () => {
      try {
        const explorePromise = withTimeout(fetchExploreBusinesses(near), 'explore');
        // Saved places are per-user; guests see no pins they didn't save.
        const savedPromise = userId
          ? withTimeout(fetchSavedPlaces(userId), 'saved')
          : Promise.resolve([]);
        const [explore, saved] = await Promise.all([explorePromise, savedPromise]);
        if (cancelled) return;
        useMapStore.getState().hydrateExplore(explore);
        useMapStore.getState().hydrateSaved(saved);
      } catch {
        // map keeps whatever it has; non-fatal
      }
    };

    const loadCatalog = async () => {
      if (!businessId) return;
      try {
        const items = await withTimeout(fetchCatalog(businessId), 'catalog');
        if (!cancelled && items.length) useCatalogStore.getState().hydrate(items);
      } catch {
        // catalog keeps its seed; non-fatal
      }
    };

    // Initial load with loading flags so screens can show skeletons.
    useFeedStore.getState().setLoading(true);
    useDealStore.getState().setLoading(true);
    void loadFeed();
    void loadDeals();
    void loadMap();
    void loadCatalog();

    // Soft refresh of the map's explore pins every 5 minutes — picks up new
    // businesses without requiring the user to drag the map or reload.
    // Realtime channels below already react to deal/saved-place changes; this
    // catches plain `businesses` inserts which aren't on the channel.
    const mapInterval = window.setInterval(() => {
      void loadMap();
    }, 5 * 60 * 1000);

    // ── Realtime: refetch on any change (debounced). Payloads don't include
    // the joined business row, so a full refetch is simpler + correct than
    // surgically merging partial rows.
    const debounce = (fn: () => void, ms = 400) => {
      let t: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const refetchFeed = debounce(loadFeed);
    const refetchDeals = debounce(loadDeals);
    const refetchMap = debounce(loadMap);

    const channel = sb
      .channel('pindrapp-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, refetchFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        refetchDeals();
        refetchMap(); // deals affect green pins on the map
      })
      // Surface a tiny "new deal nearby" toast when an active deal is inserted.
      // Listening as a separate handler lets us inspect the row's is_active flag.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deals' },
        (payload) => {
          const row = payload.new as { is_active?: boolean } | null;
          if (row?.is_active) showToast('⚡ New deal from a business near you!');
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        refetchFeed();
        refetchDeals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hypes' }, () => {
        refetchFeed();
        refetchDeals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'followers' }, () => {
        refetchFeed();
        refetchDeals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_places' }, refetchMap)
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(mapInterval);
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, userId, businessId, userLat, userLng]);
}

function msg(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  return m ? ` — ${m}` : '';
}
