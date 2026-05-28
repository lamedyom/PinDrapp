import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AtSign,
  ChevronRight,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Pencil,
  Plus,
  Share2,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFeedStore } from '../../stores/feedStore';
import { useDealStore, type Deal } from '../../stores/dealStore';
import { useCatalogStore, type CatalogItem } from '../../stores/catalogStore';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore } from '../../stores/directionsStore';
import { useUserStore } from '../../stores/userStore';
import { useCountdown } from '../../hooks/useCountdown';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchBusinessProfile,
  saveCatalogItem,
  deleteCatalogItem,
  toggleFollow,
  type BusinessProfileBundle,
  type ProfileBusiness,
} from '../../lib/supabaseApi';
import { showToast } from '../../stores/toastStore';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ToggleSwitch } from './ToggleSwitch';
import { CatalogItemForm } from './CatalogItemForm';
import { DealAnalytics } from './DealAnalytics';
import { EditProfileModal } from './EditProfileModal';
import catalogStyles from './CatalogSection.module.css';
import styles from './BusinessProfileScreen.module.css';

type Tab = 'updates' | 'deals' | 'catalog';

const PROFILE_URL = 'https://pindrapp.onrender.com/profile';

export function BusinessProfileScreen() {
  const { businessId = '' } = useParams();
  const navigate = useNavigate();
  const authBusiness = useAuthStore((s) => s.business);
  const profileId = useAuthStore((s) => s.profile?.id);
  const userLoc = useMapStore((s) => s.userLocation);
  const openEdit = useUserStore((s) => s.openEditModal);
  const setDestination = useDirectionsStore((s) => s.setDestination);

  const isOwner = !!authBusiness && authBusiness.id === businessId;

  const [data, setData] = useState<BusinessProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('updates');

  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const near = userLoc ? { lat: userLoc.lat, lng: userLoc.lng } : null;

    const apply = (bundle: BusinessProfileBundle | null) => {
      if (cancelled) return;
      if (!bundle) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setData(bundle);
      setFollowing(bundle.isFollowing);
      setFollowerCount(bundle.followerCount);
      setCatalog(bundle.catalog);
      setLoading(false);
    };

    if (isSupabaseConfigured()) {
      fetchBusinessProfile(businessId, near, profileId)
        .then(apply)
        .catch(() => apply(resolveMock(businessId)));
    } else {
      // Demo mode — resolve from the seeded stores.
      apply(resolveMock(businessId));
    }

    return () => {
      cancelled = true;
    };
  }, [businessId, profileId, userLoc]);

  const business = data?.business ?? null;

  const handleFollow = async () => {
    const next = !following;
    setFollowing(next);
    setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (profileId && isSupabaseConfigured()) {
      try {
        await toggleFollow(profileId, businessId, next);
      } catch {
        // revert on failure
        setFollowing(!next);
        setFollowerCount((c) => Math.max(0, c + (next ? -1 : 1)));
        showToast("Couldn't update follow");
      }
    } else {
      showToast(next ? `Following ${business?.name ?? ''}` : 'Unfollowed');
    }
  };

  const handleShare = async () => {
    const url = `${PROFILE_URL}/${businessId}`;
    const shareData = {
      title: business?.name ?? 'Pindrapp',
      text: `Check out ${business?.name ?? 'this business'} on Pindrapp`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {
      showToast(url);
    }
  };

  const handleDirections = () => {
    if (!business || business.lat == null || business.lng == null) {
      showToast('No location set for this business');
      return;
    }
    setDestination({
      id: business.id,
      name: business.name,
      emoji: '📍',
      lat: business.lat,
      lng: business.lng,
    });
    navigate('/map');
  };

  const saveCatalog = async (draft: CatalogItem) => {
    const item: CatalogItem = { ...draft, id: draft.id || `cat_${Date.now()}` };
    setCatalog((list) => {
      const idx = list.findIndex((i) => i.id === draft.id);
      if (idx >= 0) return list.map((i) => (i.id === draft.id ? item : i));
      return [item, ...list];
    });
    showToast(draft.id ? 'Item updated ✓' : 'Item added ✓');
    setCatalogFormOpen(false);
    setEditingItem(null);
    if (isOwner && isSupabaseConfigured()) {
      try {
        const saved = await saveCatalogItem({
          id: draft.id || undefined,
          businessId,
          name: item.name,
          description: item.description,
          category: item.category,
          photoUrl: item.photoUrl,
          regularPrice: item.regularPrice,
          salePrice: item.salePrice,
          tags: item.tags,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder,
        });
        if (saved) setCatalog((list) => list.map((i) => (i.id === item.id ? saved : i)));
      } catch {
        /* keep optimistic */
      }
    }
  };

  const removeCatalog = (item: CatalogItem) => {
    setCatalog((list) => list.filter((i) => i.id !== item.id));
    showToast('Item removed');
    if (isOwner && isSupabaseConfigured()) void deleteCatalogItem(item.id).catch(() => {});
  };

  if (loading) return <ProfileSkeleton onBack={() => navigate(-1)} />;

  if (notFound || !business) {
    return (
      <div className={styles.screen}>
        <BackBar onBack={() => navigate(-1)} />
        <EmptyState icon={<MapPin size={32} />} message="This business profile couldn't be found." />
      </div>
    );
  }

  const isPro = !!business.isPro;
  const deals = data?.deals ?? [];
  const posts = data?.posts ?? [];
  const now = Date.now();
  const activeDeals = deals.filter((d) => d.expiresAt.getTime() > now);
  const pastDeals = deals.filter((d) => d.expiresAt.getTime() <= now);

  return (
    <div className={styles.screen}>
      {/* HERO */}
      <div
        className={styles.hero}
        style={
          business.coverPhotoUrl
            ? { backgroundImage: `url(${business.coverPhotoUrl})` }
            : undefined
        }
      >
        <BackBar onBack={() => navigate(-1)} floating />
        {!business.coverPhotoUrl && (
          <span className={styles.heroEmoji}>{emojiFor(business.category)}</span>
        )}
        <div className={styles.heroFade} />
      </div>

      <div className={styles.avatarRow}>
        <div className={styles.avatarWrap}>
          {business.avatarUrl ? (
            <img src={business.avatarUrl} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarEmoji}>{emojiFor(business.category)}</span>
          )}
        </div>
      </div>

      <div className={styles.identity}>
        <h1 className={styles.name}>
          {business.name}
          {isPro && <span className={styles.proPill} title="Pindrapp Pro">⭐ PRO</span>}
        </h1>
        <div className={styles.category}>{business.category.toUpperCase()}</div>
        {business.bio && <p className={styles.bio}>{business.bio}</p>}
      </div>

      {/* CONTACT ROWS */}
      <div className={styles.contact}>
        {business.address && (
          <ContactRow icon={<MapPin size={16} />} text={business.address} onClick={handleDirections} />
        )}
        {business.website && (
          <ContactRow
            icon={<Globe size={16} />}
            text={cleanUrl(business.website)}
            onClick={() => openExternal(business.website!)}
          />
        )}
        {business.instagram && (
          <ContactRow
            icon={<AtSign size={16} />}
            text={`@${business.instagram.replace(/^@/, '')}`}
            onClick={() =>
              openExternal(`https://instagram.com/${business.instagram!.replace(/^@/, '')}`)
            }
          />
        )}
        {business.phone && (
          <ContactRow
            icon={<Phone size={16} />}
            text={business.phone}
            onClick={() => openExternal(`tel:${business.phone}`)}
          />
        )}
      </div>

      {/* ACTIONS */}
      <div className={styles.actions}>
        {isOwner ? (
          <>
            <Button size="md" variant="outline" onClick={openEdit}>
              Edit Profile
            </Button>
            <Button size="md" variant="save" onClick={() => setTab('catalog')}>
              Add to Catalog
            </Button>
            <Button size="md" variant="deal" onClick={() => navigate('/post')}>
              Create Deal
            </Button>
          </>
        ) : (
          <>
            <Button
              size="md"
              variant={following ? 'outline' : 'primary'}
              onClick={handleFollow}
            >
              {following ? 'Following ✓' : 'Follow'}
            </Button>
            <Button size="md" variant="ghost" leftIcon={<Share2 size={14} />} onClick={handleShare}>
              Share
            </Button>
            <Button
              size="md"
              variant="save"
              leftIcon={<Navigation size={14} />}
              onClick={handleDirections}
            >
              Directions
            </Button>
          </>
        )}
      </div>

      {/* STATS */}
      <div className={styles.stats}>
        <Stat label="Followers" value={followerCount} />
        <Stat label="Posts" value={data?.postCount ?? posts.length} />
        <Stat label="Map Saves" value={data?.mapSaveCount ?? 0} />
        <Stat label="Deal Claims" value={0} />
      </div>

      <div className={styles.mapCallout}>
        <div className={styles.mapCalloutIcon}>
          <MapPin size={20} />
        </div>
        <div>
          <div className={styles.mapCalloutTitle}>
            Saved to {data?.mapSaveCount ?? 0} people's maps
          </div>
          <div className={styles.mapCalloutSub}>People who discovered you through Pindrapp</div>
        </div>
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        {(['updates', 'deals', 'catalog'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'updates' ? 'Updates' : t === 'deals' ? 'Deals' : 'Catalog'}
          </button>
        ))}
      </div>

      <div className={styles.tabBody}>
        {tab === 'updates' &&
          (posts.length === 0 ? (
            <div className={styles.emptyNote}>No updates yet</div>
          ) : (
            <div className={styles.grid}>
              {posts.map((p) => (
                <div
                  key={p.id}
                  className={styles.cell}
                  style={{ background: p.thumbnailGradient }}
                >
                  {p.videoUrl ? (
                    <video className={styles.cellVideo} src={p.videoUrl} muted playsInline />
                  ) : (
                    <span className={styles.cellEmoji}>{p.businessEmoji}</span>
                  )}
                </div>
              ))}
            </div>
          ))}

        {tab === 'deals' && (
          <div className={styles.dealsList}>
            {isOwner && isPro && deals.length > 0 && <DealAnalytics deals={deals} />}
            {activeDeals.length === 0 && pastDeals.length === 0 && (
              <div className={styles.emptyNote}>No deals posted yet</div>
            )}
            {activeDeals.map((d) => (
              <DealRow key={d.id} deal={d} />
            ))}
            {pastDeals.length > 0 && (
              <>
                <div className={styles.groupLabel}>Past deals</div>
                {pastDeals.map((d) => (
                  <DealRow key={d.id} deal={d} ended />
                ))}
              </>
            )}
            {isOwner && (
              <Button variant="deal" fullWidth onClick={() => navigate('/post')}>
                Create a Deal
              </Button>
            )}
          </div>
        )}

        {tab === 'catalog' && (
          <CatalogTab
            items={catalog}
            isOwner={isOwner}
            onAdd={() => {
              setEditingItem(null);
              setCatalogFormOpen(true);
            }}
            onEdit={(item) => {
              setEditingItem(item);
              setCatalogFormOpen(true);
            }}
            onDelete={removeCatalog}
            onToggle={(item) =>
              setCatalog((list) =>
                list.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)),
              )
            }
          />
        )}
      </div>

      <CatalogItemForm
        open={catalogFormOpen}
        item={editingItem}
        onClose={() => {
          setCatalogFormOpen(false);
          setEditingItem(null);
        }}
        onSave={saveCatalog}
      />
      {isOwner && <EditProfileModal />}
    </div>
  );
}

