/**
 * All Supabase queries + storage helpers for Pindrapp live here.
 *
 * Every function gracefully no-ops (returns null / []) when Supabase isn't
 * configured, so callers don't need defensive branching for the offline
 * demo mode.
 */
import { supabase } from './supabase';
import type { FeedPost } from '../stores/feedStore';
import type { Deal } from '../stores/dealStore';
import type { SavedPlace, ExploreBusiness } from '../stores/mapStore';

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  bio: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  avatar_url: string | null;
  follower_count: number;
}

interface PostRow {
  id: string;
  business_id: string;
  caption: string;
  video_url: string | null;
  thumbnail_url: string | null;
  like_count: number;
  created_at: string;
  business: BusinessRow | BusinessRow[] | null;
}

interface DealRow {
  id: string;
  business_id: string;
  headline: string;
  description: string | null;
  original_price: number | null;
  deal_price: number | null;
  discount_percent: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  business: BusinessRow | BusinessRow[] | null;
}

interface SavedPlaceRow {
  id: string;
  user_id: string;
  business_id: string;
  created_at: string;
  business: BusinessRow | BusinessRow[] | null;
}

// Supabase returns relations as either object or array depending on cardinality
// inference. Normalize to a single row.
function relOne<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function gradientFor(category: string): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('food') || c.includes('steak') || c.includes('grill'))
    return 'linear-gradient(160deg,#2a1015,#0d1f1a)';
  if (c.includes('coffee') || c.includes('bakery'))
    return 'linear-gradient(160deg,#2a1a00,#1a1000)';
  if (c.includes('fashion') || c.includes('shopping') || c.includes('boutique'))
    return 'linear-gradient(160deg,#0d1f3c,#1a0d2e)';
  if (c.includes('vegan') || c.includes('juice') || c.includes('green'))
    return 'linear-gradient(160deg,#0f1f0f,#1a2a1a)';
  return 'linear-gradient(160deg,#1a1018,#0d1118)';
}

function emojiForCategory(category: string): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('food') || c.includes('restaurant') || c.includes('steak')) return '🍽️';
  if (c.includes('pizza')) return '🍕';
  if (c.includes('coffee')) return '☕';
  if (c.includes('bakery')) return '🥐';
  if (c.includes('fashion') || c.includes('boutique')) return '👗';
  if (c.includes('jewelry')) return '💎';
  if (c.includes('beauty')) return '💅';
  if (c.includes('fitness')) return '🏋️';
  if (c.includes('book')) return '📚';
  if (c.includes('electronics') || c.includes('tech')) return '📱';
  if (c.includes('music')) return '🎵';
  if (c.includes('wine')) return '🍷';
  if (c.includes('market')) return '🛒';
  if (c.includes('health')) return '🏥';
  if (c.includes('event')) return '🎉';
  return '📍';
}

function distanceMiFrom(
  user: { lat: number; lng: number } | null,
  to: { lat: number | null; lng: number | null },
): number {
  if (!user || to.lat == null || to.lng == null) return 0;
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - user.lat);
  const dLng = toRad(to.lng - user.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(user.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.621371;
}

// ───────────────────────────────────────────────────────────────────────────
// FEED
// ───────────────────────────────────────────────────────────────────────────

export async function fetchFeed(
  near?: { lat: number; lng: number } | null,
  forUserId?: string,
): Promise<FeedPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*, business:businesses(*)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  // Pull the user's likes and pinned businesses for badges.
  const likedPostIds = forUserId ? await fetchUserLikedPostIds(forUserId) : new Set<string>();
  const pinnedBusinessIds = forUserId
    ? await fetchUserSavedBusinessIds(forUserId)
    : new Set<string>();

  // Also pull active deals to attach dealId to each post by business
  const activeDealsByBusiness = await fetchActiveDealsByBusinessId();

  return (data as PostRow[]).map((row) => {
    const biz = relOne(row.business);
    const dealForBiz = biz ? activeDealsByBusiness.get(biz.id) ?? null : null;
    return {
      id: row.id,
      businessId: row.business_id,
      businessName: biz?.name ?? 'Business',
      businessCategory: biz?.category ?? '',
      businessEmoji: emojiForCategory(biz?.category ?? ''),
      caption: row.caption,
      likeCount: row.like_count,
      distanceMiles: distanceMiFrom(near ?? null, {
        lat: biz?.lat ?? null,
        lng: biz?.lng ?? null,
      }),
      isLiked: likedPostIds.has(row.id),
      isPinned: biz ? pinnedBusinessIds.has(biz.id) : false,
      hasDeal: !!dealForBiz,
      dealId: dealForBiz?.id,
      createdAt: new Date(row.created_at),
      videoUrl: row.video_url ?? undefined,
      thumbnailGradient: gradientFor(biz?.category ?? ''),
      lat: biz?.lat ?? undefined,
      lng: biz?.lng ?? undefined,
    } satisfies FeedPost;
  });
}

