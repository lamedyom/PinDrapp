import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMapStore } from '../stores/mapStore';
import { useFeedStore } from '../stores/feedStore';
import { useDealStore } from '../stores/dealStore';
import {
  fetchDeals,
  fetchExploreBusinesses,
  fetchFeed,
  fetchSavedPlaces,
} from '../lib/supabaseApi';

/**
 * Once the auth stage is `authenticated`, hydrate the feed / deals /
 * explore / saved-places stores from Supabase. Re-runs whenever the
 * user's profile id changes (sign in, sign out into another account).
 */
export function useBootstrap(): void {
  const stage = useAuthStore((s) => s.stage);
  const profile = useAuthStore((s) => s.profile);
  const userLocation = useMapStore((s) => s.userLocation);

  useEffect(() => {
    if (stage !== 'authenticated' || !profile) return;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [feed, deals, explore, saved] = await Promise.all([
          fetchFeed(userLocation, profile.id),
          fetchDeals(userLocation),
          fetchExploreBusinesses(userLocation),
          fetchSavedPlaces(profile.id),
        ]);
        if (cancelled) return;
        if (feed.length > 0) useFeedStore.getState().hydrate(feed);
        if (deals.length > 0) useDealStore.getState().hydrate(deals);
        useMapStore.getState().hydrateExplore(explore);
        useMapStore.getState().hydrateSaved(saved);
      } catch {
        // Network blip — keep showing whatever's in the stores (mock seed
        // for first-time sign-ins, or last good fetch).
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
    // Re-fetch when the user signs in/out, or once when we first know
    // their GPS — that gives accurate distances on the explore + deals lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, profile?.id, !!userLocation]);
}
