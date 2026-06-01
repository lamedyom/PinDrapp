import { useMemo, useState } from 'react';
import { Camera, LogOut, MapPin, Share2 } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useFeedStore } from '../../stores/feedStore';
import { useDealStore } from '../../stores/dealStore';
import { useAuthStore } from '../../stores/authStore';
import { useCountdown } from '../../hooks/useCountdown';
import { Button } from '../../components/ui/Button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { CatalogSection } from './CatalogSection';
import { EditProfileModal } from './EditProfileModal';
import { SavedPlacesSection } from './SavedPlacesSection';
import { ConsumerProfileScreen } from './ConsumerProfileScreen';
import { GuestProfileScreen } from './GuestProfileScreen';
import type { Deal } from '../../stores/dealStore';
import styles from './ProfileScreen.module.css';

/**
 * Profile entry point. Renders the right experience for who's viewing:
 *  - guest (signed out)            → sign-up prompt
 *  - consumer (user_type=consumer) → saved places / following / deal history
 *  - business (or demo mode)       → the business owner dashboard below
 */
export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const business = useAuthStore((s) => s.business);

  // Guest (signed out, or Supabase not configured) → sign-up prompt.
  if (!profile) return <GuestProfileScreen />;
  if (profile.userType === 'consumer') return <ConsumerProfileScreen />;
  if (profile.userType === 'business') return <BusinessOwnerProfile />;
  // Fallback while userType is null — never show business mock data to a
  // user whose role we don't yet know.
  return business ? <BusinessOwnerProfile /> : <GuestProfileScreen />;
}

type ProfileTab = 'feed' | 'deals' | 'catalog';

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'deals', label: 'Deals' },
  { id: 'catalog', label: 'Catalog' },
];

// Defensive defaults — guarantees every field the render reads is defined,
// even if the store hasn't hydrated or a Supabase field came back null.
const EMPTY_PROFILE = {
  id: 'profile',
  name: 'Your Business',
  category: 'Business',
  coverEmoji: '🏪',
  bio: '',
  imageUrl: null as string | null,
  website: '',
  instagram: '',
  phone: '',
  address: '',
  followerCount: 0,
  postCount: 0,
  mapSaveCount: 0,
  dealClaimCount: 0,
  menuItems: [],
  dealTemplates: [],
};

