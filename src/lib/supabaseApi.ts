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
import type { CatalogItem } from '../stores/catalogStore';
import type { SavedPlace, ExploreBusiness } from '../stores/mapStore';
import { useMapStore } from '../stores/mapStore';

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  bio: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  follower_count: number;
  is_pro: boolean | null;
  pro_since: string | null;
}

interface PostRow {
  id: string;
  business_id: string;
  caption: string;
  video_url: string | null;
  thumbnail_url: string | null;
  like_count: number;
  post_type: string | null;
  post_category: string | null;
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
  media_url: string | null;
  media_type: string | null;
  deal_category: string | null;
  view_count: number | null;
  claim_count: number | null;
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
  // Feed stream is video updates only — posts with post_type='feed'.
  const { data, error } = await supabase
    .from('posts')
    .select('*, business:businesses(*)')
    .eq('post_type', 'feed')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  // Pull the user's likes and pinned businesses for badges.
  const likedPostIds = forUserId ? await fetchUserLikedPostIds(forUserId) : new Set<string>();
  const pinnedBusinessIds = forUserId
    ? await fetchUserSavedBusinessIds(forUserId)
    : new Set<string>();

  return (data as PostRow[]).map((row) => {
    const biz = relOne(row.business);
    return {
      id: row.id,
      businessId: row.business_id,
      businessName: biz?.name ?? 'Business',
      businessCategory: biz?.category ?? '',
      businessEmoji: emojiForCategory(biz?.category ?? ''),
      caption: row.caption,
      likeCount: row.like_count,
      commentCount: 0,
      distanceMiles: distanceMiFrom(near ?? null, {
        lat: biz?.lat ?? null,
        lng: biz?.lng ?? null,
      }),
      isLiked: likedPostIds.has(row.id),
      isPinned: biz ? pinnedBusinessIds.has(biz.id) : false,
      isPro: !!biz?.is_pro,
      postCategory: (row.post_category as FeedPost['postCategory']) ?? 'update',
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
      mediaUrl: row.media_url ?? undefined,
      mediaType: (row.media_type as 'image' | 'video' | null) ?? undefined,
      dealCategory: row.deal_category ?? undefined,
      isPro: !!biz?.is_pro,
      viewCount: row.view_count ?? 0,
      claimCount: row.claim_count ?? 0,
      businessId: row.business_id,
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
    .select('id, name, category, lat, lng, is_pro')
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
      isPro: !!b.is_pro,
      lat: b.lat ?? 0,
      lng: b.lng ?? 0,
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export interface BusinessSearchResult {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lng: number;
  avatarUrl: string | null;
  emoji: string;
  isPro: boolean;
  distanceMiles: number | null;
}

/**
 * Search Pindrapp businesses by name / category / address. Falls back to the
 * seeded explore businesses in offline demo mode.
 */
export async function searchBusinesses(
  query: string,
  near?: { lat: number; lng: number } | null,
): Promise<BusinessSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (!supabase) {
    const ql = q.toLowerCase();
    return useMapStore
      .getState()
      .explorePlaces.filter(
        (b) => b.name.toLowerCase().includes(ql) || b.category.toLowerCase().includes(ql),
      )
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        address: null,
        lat: b.lat,
        lng: b.lng,
        avatarUrl: null,
        emoji: b.emoji,
        isPro: !!b.isPro,
        distanceMiles: distanceMiFrom(near ?? null, { lat: b.lat, lng: b.lng }),
      }));
  }

  // Strip characters that would break PostgREST's or() filter grammar.
  const safe = q.replace(/[%,()]/g, ' ').trim();
  if (!safe) return [];
  const { data } = await supabase
    .from('businesses')
    .select('id, name, category, address, lat, lng, avatar_url, is_pro')
    .or(`name.ilike.%${safe}%,category.ilike.%${safe}%,address.ilike.%${safe}%`)
    .limit(5);
  if (!data) return [];
  return (data as BusinessRow[])
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      address: b.address,
      lat: b.lat as number,
      lng: b.lng as number,
      avatarUrl: b.avatar_url,
      emoji: emojiForCategory(b.category),
      isPro: !!b.is_pro,
      distanceMiles: distanceMiFrom(near ?? null, { lat: b.lat, lng: b.lng }),
    }));
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
        businessId: biz.id,
        isPro: !!biz.is_pro,
        placeName: biz.address ?? undefined,
        lat: biz.lat,
        lng: biz.lng,
        savedAt: new Date(r.created_at),
      } satisfies SavedPlace;
    })
    .filter(Boolean) as SavedPlace[];
}

// ───────────────────────────────────────────────────────────────────────────
// CATALOG (per-business product/service menu — profile only)
// ───────────────────────────────────────────────────────────────────────────

