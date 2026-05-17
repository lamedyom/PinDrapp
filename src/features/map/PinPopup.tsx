import { Navigation } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore } from '../../stores/directionsStore';
import { tapHaptic } from '../../lib/haptics';
import styles from './PinPopup.module.css';

interface PinPopupProps {
  id: string;
}

export function PinPopup({ id }: PinPopupProps) {
  const place = useMapStore((s) => {
    return [...s.savedPlaces, ...s.explorePlaces].find((p) => p.id === id) ?? null;
  });
  const close = useMapStore((s) => s.clearPin);
  const setDestination = useDirectionsStore((s) => s.setDestination);

  if (!place) return null;

  const distance =
    'distanceMiles' in place && typeof place.distanceMiles === 'number'
      ? `${place.distanceMiles.toFixed(1)} mi`
      : null;
  const category = 'category' in place ? place.category : undefined;

  const startDirections = () => {
    tapHaptic();
    setDestination({
      id: place.id,
      name: place.name,
      emoji: place.emoji,
      lat: place.lat,
      lng: place.lng,
    });
    close();
  };

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <span className={styles.emoji}>{place.emoji}</span>
        <div className={styles.copy}>
          <div className={styles.name}>{place.name}</div>
          <div className={styles.meta}>
            {[category, distance].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button type="button" className={styles.close} onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="primary">
          View Profile
        </Button>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Navigation size={12} />}
          onClick={startDirections}
        >
          Get Directions
        </Button>
      </div>
    </div>
  );
}
