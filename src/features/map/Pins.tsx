import { motion } from 'framer-motion';
import type { SavedPlace, ExploreBusiness } from '../../stores/mapStore';
import styles from './Pins.module.css';

interface SavedPinProps {
  place: SavedPlace;
  onClick: () => void;
}

export function SavedPin({ place, onClick }: SavedPinProps) {
  const tone = place.hasDeal
    ? 'deal'
    : place.type === 'social' || place.type === 'home' || place.type === 'work'
      ? 'orange'
      : 'blue';

  return (
    <button type="button" className={styles.pinBtn} onClick={onClick} aria-label={place.name}>
      <motion.div
        className={`${styles.bubble} ${styles[`bubble_${tone}`]} ${place.isPro ? styles.pro : ''}`}
        whileTap={{ scale: 0.96 }}
        animate={tone === 'deal' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={tone === 'deal' ? { duration: 2, repeat: Infinity } : { duration: 0.2 }}
      >
        <span className={styles.bubbleEmoji}>{place.emoji}</span>
        <span className={styles.bubbleName}>{place.name}</span>
        {place.hasDeal && <span className={styles.dealTag}>⚡</span>}
        {place.type === 'social' && place.savedAt && !place.hasDeal && (
          <span className={styles.savedHint}>
            Saved {formatDay(place.savedAt)}
          </span>
        )}
        <span className={`${styles.tail} ${styles[`tail_${tone}`]}`} />
      </motion.div>
      <span className={`${styles.dot} ${styles[`dot_${tone}`]}`} />
    </button>
  );
}

interface ExplorePinProps {
  place: ExploreBusiness;
  onClick: () => void;
}

export function ExplorePin({ place, onClick }: ExplorePinProps) {
  const tone = place.hasDeal
    ? 'green'
    : ['Food', 'Bakery', 'Coffee', 'Wine', 'Japanese', 'Juice Bar'].includes(place.category)
      ? 'orange'
      : 'blue';
  const initial = place.name.charAt(0).toUpperCase();
  return (
    <button type="button" className={styles.exploreBtn} onClick={onClick} aria-label={place.name}>
      <div
        className={`${styles.explore} ${styles[`explore_${tone}`]} ${place.isPro ? styles.explorePro : ''}`}
      >
        <span>{initial}</span>
      </div>
    </button>
  );
}

export function UserLocationDot() {
  return (
    <div className={styles.userDotWrap}>
      <div className={styles.userDot} />
    </div>
  );
}

function formatDay(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}