interface CatalogRow {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  photo_url: string | null;
  regular_price: number | null;
  sale_price: number | null;
  tags: string[] | null;
  is_available: boolean | null;
  sort_order: number | null;
}

function mapCatalogRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    businessId: row.business_id ?? undefined,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? 'General',
    photoUrl: row.photo_url ?? null,
    regularPrice: row.regular_price,
    salePrice: row.sale_price,
    tags: row.tags ?? [],
    isAvailable: row.is_available ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

export async function fetchCatalog(businessId: string): Promise<CatalogItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return (data as CatalogRow[]).map(mapCatalogRow);
}

export interface SaveCatalogItemInput {
  id?: string;
  businessId: string;
  name: string;
  description?: string;
  category?: string;
  photoUrl?: string | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  tags?: string[];
  isAvailable?: boolean;
  sortOrder?: number;
}

export async function saveCatalogItem(
  input: SaveCatalogItemInput,
): Promise<CatalogItem | null> {
  if (!supabase) return null;
  const payload = {
    business_id: input.businessId,
    name: input.name,
    description: input.description ?? '',
    category: input.category ?? 'General',
    photo_url: input.photoUrl ?? null,
    regular_price: input.regularPrice ?? null,
    sale_price: input.salePrice ?? null,
    tags: input.tags ?? [],
    is_available: input.isAvailable ?? true,
    sort_order: input.sortOrder ?? 0,
  };
  const query = input.id
    ? supabase.from('catalog_items').update(payload).eq('id', input.id)
    : supabase.from('catalog_items').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data ? mapCatalogRow(data as CatalogRow) : null;
}

export async function deleteCatalogItem(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('catalog_items').delete().eq('id', id);
}

// ───────────────────────────────────────────────────────────────────────────
// BUSINESS PROFILE (everything one profile page needs, in parallel)
// ───────────────────────────────────────────────────────────────────────────

export interface ProfileBusiness {
  id: string;
  name: string;
  category: string;
  bio: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  followerCount: number;
  isPro: boolean;
}

export interface BusinessProfileBundle {
  business: ProfileBusiness | null;
  posts: FeedPost[];
  deals: Deal[];
  catalog: CatalogItem[];
  followerCount: number;
  isFollowing: boolean;
  postCount: number;
  mapSaveCount: number;
}

