import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useMapStore, type SavedPlace, type ExploreBusiness } from '../../stores/mapStore';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { tapHaptic } from '../../lib/haptics';
import { MapPin as MapPinIcon, Search } from 'lucide-react';
import styles from './MapBottomSheet.module.css';

const COLLAPSED = 110;
const DEFAULT = 240;
const EXPANDED_RATIO = 0.6;

export function MapBottomSheet() {
  const navigate = useNavigate();
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const explorePlaces = useMapStore((s) => s.explorePlaces);
  const flyToPlace = useMapStore((s) => s.flyToPlace);
  const searchQuery = useMapStore((s) => s.searchQuery);

  const filteredSaved = useMemo(() => {
    if (!searchQuery.trim()) return savedPlaces;
    const q = searchQuery.toLowerCase();
    return savedPlaces.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q),
    );
  }, [savedPlaces, searchQuery]);

  const filteredExplore = useMemo(() => {
    if (!searchQuery.trim()) return explorePlaces;
    const q = searchQuery.toLowerCase();
    return explorePlaces.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [explorePlaces, searchQuery]);

  const [screenH, setScreenH] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );

  useEffect(() => {
    const onResize = () => setScreenH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const expanded = Math.max(360, Math.round(screenH * EXPANDED_RATIO));
  const initialY = expanded - DEFAULT;
  const collapsedY = expanded - COLLAPSED;
  const expandedY = 0;
  const y = useMotionValue(initialY);

  const snapTo = (target: number) => {
    animate(y, target, {
      type: 'spring',
      damping: 30,
      stiffness: 320,
      mass: 0.9,
    });
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { velocity: { y: number } },
  ) => {
    void _;
    const current = y.get();
    const velocity = info.velocity.y;
    const candidates = [expandedY, initialY, collapsedY];
    let target: number;
    if (Math.abs(velocity) > 500) {
      if (velocity > 0) {
        target = current < initialY - 10 ? initialY : collapsedY;
      } else {
        target = current > initialY + 10 ? initialY : expandedY;
      }
    } else {
      target = candidates.reduce((prev, p) =>
        Math.abs(p - current) < Math.abs(prev - current) ? p : prev,
      );
    }
    snapTo(target);
  };

  const handleTap = () => {
    const current = y.get();
    // Cycle: closer to expanded → go default; closer to default → go expanded; collapsed → default
    if (current < initialY - 30) snapTo(initialY);
    else if (current > initialY + 30) snapTo(initialY);
    else snapTo(expandedY);
  };

  return (
    <motion.div
      className={styles.sheet}
      style={{ height: expanded, y }}
      drag="y"
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.handleZone} onClick={handleTap}>
        <div className={styles.handle} aria-hidden />
      </div>
      <div className={styles.toggleWrap}>
        <div className={styles.toggle}>
          {(['myPlaces', 'explore'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.toggleOpt} ${activeTab === tab ? styles.toggleActive : ''}`}
              onClick={() => {
                tapHaptic();
                setActiveTab(tab);
              }}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="map-toggle-pill"
                  className={styles.toggleIndicator}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                />
              )}
              <span className={styles.toggleLabel}>
                {tab === 'myPlaces' ? 'My Places' : 'Explore'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {activeTab === 'myPlaces' ? (
          filteredSaved.length === 0 && searchQuery ? (
            <EmptyState icon={<Search size={32} />} message={`No saved places match "${searchQuery}"`} />
          ) : savedPlaces.length === 0 ? (
            <EmptyState
              icon={<MapPinIcon size={32} />}
              message="You haven't saved any places yet. Tap Save to Map on any business to pin it here."
            />
          ) : (
            <MyPlacesContent places={filteredSaved} onTap={flyToPlace} />
          )
        ) : filteredExplore.length === 0 && searchQuery ? (
          <EmptyState icon={<Search size={32} />} message={`No businesses match "${searchQuery}"`} />
        ) : explorePlaces.length === 0 ? (
          <EmptyState
            icon={<MapPinIcon size={32} />}
            message="No businesses in your area yet. Be the first to add yours."
            action={
              <Button variant="primary" onClick={() => navigate('/onboarding')}>
                List My Business
              </Button>
            }
          />
        ) : (
          <ExploreContent places={filteredExplore} onTap={flyToPlace} />
        )}
      </div>
    </motion.div>
  );
}

function MyPlacesContent({
  places,
  onTap,
}: {
  places: SavedPlace[];
  onTap: (id: string) => void;
}) {
  return (
    <>
      <div className={`${styles.scrollRow} no-scrollbar`}>
        {places.map((p) => (
          <SavedPlaceCard key={p.id} place={p} onTap={() => onTap(p.id)} />
        ))}
      </div>
      <div className={styles.legend}>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotOrange}`} /> Discovered from feed
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotBlue}`} /> Manually saved
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.legendDot} ${styles.legendDotGreen}`} /> Deal active
        </div>
      </div>
    </>
  );
}

