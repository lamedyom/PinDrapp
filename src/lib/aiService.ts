/**
 * Client-side AI Deal Autopilot service.
 *
 * In production this calls the Pindrapp backend (`/api/ai/...`) which talks
 * to Claude + Replicate. In the offline demo (no backend reachable) it falls
 * back to a deterministic mock so the UI is fully demo-able.
 */
import { useCatalogStore } from '../stores/catalogStore';

const ENV_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export interface AISuggestion {
  catalog_item_id: string;
  catalog_item_name: string;
  headline: string;
  description: string;
  pricing_type: 'fixed' | 'percent';
  original_price: number;
  deal_price: number;
  discount_percent: number;
  recommended_duration_hours: number;
  recommended_post_time_offset_minutes: number;
  reasoning: string;
  image_prompt: string;
}

export interface AISuggestionResponse {
  suggestion: AISuggestion;
  generatedImageUrl: string;
  catalogItemPhoto: string | null;
  recommendedPostTime: string;
  postTimeReason: string;
}

export async function suggestDeal(businessId: string): Promise<AISuggestionResponse> {
  if (ENV_BASE) {
    try {
      const res = await fetch(`${ENV_BASE}/api/ai/suggest-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      if (res.ok) return (await res.json()) as AISuggestionResponse;
    } catch {
      /* fall through to mock */
    }
  }
  // Give the mock a small artificial delay so the loading messages display.
  await new Promise((r) => setTimeout(r, 1400));
  return mockSuggest();
}

export async function regenerateDealImage(args: {
  businessId: string;
  imagePrompt: string;
  catalogItemPhoto?: string | null;
  regenerationCount: number;
}): Promise<{ generatedImageUrl: string }> {
  if (args.regenerationCount >= 3) {
    throw new Error('Max regenerations reached');
  }
  if (ENV_BASE) {
    try {
      const res = await fetch(`${ENV_BASE}/api/ai/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (res.ok) return (await res.json()) as { generatedImageUrl: string };
    } catch {
      /* fall through */
    }
  }
  await new Promise((r) => setTimeout(r, 900));
  return { generatedImageUrl: makeMockImage(args.imagePrompt, args.regenerationCount + 1) };
}

function mockSuggest(): AISuggestionResponse {
  const items = useCatalogStore.getState().items;
  const available = items.filter((i) => i.isAvailable);
  const item = available[Math.floor(Math.random() * available.length)] ?? items[0];
  const hour = new Date().getHours();
  const part =
    hour < 11
      ? 'morning crowd'
      : hour < 14
        ? 'lunch rush'
        : hour < 17
          ? 'afternoon lull'
          : hour < 20
            ? 'dinner rush'
            : 'late night';
  const regular = item?.regularPrice ?? 14;
  const deal = Math.max(1, Math.round(regular * 0.7));
  const percent = Math.round((1 - deal / regular) * 100);
  const headlineBase = `${percent}% Off ${item?.name ?? 'Today’s Special'}`;
  const headline = headlineBase.length > 60 ? headlineBase.slice(0, 60) : headlineBase;
  const reasoning =
    `Your ${item?.name ?? 'best seller'} hasn't been on deal this week. ` +
    `${item?.category ?? 'This category'} deals see strong claims during the ${part} window in your area, ` +
    `and nearby competitors aren't running a comparable offer right now.`;
  const duration = hour < 11 ? 4 : hour < 17 ? 2 : 4;
  const offsetMin = hour < 17 ? 0 : 30;
  const postTime = new Date(Date.now() + offsetMin * 60 * 1000);
  return {
    suggestion: {
      catalog_item_id: item?.id ?? '',
      catalog_item_name: item?.name ?? 'Featured item',
      headline,
      description: `Limited-time price on our ${(item?.name ?? 'house special').toLowerCase()}. Walk in and mention this deal.`,
      pricing_type: 'fixed',
      original_price: regular,
      deal_price: deal,
      discount_percent: percent,
      recommended_duration_hours: duration,
      recommended_post_time_offset_minutes: offsetMin,
      reasoning,
      image_prompt: `appetizing professional photo of ${item?.name ?? 'a meal'}, clean background, vibrant colors`,
    },
    generatedImageUrl: makeMockImage(item?.name ?? 'Featured Deal', 0),
    catalogItemPhoto: item?.photoUrl ?? null,
    recommendedPostTime: postTime.toISOString(),
    postTimeReason: timeReason(hour),
  };
}

function timeReason(hour: number): string {
  if (hour < 11) return 'Morning commuters are most active now';
  if (hour < 14) return 'Lunch rush — peak deal claiming time';
  if (hour < 17) return 'Afternoon browse — good for scheduling dinner deals';
  if (hour < 20) return 'Dinner rush — highest conversion time of day';
  return 'Late night — great for next-day early bird deals';
}

function makeMockImage(label: string, seed: number): string {
  const palette = [
    ['#1a0d2e', '#0d1f3c'],
    ['#0f1f0f', '#1a2a1a'],
    ['#2a1a00', '#1a1000'],
    ['#2a0a0a', '#1a1020'],
  ];
  const [a, b] = palette[seed % palette.length];
  const safe = label.replace(/[<>&]/g, '').slice(0, 32);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="540" viewBox="0 0 540 540">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="540" height="540" fill="url(#g)"/>` +
    `<text x="50%" y="48%" text-anchor="middle" font-family="Georgia,serif" font-size="56" fill="#fff" opacity="0.92">${safe}</text>` +
    `<text x="50%" y="58%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#fff" opacity="0.55">AI-generated preview</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