async function fetchUserLikedPostIds(userId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase.from('likes').select('post_id').eq('user_id', userId);
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

async function fetchUserSavedBusinessIds(userId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase
    .from('saved_places')
    .select('business_id')
    .eq('user_id', userId);
  return new Set((data ?? []).map((r: { business_id: string }) => r.business_id));
}

// ───────────────────────────────────────────────────────────────────────────
// DEALS
// ───────────────────────────────────────────────────────────────────────────

export async function fetchDeals(
  near?: { lat: number; lng: number } | null,
): Promise<Deal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('deals')
    .select('*, business:businesses(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as DealRow[]).map((row, i) => {
    const biz = relOne(row.business);
    return {
      id: row.id,
      businessName: biz?.name ?? 'Business',
      category: biz?.category ?? 'Food',
      emoji: emojiForCategory(biz?.category ?? ''),
      headline: row.headline,
      description: row.description ?? '',
      originalPrice: row.original_price,
      dealPrice: row.deal_price,
      discountPercent: row.discount_percent,
      expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(Date.now() + 4 * 3600000),
      distanceMiles: distanceMiFrom(near ?? null, {
        lat: biz?.lat ?? null,
        lng: biz?.lng ?? null,
      }),
      isFeatured: i === 0,
      stripeProductId: row.id,
      lat: biz?.lat ?? undefined,
      lng: biz?.lng ?? undefined,
    } satisfies Deal;
  });
}

async function fetchActiveDealsByBusinessId(): Promise<
  Map<string, { id: string }>
> {
  const out = new Map<string, { id: string }>();
  if (!supabase) return out;
  const { data } = await supabase
    .from('deals')
    .select('id, business_id, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  for (const row of (data ?? []) as { id: string; business_id: string }[]) {
    if (!out.has(row.business_id)) out.set(row.business_id, { id: row.id });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// MAP / PLACES
// ───────────────────────────────────────────────────────────────────────────

export async function fetchExploreBusinesses(
  near?: { lat: number; lng: number } | null,
): Promise<ExploreBusiness[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('businesses')
    .select('id, name, category, lat, lng')
    .order('created_at', { ascending: false })
    .limit(60);
  if (!data) return [];
  const activeDeals = await fetchActiveDealsByBusinessId();
  return (data as BusinessRow[])
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      id: b.id,
      name: b.name,
      emoji: emojiForCategory(b.category),
      category: b.category,
      distanceMiles: distanceMiFrom(near ?? null, { lat: b.lat, lng: b.lng }),
      hasDeal: activeDeals.has(b.id),
      lat: b.lat ?? 0,
      lng: b.lng ?? 0,
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export async function fetchSavedPlaces(userId: string): Promise<SavedPlace[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('saved_places')
    .select('id, business_id, created_at, business:businesses(*)')
    .eq('user_id', userId);
  if (!data) return [];
  const activeDeals = await fetchActiveDealsByBusinessId();
  return (data as SavedPlaceRow[])
    .map((r) => {
      const biz = relOne(r.business);
      if (!biz || biz.lat == null || biz.lng == null) return null;
      return {
        id: `sp_${r.id}`,
        name: biz.name,
        emoji: emojiForCategory(biz.category),
        type: 'social',
        category: biz.category,
        hasDeal: activeDeals.has(biz.id),
        placeName: biz.address ?? undefined,
        lat: biz.lat,
        lng: biz.lng,
        savedAt: new Date(r.created_at),
      } satisfies SavedPlace;
    })
    .filter(Boolean) as SavedPlace[];
}

// ───────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ───────────────────────────────────────────────────────────────────────────

export async function togglePostLike(
  userId: string,
  postId: string,
  liked: boolean,
): Promise<void> {
  if (!supabase) return;
  if (liked) {
    await supabase.from('likes').upsert(
      { user_id: userId, post_id: postId },
      { onConflict: 'user_id,post_id' },
    );
  } else {
    await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
  }
}

export async function savePlaceFor(
  userId: string,
  businessId: string,
): Promise<void> {
  if (!supabase) return;
  await supabase.from('saved_places').upsert(
    { user_id: userId, business_id: businessId },
    { onConflict: 'user_id,business_id' },
  );
}

export async function unsavePlaceFor(
  userId: string,
  businessId: string,
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('business_id', businessId);
}

export interface CreatePostInput {
  businessId: string;
  caption: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export async function createPost(input: CreatePostInput): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('posts')
    .insert({
      business_id: input.businessId,
      caption: input.caption,
      video_url: input.videoUrl ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

export interface CreateDealInput {
  businessId: string;
  headline: string;
  description?: string;
  originalPrice?: number | null;
  dealPrice?: number | null;
  discountPercent?: number | null;
  expiresAt: Date;
}

export async function createDeal(input: CreateDealInput): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('deals')
    .insert({
      business_id: input.businessId,
      headline: input.headline,
      description: input.description ?? '',
      original_price: input.originalPrice ?? null,
      deal_price: input.dealPrice ?? null,
      discount_percent: input.discountPercent ?? null,
      expires_at: input.expiresAt.toISOString(),
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// STORAGE (avatars + videos)
// ───────────────────────────────────────────────────────────────────────────

async function uploadTo(
  bucket: 'avatars' | 'videos',
  file: File | Blob,
  fileNameHint?: string,
): Promise<string | null> {
  if (!supabase) return null;
  const ext =
    fileNameHint?.split('.').pop()?.toLowerCase() ??
    (file.type.split('/')[1] ?? 'bin');
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(file: File | Blob): Promise<string | null> {
  return uploadTo('avatars', file, file instanceof File ? file.name : undefined);
}

export async function uploadVideo(file: File | Blob): Promise<string | null> {
  return uploadTo('videos', file, file instanceof File ? file.name : undefined);
}