export async function fetchBusinessProfile(
  businessId: string,
  near?: { lat: number; lng: number } | null,
  currentUserId?: string,
): Promise<BusinessProfileBundle | null> {
  if (!supabase) return null;
  const sb = supabase;
  const [bizRes, postsRes, dealsRes, catalogRes, followerRes, followingRes, savesRes] =
    await Promise.all([
      sb.from('businesses').select('*').eq('id', businessId).maybeSingle(),
      sb
        .from('posts')
        .select('*')
        .eq('business_id', businessId)
        .eq('post_type', 'feed')
        .order('created_at', { ascending: false }),
      sb
        .from('deals')
        .select('*')
        .eq('business_id', businessId)
        .order('expires_at', { ascending: true }),
      sb
        .from('catalog_items')
        .select('*')
        .eq('business_id', businessId)
        .order('sort_order', { ascending: true }),
      sb.from('followers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      currentUserId
        ? sb
            .from('followers')
            .select('id')
            .eq('business_id', businessId)
            .eq('follower_id', currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from('saved_places')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId),
    ]);

  const bizRow = (bizRes.data as BusinessRow | null) ?? null;
  if (!bizRow) return null;

  const business: ProfileBusiness = {
    id: bizRow.id,
    name: bizRow.name,
    category: bizRow.category,
    bio: bizRow.bio ?? '',
    address: bizRow.address,
    lat: bizRow.lat,
    lng: bizRow.lng,
    website: bizRow.website,
    instagram: bizRow.instagram,
    phone: bizRow.phone,
    avatarUrl: bizRow.avatar_url,
    coverPhotoUrl: bizRow.cover_photo_url,
    followerCount: bizRow.follower_count,
    isPro: !!bizRow.is_pro,
  };

  const posts: FeedPost[] = ((postsRes.data as PostRow[] | null) ?? []).map((row) => ({
    id: row.id,
    businessId,
    businessName: business.name,
    businessCategory: business.category,
    businessEmoji: emojiForCategory(business.category),
    caption: row.caption,
    likeCount: row.like_count,
    commentCount: 0,
    distanceMiles: distanceMiFrom(near ?? null, { lat: business.lat, lng: business.lng }),
    isLiked: false,
    isPinned: false,
    isPro: business.isPro,
    postCategory: (row.post_category as FeedPost['postCategory']) ?? 'update',
    createdAt: new Date(row.created_at),
    videoUrl: row.video_url ?? undefined,
    thumbnailGradient: gradientFor(business.category),
    lat: business.lat ?? undefined,
    lng: business.lng ?? undefined,
  }));

  const deals: Deal[] = ((dealsRes.data as DealRow[] | null) ?? []).map((row, i) => ({
    id: row.id,
    businessName: business.name,
    category: business.category,
    emoji: emojiForCategory(business.category),
    headline: row.headline,
    description: row.description ?? '',
    originalPrice: row.original_price,
    dealPrice: row.deal_price,
    discountPercent: row.discount_percent,
    expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(Date.now() + 4 * 3600000),
    distanceMiles: distanceMiFrom(near ?? null, { lat: business.lat, lng: business.lng }),
    isFeatured: i === 0,
    stripeProductId: row.id,
    mediaUrl: row.media_url ?? undefined,
    mediaType: (row.media_type as 'image' | 'video' | null) ?? undefined,
    dealCategory: row.deal_category ?? undefined,
    isPro: business.isPro,
    viewCount: row.view_count ?? 0,
    claimCount: row.claim_count ?? 0,
    businessId: business.id,
    lat: business.lat ?? undefined,
    lng: business.lng ?? undefined,
  }));

  const catalog = ((catalogRes.data as CatalogRow[] | null) ?? []).map(mapCatalogRow);

  return {
    business,
    posts,
    deals,
    catalog,
    followerCount: followerRes.count ?? business.followerCount,
    isFollowing: !!followingRes.data,
    postCount: posts.length,
    mapSaveCount: savesRes.count ?? 0,
  };
}

/** Fire-and-forget view tracking — called when a deal card scrolls into view. */
export function trackDealView(dealId: string): void {
  if (!supabase) return;
  void supabase.rpc('increment_deal_views', { deal_id: dealId }).then(
    () => undefined,
    () => undefined,
  );
}

/** Bump the claim counter when a user starts checkout on a deal. */
export function trackDealClaim(dealId: string): void {
  if (!supabase) return;
  void supabase.rpc('increment_deal_claims', { deal_id: dealId }).then(
    () => undefined,
    () => undefined,
  );
}

export interface FollowedBusiness {
  businessId: string;
  name: string;
  category: string;
  avatarUrl: string | null;
  emoji: string;
  isPro: boolean;
}

/** Businesses the given user follows (for the consumer profile). */
export async function fetchFollowing(userId: string): Promise<FollowedBusiness[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('followers')
    .select('business_id, business:businesses(id, name, category, avatar_url, is_pro)')
    .eq('follower_id', userId);
  if (!data) return [];
  return (data as { business_id: string; business: BusinessRow | BusinessRow[] | null }[])
    .map((r) => {
      const biz = relOne(r.business);
      if (!biz) return null;
      return {
        businessId: biz.id,
        name: biz.name,
        category: biz.category,
        avatarUrl: biz.avatar_url,
        emoji: emojiForCategory(biz.category),
        isPro: !!biz.is_pro,
      } satisfies FollowedBusiness;
    })
    .filter(Boolean) as FollowedBusiness[];
}

/** Update a consumer's editable profile fields (name / avatar / bio). */
export async function updateUserProfile(
  userId: string,
  fields: { name?: string; avatarUrl?: string | null; bio?: string | null },
): Promise<void> {
  if (!supabase) return;
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.avatarUrl !== undefined) payload.avatar_url = fields.avatarUrl;
  if (fields.bio !== undefined) payload.bio = fields.bio;
  if (Object.keys(payload).length === 0) return;
  await supabase.from('users').update(payload).eq('id', userId);
}

/** Follow / unfollow a business. Returns the new isFollowing state. */
export async function toggleFollow(
  currentUserId: string,
  businessId: string,
  follow: boolean,
): Promise<void> {
  if (!supabase) return;
  if (follow) {
    await supabase
      .from('followers')
      .upsert({ follower_id: currentUserId, business_id: businessId }, { onConflict: 'follower_id,business_id' });
  } else {
    await supabase
      .from('followers')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('business_id', businessId);
  }
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
  /** 'feed' (video update) or 'deal' (backs a flash deal). Defaults to 'feed'. */
  postType?: 'feed' | 'deal';
  postCategory?: string;
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
      post_type: input.postType ?? 'feed',
      post_category: input.postCategory ?? null,
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
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  dealCategory?: string | null;
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
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
      deal_category: input.dealCategory ?? null,
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

// Catalog photos and deal images share the public 'avatars' bucket.
export async function uploadImage(file: File | Blob): Promise<string | null> {
  return uploadTo('avatars', file, file instanceof File ? file.name : undefined);
}