function ExploreContent({
  places,
  onTap,
}: {
  places: ExploreBusiness[];
  onTap: (id: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <div className={styles.exploreList}>
      {places.map((p) => (
        <ExploreBusinessCard
          key={p.id}
          place={p}
          onTap={() => onTap(p.id)}
          onView={() => navigate(`/profile/${p.id}`)}
        />
      ))}
    </div>
  );
}

function SavedPlaceCard({ place, onTap }: { place: SavedPlace; onTap: () => void }) {
  const gradient =
    place.type === 'home'
      ? 'linear-gradient(135deg,#1a1000,#2a1a00)'
      : place.type === 'work'
        ? 'linear-gradient(135deg,#0d1f3c,#1a0d2e)'
        : place.category === 'shopping'
          ? 'linear-gradient(135deg,#0f1f10,#1a2a1a)'
          : 'linear-gradient(135deg,#1a0d2e,#0d1f3c)';

  const badgeTone =
    place.hasDeal ? 'green' : place.type === 'home' ? 'orange' : 'blue';
  const badgeLabel = place.hasDeal
    ? '⚡ Deal'
    : place.type === 'home'
      ? 'Home'
      : place.type === 'work'
        ? 'Work'
        : 'Saved';

  const meta =
    place.type === 'home' || place.type === 'work'
      ? '—'
      : place.savedAt
        ? `Saved ${new Date(place.savedAt).toLocaleDateString('en-US', { weekday: 'short' })}`
        : '';

  return (
    <button type="button" className={styles.savedCard} onClick={onTap} style={{ background: 'var(--bg-card)' }}>
      <div className={styles.savedCardTop} style={{ background: gradient }}>
        <span>{place.emoji}</span>
        <div className={styles.savedBadge}>
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </div>
      </div>
      <div className={styles.savedCardBody}>
        <div className={styles.savedName}>{place.name}</div>
        <div className={styles.savedMeta}>{meta}</div>
      </div>
    </button>
  );
}

function ExploreBusinessCard({
  place,
  onTap,
  onView,
}: {
  place: ExploreBusiness;
  onTap: () => void;
  onView: () => void;
}) {
  const tone =
    place.hasDeal
      ? 'rgba(0, 217, 126, 0.12)'
      : ['Food', 'Bakery', 'Coffee', 'Wine'].includes(place.category)
        ? 'rgba(255, 92, 26, 0.12)'
        : 'rgba(26, 58, 255, 0.12)';

  return (
    <div className={styles.exploreCard}>
      <button
        type="button"
        className={styles.exploreEmoji}
        style={{ background: tone }}
        onClick={onTap}
        aria-label={`Show ${place.name} on map`}
      >
        {place.emoji}
      </button>
      <button
        type="button"
        className={styles.exploreCopy}
        onClick={onTap}
        style={{ textAlign: 'left' }}
      >
        <div className={styles.exploreName}>{place.name}</div>
        <div className={styles.exploreMeta}>
          {place.category} · {place.distanceMiles.toFixed(1)} mi
        </div>
      </button>
      <div className={styles.exploreActions}>
        {place.hasDeal && <Badge tone="green">⚡ Deal</Badge>}
        <Button size="sm" variant="save" onClick={onView}>
          View
        </Button>
      </div>
    </div>
  );
}
