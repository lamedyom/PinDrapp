/**
 * Client wrapper for the Radar AI search experience.
 *
 * In production POST /api/radar/search asks Claude to interpret the user's
 * query against the live businesses + active deals tables. In the offline
 * demo we fall back to a deterministic keyword filter against whatever is
 * in mapStore.explorePlaces, so the UI is always reactive.
 */
import { useMapStore, type ExploreBusiness } from '../stores/mapStore';
import { useDealStore, type Deal } from '../stores/dealStore';

const ENV_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export interface RadarBusinessResult {
  id: string;
  name: string;
  category: string;
  address: string | null;
  distanceMiles: number | null;
  emoji: string;
  avatarUrl: string | null;
  hasActiveDeal: boolean;
  dealHeadline: string | null;
  lat: number;
  lng: number;
}

export interface RadarResponse {
  message: string;
  businesses: RadarBusinessResult[];
}

export async function searchRadar(
  query: string,
  near?: { lat: number; lng: number } | null,
): Promise<RadarResponse> {
  const q = query.trim();
  if (!q) return { message: '', businesses: [] };

  if (ENV_BASE) {
    try {
      const res = await fetch(`${ENV_BASE}/api/radar/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          userLat: near?.lat ?? null,
          userLng: near?.lng ?? null,
        }),
      });
      if (res.ok) return (await res.json()) as RadarResponse;
    } catch {
      /* fall through to mock */
    }
  }

  // Mock — small artificial delay so the loading state actually animates.
  await new Promise((r) => setTimeout(r, 700));
  return mockSearch(q);
}

function mockSearch(query: string): RadarResponse {
  const ql = query.toLowerCase();
  const tokens = ql.split(/\s+/).filter((t) => t.length > 1);

  // Score every explore business by how many query tokens hit its
  // name/category. Sort highest first; cap at 6 results.
  const businesses = useMapStore.getState().explorePlaces;
  const activeDeals = useDealStore.getState().deals.filter(
    (d) => d.expiresAt.getTime() > Date.now(),
  );
  const dealsByBiz = new Map<string, Deal>();
  for (const d of activeDeals) if (d.businessId) dealsByBiz.set(d.businessId, d);

  const scored = businesses
    .map((b) => ({
      b,
      score:
        tokens.reduce((acc, t) => {
          if (b.name.toLowerCase().includes(t)) return acc + 2;
          if (b.category.toLowerCase().includes(t)) return acc + 1;
          return acc;
        }, 0) +
        // "deals" / "deal" boosts businesses with an active deal
        (/(deal|sale|offer)/.test(ql) && dealsByBiz.has(b.id) ? 3 : 0),
    }))
    .filter((x) => x.score > 0 || /(near|around|nearby|all)/.test(ql))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const matches: ExploreBusiness[] = scored.map((x) => x.b);
  const results: RadarBusinessResult[] = matches.map((b) => {
    const deal = dealsByBiz.get(b.id) ?? null;
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      address: null,
      distanceMiles: b.distanceMiles,
      emoji: b.emoji,
      avatarUrl: null,
      hasActiveDeal: !!deal,
      dealHeadline: deal?.headline ?? null,
      lat: b.lat,
      lng: b.lng,
    };
  });

  let message: string;
  if (results.length === 0) {
    message =
      "I didn't find any matches on Pindrapp yet. Try a broader term — like a category, or 'deals nearby'.";
  } else if (results.length === 1) {
    message = `Best match: ${results[0].name}${results[0].hasActiveDeal ? ' — they have an active deal right now.' : '.'}`;
  } else {
    const top = results.slice(0, 3).map((r) => r.name);
    message = `Found ${results.length} matches near you. ${top.join(', ')}${results.length > 3 ? ', and more' : ''}.`;
  }

  return { message, businesses: results };
}
