import { useEffect, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { useMapStore, type SavedPlace, type ExploreBusiness } from '../../stores/mapStore';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { tapHaptic } from '../../lib/haptics';
import styles from './MapBottomSheet.module.css';

const COLLAPSED = 110;
const DEFAULT = 240;
const EXPANDED_RATIO = 0.6;

export function MapBottomSheet() {
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const explorePlaces = useMapStore((s) => s.explorePlaces);
  const flyToPlace = useMapStore((s) => s.flyToPlace);

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
      target = velocity > 0 ? collapsedY : expandedY;
    } else {
      target = candidates.reduce((prev, p) =>
        Math.abs(p - current) < Math.abs(prev - current) ? p : prev,
      );
    }
    y.set(target);
  };

  return (
    <motion.div
      className={styles.sheet}
      style={{ height: expanded, y }}
      drag="y"
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.handle} aria-hidden />
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
          <MyPlacesContent places={savedPlaces} onTap={flyToPlace} />
        ) : (
          <ExploreContent places={explorePlaces} onTap={flyToPlace} />
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
  return (
    <div className={styles.exploreList}>
      {places.map((p) => (
        <ExploreBusinessCard key={p.id} place={p} onTap={() => onTap(p.id)} />
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
}: {
  place: ExploreBusiness;
  onTap: () => void;
}) {
  const tone =
    place.hasDeal
      ? 'rgba(0, 217, 126, 0.12)'
      : ['Food', 'Bakery', 'Coffee', 'Wine'].includes(place.category)
        ? 'rgba(255, 92, 26, 0.12)'
        : 'rgba(26, 58, 255, 0.12)';

  return (
    <div className={styles.exploreCard}>
      <div className={styles.exploreEmoji} style={{ background: tone }}>
        {place.emoji}
      </div>
      <div className={styles.exploreCopy}>
        <div className={styles.exploreName}>{place.name}</div>
        <div className={styles.exploreMeta}>
          {place.category} · {place.distanceMiles.toFixed(1)} mi
        </div>
      </div>
      <div className={styles.exploreActions}>
        {place.hasDeal && <Badge tone="green">⚡ Deal</Badge>}
        <Button size="sm" variant="save" onClick={onTap}>
          View
        </Button>
      </div>
    </div>
  );
}