// ── Catalog tab (per-business, presentational) ─────────────────────────────
function CatalogTab({
  items,
  isOwner,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: {
  items: CatalogItem[];
  isOwner: boolean;
  onAdd: () => void;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
  onToggle: (item: CatalogItem) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <section className={catalogStyles.section}>
      {isOwner && (
        <header className={catalogStyles.head}>
          <h3 className={catalogStyles.title}>Catalog</h3>
          <button type="button" className={catalogStyles.addBtn} onClick={onAdd}>
            <Plus size={12} /> Add Item
          </button>
        </header>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed size={32} />} message="No catalog items yet." />
      ) : (
        grouped.map(([category, list]) => (
          <div key={category} className={catalogStyles.group}>
            <div className={catalogStyles.catLabel}>{category}</div>
            <div className={catalogStyles.list}>
              {list.map((item) => (
                <div
                  key={item.id}
                  className={`${catalogStyles.row} ${!item.isAvailable ? catalogStyles.unavailable : ''}`}
                >
                  <div className={catalogStyles.thumb}>
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className={catalogStyles.thumbImg} />
                    ) : (
                      <span className={catalogStyles.thumbPlaceholder}>🍽️</span>
                    )}
                  </div>
                  <div className={catalogStyles.info}>
                    <div className={catalogStyles.nameRow}>
                      <span className={catalogStyles.name}>{item.name}</span>
                      {!item.isAvailable && (
                        <span className={catalogStyles.soldOut}>Unavailable</span>
                      )}
                    </div>
                    {item.description && <p className={catalogStyles.desc}>{item.description}</p>}
                    {item.tags.length > 0 && (
                      <div className={catalogStyles.tagRow}>
                        {item.tags.map((t) => (
                          <span key={t} className={catalogStyles.tag}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={catalogStyles.priceCol}>
                    {item.salePrice != null && item.regularPrice != null ? (
                      <>
                        <span className={catalogStyles.salePrice}>${item.salePrice}</span>
                        <span className={catalogStyles.regStrike}>${item.regularPrice}</span>
                      </>
                    ) : item.regularPrice != null ? (
                      <span className={catalogStyles.salePrice}>${item.regularPrice}</span>
                    ) : null}
                    {isOwner && (
                      <div className={catalogStyles.ownerActions}>
                        <ToggleSwitch
                          on={item.isAvailable}
                          onChange={() => onToggle(item)}
                          ariaLabel="Toggle availability"
                        />
                        <button
                          type="button"
                          className={catalogStyles.iconBtn}
                          aria-label="Edit item"
                          onClick={() => onEdit(item)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={catalogStyles.iconBtn}
                          aria-label="Delete item"
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function DealRow({ deal, ended }: { deal: Deal; ended?: boolean }) {
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
          ? `Ended ${deal.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`}
      </span>
    </div>
  );
}

function ContactRow({
  icon,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.contactRow} onClick={onClick}>
      <span className={styles.contactIcon}>{icon}</span>
      <span className={styles.contactText}>{text}</span>
      <ChevronRight size={16} className={styles.contactChevron} />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{safe.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function BackBar({ onBack, floating }: { onBack: () => void; floating?: boolean }) {
  return (
    <button
      type="button"
      className={`${styles.backBtn} ${floating ? styles.backBtnFloating : ''}`}
      onClick={onBack}
      aria-label="Back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}

function ProfileSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <BackBar onBack={onBack} floating />
      </div>
      <div className={styles.avatarRow}>
        <Skeleton width={72} height={72} radius={18} />
      </div>
      <div className={styles.identity}>
        <Skeleton width={180} height={20} radius={8} />
        <div style={{ height: 8 }} />
        <Skeleton width={100} height={12} radius={6} />
      </div>
      <div className={styles.contact}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={44} radius={12} />
        ))}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function openExternal(url: string) {
  const href = /^(https?:|tel:|mailto:)/.test(url) ? url : `https://${url}`;
  window.open(href, '_blank', 'noopener,noreferrer');
}

function emojiFor(category: string): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('pizza') || c.includes('italian')) return '🍕';
  if (c.includes('steak') || c.includes('food') || c.includes('restaurant')) return '🍽️';
  if (c.includes('coffee')) return '☕';
  if (c.includes('bakery')) return '🥐';
  if (c.includes('vegan') || c.includes('green') || c.includes('juice')) return '🥗';
  if (c.includes('fashion') || c.includes('boutique')) return '👗';
  if (c.includes('jewelry')) return '💎';
  if (c.includes('wine')) return '🍷';
  if (c.includes('book')) return '📚';
  if (c.includes('tech') || c.includes('electronics')) return '📱';
  return '🏪';
}

// Resolve a business profile from the seeded stores (offline demo mode).
function resolveMock(businessId: string): BusinessProfileBundle | null {
  const posts = useFeedStore.getState().posts.filter((p) => p.businessId === businessId);
  const explore = useMapStore.getState().explorePlaces.find((e) => e.id === businessId);
  const saved = useMapStore.getState().savedPlaces.find((s) => s.businessId === businessId);

  const name = posts[0]?.businessName ?? explore?.name ?? saved?.name;
  if (!name) return null;
  const category = posts[0]?.businessCategory ?? explore?.category ?? saved?.category ?? 'Business';
  const lat = posts[0]?.lat ?? explore?.lat ?? saved?.lat ?? null;
  const lng = posts[0]?.lng ?? explore?.lng ?? saved?.lng ?? null;

  const isPro =
    posts[0]?.isPro ??
    explore?.isPro ??
    saved?.isPro ??
    useDealStore.getState().deals.some((d) => d.businessName === name && d.isPro) ??
    false;

  const business: ProfileBusiness = {
    id: businessId,
    name,
    category,
    bio: 'A local favorite on Pindrapp.',
    address: 'Downtown Hollywood, FL',
    lat,
    lng,
    website: 'pindrapp.onrender.com',
    instagram: name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    phone: '+1 (954) 555-0142',
    avatarUrl: null,
    coverPhotoUrl: null,
    followerCount: isPro ? 612 : 128,
    isPro,
  };

  const deals = useDealStore.getState().deals.filter((d) => d.businessName === name);
  const catalog = useCatalogStore.getState().items;

  return {
    business,
    posts,
    deals,
    catalog,
    followerCount: business.followerCount,
    isFollowing: false,
    postCount: posts.length,
    mapSaveCount: 37,
  };
}