function BusinessOwnerProfile() {
  const profile = useUserStore((s) => s.profile);
  const openEdit = useUserStore((s) => s.openEditModal);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const authBusiness = useAuthStore((s) => s.business);
  const posts = useFeedStore((s) => s.posts);
  const deals = useDealStore((s) => s.deals);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('feed');

  // This screen always shows the signed-in user's own business profile, so the
  // owner controls (edit catalog, toggle availability) are always enabled. In
  // mock/demo mode (Supabase off) we also treat the viewer as the owner.
  const isOwner = !isSupabaseConfigured() || !!authBusiness;

  // When a Supabase-backed business exists, overlay its data on top of the
  // mock profile so the screen reflects the signed-in business. Every field
  // falls back to the mock profile, and the whole thing is defensively
  // defaulted so a missing field can never crash the render.
  const effective = useMemo(() => {
    const base = profile ?? EMPTY_PROFILE;
    if (!authBusiness) return { ...EMPTY_PROFILE, ...base };
    return {
      ...EMPTY_PROFILE,
      ...base,
      name: authBusiness.name || base.name,
      category: authBusiness.category || base.category,
      bio: authBusiness.bio || base.bio,
      address: authBusiness.address ?? base.address,
      website: authBusiness.website ?? base.website,
      instagram: authBusiness.instagram ?? base.instagram,
      phone: authBusiness.phone ?? base.phone,
      imageUrl: authBusiness.avatarUrl ?? base.imageUrl,
      followerCount: authBusiness.followerCount || base.followerCount,
    };
  }, [authBusiness, profile]);

  const myPosts = useMemo(() => (Array.isArray(posts) ? posts.slice(0, 12) : []), [posts]);

  // Deals belonging to this business. When signed in, match by business name;
  // in the demo we show all seeded deals so the tab is populated.
  const myDeals = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const mine = authBusiness
      ? list.filter((d) => d.businessName === authBusiness.name)
      : list;
    const now = Date.now();
    const active = mine.filter((d) => d.expiresAt.getTime() > now);
    const past = mine.filter((d) => d.expiresAt.getTime() <= now);
    return { active, past };
  }, [deals, authBusiness]);

  const handleAvatarPick = async () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      updateProfile({ imageUrl: url });
    };
    input.click();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <div className={styles.heroEmoji}>{effective.coverEmoji}</div>
        <div className={styles.heroFade} />
      </div>

      <div className={styles.avatarRow}>
        <div className={styles.avatarWrap}>
          {effective.imageUrl ? (
            <img src={effective.imageUrl} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarEmoji}>{effective.coverEmoji}</span>
          )}
          <button
            type="button"
            className={styles.avatarCamera}
            aria-label="Change profile photo"
            onClick={handleAvatarPick}
          >
            <Camera size={14} />
          </button>
        </div>
      </div>

      <div className={styles.identity}>
        <h1 className={styles.name}>
          {effective.name || 'Your Business'}
          {authBusiness?.isPro && <span className={styles.proPill}>⭐ PRO</span>}
        </h1>
        <div className={styles.category}>{(effective.category || 'Business').toUpperCase()}</div>
        <div className={styles.locationRow}>
          <MapPin size={12} /> {effective.address || 'No address set'}
        </div>
        <p className={styles.bio}>{effective.bio}</p>
        <div className={styles.actions}>
          <Button size="md" variant="outline" onClick={openEdit}>
            Edit Profile
          </Button>
          <Button size="md" variant="ghost" leftIcon={<Share2 size={14} />}>
            Share Profile
          </Button>
          {isSupabaseConfigured() && (
            <Button
              size="md"
              variant="ghost"
              leftIcon={<LogOut size={14} />}
              onClick={() => useAuthStore.getState().signOut()}
            >
              Sign Out
            </Button>
          )}
        </div>
      </div>

      <div className={styles.stats}>
        <Stat label="Followers" value={effective.followerCount} />
        <Stat label="Posts" value={effective.postCount} />
        <Stat label="Map Saves" value={effective.mapSaveCount} />
        <Stat label="Deal Claims" value={effective.dealClaimCount} />
      </div>

      <div className={styles.mapCallout}>
        <div className={styles.mapCalloutIcon}>
          <MapPin size={20} />
        </div>
        <div>
          <div className={styles.mapCalloutTitle}>
            Saved to {effective.mapSaveCount} people's maps
          </div>
          <div className={styles.mapCalloutSub}>
            People who saw your content and pinned your business
          </div>
        </div>
      </div>

      <SavedPlacesSection />

      <div className={styles.profileTabs}>
        {PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.profileTab} ${tab === t.id ? styles.profileTabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'feed' &&
          (myPosts.length === 0 ? (
            <div className={styles.emptyGridNote}>No video updates yet.</div>
          ) : (
            <div className={styles.postsGrid}>
              {myPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className={styles.postCell}
                  style={{ background: post.thumbnailGradient }}
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <span className={styles.postEmoji}>{post.businessEmoji}</span>
                  {post.isLive && <span className={styles.postDot} />}
                </button>
              ))}
            </div>
          ))}

        {tab === 'deals' && (
          <div className={styles.dealsList}>
            {myDeals.active.length === 0 && myDeals.past.length === 0 && (
              <div className={styles.emptyGridNote}>No deals yet.</div>
            )}
            {myDeals.active.map((d) => (
              <ProfileDealRow key={d.id} deal={d} />
            ))}
            {myDeals.past.length > 0 && (
              <>
                <div className={styles.dealGroupLabel}>Past deals</div>
                {myDeals.past.map((d) => (
                  <ProfileDealRow key={d.id} deal={d} ended />
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'catalog' && <CatalogSection isOwner={isOwner} />}
      </div>

      <EditProfileModal />

      {selectedPostId && (
        <div
          className={styles.postLightbox}
          onClick={() => setSelectedPostId(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedPostId(null);
          }}
          aria-label="Close post"
        >
          <div className={styles.postLightboxInner}>
            {posts.find((p) => p.id === selectedPostId)?.caption}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDealRow({ deal, ended }: { deal: Deal; ended?: boolean }) {
  const c = useCountdown(deal.expiresAt);
  const priceLabel =
    deal.discountPercent != null
      ? `${deal.discountPercent}% off`
      : deal.dealPrice != null && deal.originalPrice != null
        ? `$${deal.dealPrice} (was $${deal.originalPrice})`
        : deal.dealPrice != null
          ? `$${deal.dealPrice}`
          : 'Special';
  return (
    <div className={`${styles.dealRow} ${ended ? styles.dealEnded : ''}`}>
      <span className={styles.dealEmoji}>{deal.emoji}</span>
      <div className={styles.dealInfo}>
        <div className={styles.dealHeadline}>{deal.headline}</div>
        <div className={styles.dealMeta}>{priceLabel}</div>
      </div>
      <span className={`${styles.dealBadge} ${ended ? styles.dealBadgeEnded : ''}`}>
        {ended || c.isExpired
          ? 'Ended'
          : `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`}
      </span>
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function Stat({ label, value }: { label: string; value: number }) {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{safe.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
