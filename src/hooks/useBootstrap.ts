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

/**
 * Once authenticated, hydrate the feed / deals / explore / saved-places
 * stores from Supabase and keep them live via realtime subscriptions.
 *
 * No-op in 'disabled' mode (no Supabase) — the stores keep their mock seed.
 */
export function useBootstrap(): void {
  const stage = useAuthStore((s) => s.stage);
  const profile = useAuthStore((s) => s.profile);
  const businessId = useAuthStore((s) => s.business?.id);
  const userLat = useMapStore((s) => s.userLocation?.lat);
  const userLng = useMapStore((s) => s.userLocation?.lng);

  useEffect(() => {
    if (stage !== 'authenticated' || !profile || !supabase) return;
    let cancelled = false;
    const sb = supabase;
    const near =
      userLat != null && userLng != null ? { lat: userLat, lng: userLng } : null;

    const loadFeed = async () => {
      try {
        const feed = await fetchFeed(near, profile.id);
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
        const deals = await fetchDeals(near);
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
        const [explore, saved] = await Promise.all([
          fetchExploreBusinesses(near),
          fetchSavedPlaces(profile.id),
        ]);
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
        const items = await fetchCatalog(businessId);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, refetchFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_places' }, refetchMap)
      .subscribe();

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, profile?.id, businessId, userLat, userLng]);
}

function msg(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  return m ? ` — ${m}` : '';
}
