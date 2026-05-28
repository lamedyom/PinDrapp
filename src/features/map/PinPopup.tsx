import { useNavigate } from 'react-router-dom';
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
    const saved = s.savedPlaces.find((p) => p.id === id);
    if (saved) return saved;
    const explore = s.explorePlaces.find((p) => p.id === id);
    if (explore) return explore;
    if (s.searchedLocation?.id === id) return s.searchedLocation;
    return null;
  });
  const close = useMapStore((s) => s.clearPin);
  const setSearchedLocation = useMapStore((s) => s.setSearchedLocation);
  const searchedLocationId = useMapStore((s) => s.searchedLocation?.id ?? null);
  const setDestination = useDirectionsStore((s) => s.setDestination);
  const navigate = useNavigate();

  if (!place) return null;

  const distance =
    'distanceMiles' in place && typeof place.distanceMiles === 'number'
      ? `${place.distanceMiles.toFixed(1)} mi`
      : null;
  const category = 'category' in place ? place.category : undefined;
  const placeName = 'placeName' in place ? place.placeName : undefined;
  const isSearched = searchedLocationId === place.id;

  // Resolve the business this pin maps to. Explore pins use their id as the
  // business id; saved pins carry an explicit businessId (home/work have none).
  const businessId: string | undefined =
    'distanceMiles' in place
      ? place.id // ExploreBusiness — its id is the business id
      : (place as { businessId?: string }).businessId; // SavedPlace (search → undefined)

  const goToProfile = () => {
    tapHaptic();
    if (!businessId) return;
    close();
    if (isSearched) setSearchedLocation(null);
    navigate(`/profile/${businessId}`);
  };

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
    if (isSearched) setSearchedLocation(null);
  };

  const handleClose = () => {
    close();
    if (isSearched) setSearchedLocation(null);
  };

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <span className={styles.emoji}>{place.emoji}</span>
        <div className={styles.copy}>
          <div className={styles.name}>{place.name}</div>
          <div className={styles.meta}>
            {placeName ?? [category, distance].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button type="button" className={styles.close} onClick={handleClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className={styles.actions}>
        {!isSearched && businessId && (
          <Button size="sm" variant="primary" onClick={goToProfile}>
            View Profile
          </Button>
        )}
        <Button
          size="sm"
          variant={isSearched ? 'primary' : 'outline'}
          leftIcon={<Navigation size={12} />}
          onClick={startDirections}
          fullWidth={isSearched}
        >
          Get Directions
        </Button>
      </div>
    </div>
  );
}
