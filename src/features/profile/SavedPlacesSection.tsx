import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  const updateSavedPlace = useMapStore((s) => s.updateSavedPlace);

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingPlace = editingId ? places.find((p) => p.id === editingId) ?? null : null;

  const handleAdd = (place: AddedLocation) => {
    const id = `up_${Date.now()}`;
    addSavedPlace({
      id,
      name: place.name,
      emoji: place.emoji,
      type: place.type,
      placeName: place.placeName,
      lat: place.lat,
      lng: place.lng,
    });
    showToast(`${place.name} saved to your map`);
  };

  const handleUpdate = (next: AddedLocation) => {
    if (!editingId) return;
    updateSavedPlace(editingId, {
      name: next.name,
      emoji: next.emoji,
      type: next.type,
      placeName: next.placeName,
      lat: next.lat,
      lng: next.lng,
    });
    showToast(`${next.name} updated`);
  };

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div>
          <h3 className={styles.title}>My Saved Places</h3>
          <p className={styles.sub}>Tap a tile to fly the map · ✎ to edit</p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => {
            tapHaptic();
            setAddOpen(true);
          }}
        >
          <Plus size={14} /> Add Place
        </button>
      </header>

      <div className={`${styles.row} no-scrollbar`}>
        {places.map((p) => (
          <PlaceTile
            key={p.id}
            place={p}
            onEdit={() => setEditingId(p.id)}
            onDelete={() => removeSavedPlace(p.id)}
          />
        ))}
        <button
          type="button"
          className={styles.addCard}
          onClick={() => {
            tapHaptic();
            setAddOpen(true);
          }}
        >
          <div className={styles.addCardIcon}>
            <Plus size={22} />
          </div>
          <span className={styles.addCardLabel}>Add a place</span>
        </button>
      </div>

      <AddLocationSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
        proximity={userLocation}
        title="Add a place to your map"
        saveLabel="Save to my map"
      />

      <AddLocationSheet
        open={!!editingPlace}
        onClose={() => setEditingId(null)}
        onSave={handleUpdate}
        proximity={userLocation}
        title={editingPlace ? `Edit ${labelForType(editingPlace.type)}` : 'Edit place'}
        saveLabel="Save changes"
        editing={
          editingPlace
            ? {
                name: editingPlace.name,
                emoji: editingPlace.emoji,
                type: editingPlace.type === 'social' ? 'saved' : editingPlace.type,
                lat: editingPlace.lat,
                lng: editingPlace.lng,
                placeName: editingPlace.placeName,
              }
            : undefined
        }
      />
    </section>
  );
}

function labelForType(t: SavedPlace['type']): string {
  if (t === 'home') return 'Home';
  if (t === 'work') return 'Work';
  return 'place';
}

function PlaceTile({
  place,
  onEdit,
  onDelete,
}: {
  place: SavedPlace;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const flyToPlace = useMapStore((s) => s.flyToPlace);
  const isPermanent = place.type === 'home' || place.type === 'work';

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    tapHaptic();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm(`Remove "${place.name}" from your map?`)) {
      return;
    }
    onDelete();
    showToast(`${place.name} removed`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.tile}
      onClick={() => {
        tapHaptic();
        flyToPlace(place.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tapHaptic();
          flyToPlace(place.id);
        }
      }}
    >
      <div className={styles.tileTop}>
        <span className={styles.tileEmoji}>{place.emoji}</span>
        <div className={styles.tileActions}>
          <button
            type="button"
            className={styles.tileEditBtn}
            aria-label={`Edit ${place.name}`}
            onClick={handleEdit}
          >
            <Pencil size={11} />
          </button>
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
      </div>
      <div className={styles.tileBody}>
        <div className={styles.tileName}>{place.name}</div>
        <div className={styles.tileType}>
          {place.placeName ?? (isPermanent ? 'Tap ✎ to add address' : 'Saved')}
        </div>
      </div>
    </div>
  );
}
