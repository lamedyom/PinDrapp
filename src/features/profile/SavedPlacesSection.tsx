import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useMapStore, type SavedPlace } from '../../stores/mapStore';
import { AddLocationSheet, type AddedLocation } from '../places/AddLocationSheet';
import { tapHaptic } from '../../lib/haptics';
import { showToast } from '../../stores/toastStore';
import styles from './SavedPlacesSection.module.css';

export function SavedPlacesSection() {
  const places = useMapStore((s) => s.savedPlaces);
  const userLocation = useMapStore((s) => s.userLocation);
  const addSavedPlace = useMapStore((s) => s.addSavedPlace);
  const removeSavedPlace = useMapStore((s) => s.removeSavedPlace);
  const [open, setOpen] = useState(false);

  const handleAdd = (place: AddedLocation) => {
    const id = `up_${Date.now()}`;
    addSavedPlace({
      id,
      name: place.name,
      emoji: place.emoji,
      type: place.type,
      lat: place.lat,
      lng: place.lng,
    });
    showToast(`${place.name} saved to your map`);
  };

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div>
          <h3 className={styles.title}>My Saved Places</h3>
          <p className={styles.sub}>Tap the map to fly to any of these</p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => {
            tapHaptic();
            setOpen(true);
          }}
        >
          <Plus size={14} /> Add Place
        </button>
      </header>

      <div className={`${styles.row} no-scrollbar`}>
        {places.map((p) => (
          <PlaceTile key={p.id} place={p} onDelete={() => removeSavedPlace(p.id)} />
        ))}
        <button
          type="button"
          className={styles.addCard}
          onClick={() => {
            tapHaptic();
            setOpen(true);
          }}
        >
          <div className={styles.addCardIcon}>
            <Plus size={22} />
          </div>
          <span className={styles.addCardLabel}>Add a place</span>
        </button>
      </div>

      <AddLocationSheet
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleAdd}
        proximity={userLocation}
        title="Add a place to your map"
        saveLabel="Save to my map"
      />
    </section>
  );
}

function PlaceTile({ place, onDelete }: { place: SavedPlace; onDelete: () => void }) {
  const flyToPlace = useMapStore((s) => s.flyToPlace);
  const isPermanent = place.type === 'home' || place.type === 'work';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm(`Remove "${place.name}" from your map?`)) {
      return;
    }
    onDelete();
    showToast(`${place.name} removed`);
  };

  return (
    <button
      type="button"
      className={styles.tile}
      onClick={() => {
        tapHaptic();
        flyToPlace(place.id);
      }}
    >
      <div className={styles.tileTop}>
        <span className={styles.tileEmoji}>{place.emoji}</span>
        {!isPermanent && (
          <button
            type="button"
            className={styles.tileDelete}
            aria-label={`Remove ${place.name}`}
            onClick={handleDelete}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className={styles.tileBody}>
        <div className={styles.tileName}>{place.name}</div>
        <div className={styles.tileType}>
          {place.type === 'home' ? 'Home' : place.type === 'work' ? 'Work' : 'Saved'}
        </div>
      </div>
    </button>
  );
}
