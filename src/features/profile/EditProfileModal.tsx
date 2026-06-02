import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, MapPin } from 'lucide-react';
import { useUserStore, type BusinessProfile } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../stores/toastStore';
import { uploadAvatar } from '../../lib/supabaseApi';
import { supabase } from '../../lib/supabase';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import styles from './EditProfileModal.module.css';

const CATEGORIES = [
  'Food',
  'Shopping',
  'Beauty',
  'Services',
  'Entertainment',
  'Bakery',
  'Coffee',
  'Other',
];

const EMOJIS = [
  '🥩', '🥗', '🍕', '🥐', '☕', '👗', '💎', '🥤', '📚', '📱',
  '🍣', '🍷', '🎉', '🏋️', '💈', '🌸', '🔑', '🎵', '🏪', '🍦',
];

export function EditProfileModal() {
  const open = useUserStore((s) => s.isEditModalOpen);
  const close = useUserStore((s) => s.closeEditModal);
  const profile = useUserStore((s) => s.profile);
  const update = useUserStore((s) => s.updateProfile);

  const [form, setForm] = useState<BusinessProfile | null>(profile ?? null);

  const authBusiness = useAuthStore((s) => s.business);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const userLoc = useMapStore((s) => s.userLocation);

  // Address geocoding. We keep coords in their own state because the legacy
  // BusinessProfile form shape has no lat/lng fields — coords come from the
  // signed-in business OR from a freshly selected geocoder suggestion, and
  // are written to the `businesses` table on save.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressFocused, setAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  // Block the suggestions effect from firing immediately after the user picks
  // one — without it the picked address would re-query and re-open the menu.
  const skipNextSuggestRef = useRef(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setForm(profile ?? null);
      setCoords(
        authBusiness?.lat != null && authBusiness?.lng != null
          ? { lat: authBusiness.lat, lng: authBusiness.lng }
          : null,
      );
      setSuggestions([]);
      setAddressFocused(false);
    }
  }, [open, profile, authBusiness]);

  // Debounced address autocomplete via Mapbox geocoding.
  useEffect(() => {
    if (!addressFocused) return;
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false;
      return;
    }
    const q = form?.address?.trim() ?? '';
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      geocodeAbortRef.current?.abort();
      const ctrl = new AbortController();
      geocodeAbortRef.current = ctrl;
      geocodePlaces(q, userLoc ?? undefined, ctrl.signal)
        .then(setSuggestions)
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setSuggestions([]);
        });
    }, 240);
    return () => window.clearTimeout(handle);
  }, [form?.address, addressFocused, userLoc]);

  const pickAddress = (s: GeocodingResult) => {
    skipNextSuggestRef.current = true;
    setForm((c) => (c ? { ...c, address: s.placeName } : c));
    setCoords({ lat: s.lat, lng: s.lng });
    setSuggestions([]);
    setAddressFocused(false);
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: async (files) => {
      const f = files[0];
      if (!f) return;
      // Show the local preview immediately.
      const localUrl = URL.createObjectURL(f);
      setForm((c) => (c ? { ...c, imageUrl: localUrl } : c));
      // If we're authed, upload to Supabase storage and swap to the public URL.
      if (authBusiness) {
        try {
          const remote = await uploadAvatar(f);
          if (remote) setForm((c) => (c ? { ...c, imageUrl: remote } : c));
        } catch (e) {
          showToast(`Image upload failed${e instanceof Error ? ` — ${e.message}` : ''}`);
        }
      }
    },
  });

  const save = async () => {
    if (!form) return;
    // Always update the local store for instant UI.
    update(form);

    // Persist to Supabase when this is a real signed-in business.
    if (authBusiness && supabase) {
      try {
        const { error } = await supabase
          .from('businesses')
          .update({
            name: form.name,
            bio: form.bio,
            category: form.category,
            website: form.website,
            instagram: form.instagram,
            phone: form.phone,
            address: form.address,
            avatar_url: form.imageUrl,
            // Coords from the geocoder selection — written alongside the
            // address text so the business pin lands at the right location.
            ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          })
          .eq('id', authBusiness.id);
        if (error) throw error;
        await refreshProfile();
        showToast('Profile saved ✓');
      } catch (e) {
        showToast(`Couldn't save profile${e instanceof Error ? ` — ${e.message}` : ''}`);
        return; // keep the modal open so the user can retry
      }
    } else {
      showToast('Profile updated ✓');
    }
    close();
  };

  // No profile to edit yet — render an empty sheet rather than crashing on
  // form.* field reads.
  if (!form) return <Modal open={open} onClose={close} label="Edit profile" />;

  return (
    <Modal open={open} onClose={close} label="Edit profile">
      <div className={styles.host}>
        <header className={styles.head}>
          <h3>Edit Profile</h3>
          <button type="button" className={styles.doneBtn} onClick={() => void save()}>
            Done
          </button>
        </header>

        <div className={styles.scroll}>
          <Field label="Business name">
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Category">
            <select
              className={styles.input}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bio">
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              maxLength={200}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <span className={styles.counter}>{form.bio.length}/200</span>
          </Field>

          <Field label="Profile image">
            <div {...getRootProps({ className: styles.imageDrop })}>
              <input {...getInputProps()} />
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className={styles.imagePreview} loading="lazy" />
              ) : (
                <div className={styles.imagePlaceholder}>
                  <Camera size={26} />
                  <span>Tap or drop an image</span>
                </div>
              )}
            </div>
          </Field>

          <Field label="Cover emoji">
            <div className={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`${styles.emojiBtn} ${form.coverEmoji === e ? styles.emojiBtnActive : ''}`}
                  onClick={() => setForm({ ...form, coverEmoji: e })}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Website">
            <input
              className={styles.input}
              placeholder="yoursite.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Instagram">
            <input
              className={styles.input}
              placeholder="@handle"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={styles.input}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <div className={styles.addressWrap}>
              <input
                className={styles.input}
                value={form.address}
                placeholder="Start typing to search…"
                autoComplete="off"
                onFocus={() => setAddressFocused(true)}
                onBlur={() => {
                  // Delay so a click on a suggestion fires before blur hides
                  // the dropdown.
                  window.setTimeout(() => setAddressFocused(false), 150);
                }}
                onChange={(e) => {
                  // Manual edits invalidate the previously-selected coords —
                  // we don't want to keep stale lat/lng for a different place.
                  setForm({ ...form, address: e.target.value });
                  setCoords(null);
                }}
              />
              {addressFocused && suggestions.length > 0 && (
                <ul className={styles.suggestList} role="listbox">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={styles.suggestItem}
                        // onMouseDown fires before blur, so the pick lands
                        // before the dropdown closes.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickAddress(s);
                        }}
                      >
                        <MapPin size={13} className={styles.suggestIcon} />
                        <span className={styles.suggestText}>
                          <span className={styles.suggestName}>{s.name}</span>
                          <span className={styles.suggestPlace}>{s.placeName}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {coords && (
                <div className={styles.coordsHint}>
                  📍 Saved coordinates · {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </div>
              )}
            </div>
          </Field>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={close}>
            Cancel
          </button>
          <Button fullWidth variant="primary" size="lg" onClick={() => void save()}>
            Save Changes
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
