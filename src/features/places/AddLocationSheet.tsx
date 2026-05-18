import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Home, MapPin, Search, X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import { tapHaptic } from '../../lib/haptics';
import styles from './AddLocationSheet.module.css';

export type AddLocationKind = 'home' | 'work' | 'saved';

export interface AddedLocation {
  name: string;
  emoji: string;
  type: AddLocationKind;
  lat: number;
  lng: number;
  placeName?: string;
}

interface AddLocationSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (place: AddedLocation) => void;
  /** Used for proximity in the geocoder. */
  proximity?: { lat: number; lng: number } | null;
  /** Title shown at the top of the sheet. */
  title?: string;
  /** Button label for the final save action. */
  saveLabel?: string;
  /** Hide the type/emoji form (use when picking a one-shot location, like for a post). */
  pickOnly?: boolean;
}

const TYPES: { id: AddLocationKind; label: string; emoji: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Home', emoji: '🏠', Icon: Home },
  { id: 'work', label: 'Work', emoji: '💼', Icon: Briefcase },
  { id: 'saved', label: 'Saved', emoji: '⭐', Icon: MapPin },
];

const EMOJI_PALETTE = [
  '🏠', '💼', '⭐', '📍', '🥩', '🥗', '🍕', '🥐', '☕', '🍷',
  '🍣', '🥤', '🍦', '👗', '💎', '📚', '🎉', '🏋️', '💈', '🌸',
  '🏛️', '🌳', '🏖️', '⛪', '🛒',
];

export function AddLocationSheet({
  open,
  onClose,
  onSave,
  proximity,
  title = 'Add a location',
  saveLabel = 'Save place',
  pickOnly = false,
}: AddLocationSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<GeocodingResult | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [type, setType] = useState<AddLocationKind>('saved');

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Reset when closed
      setQuery('');
      setResults([]);
      setPicked(null);
      setName('');
      setEmoji('📍');
      setType('saved');
      setSearchError(null);
      return;
    }
    // Focus input after sheet slide-in
    const id = window.setTimeout(() => inputRef.current?.focus(), 240);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      setSearchError(null);
      geocodePlaces(query, proximity ?? undefined, controller.signal)
        .then((r) => {
          setResults(r);
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setSearchError(err instanceof Error ? err.message : 'Search failed');
          setSearching(false);
        });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, proximity, open]);

  const pick = (r: GeocodingResult) => {
    tapHaptic();
    setPicked(r);
    setName(r.name);
    setEmoji(r.emoji);
    setQuery('');
    setResults([]);
  };

  const save = () => {
    if (!picked) return;
    tapHaptic();
    onSave({
      name: name.trim() || picked.name,
      emoji,
      type,
      lat: picked.lat,
      lng: picked.lng,
      placeName: picked.placeName,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} label={title}>
      <div className={styles.host}>
        <header className={styles.header}>
          <h3>{title}</h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {!picked ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.searchStage}
            >
              <div className={styles.inputWrap}>
                <Search size={16} className={styles.leftIcon} />
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  inputMode="search"
                  enterKeyHint="search"
                  placeholder="Search address, business, or place"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && results.length > 0) {
                      e.preventDefault();
                      pick(results[0]);
                    }
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {query && (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    aria-label="Clear"
                    onClick={() => setQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className={styles.results}>
                {searching && results.length === 0 && (
                  <div className={styles.statusRow}>
                    <div className={styles.spinner} aria-hidden /> Searching…
                  </div>
                )}
                {searchError && (
                  <div className={`${styles.statusRow} ${styles.errorRow}`}>{searchError}</div>
                )}
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={styles.result}
                    onClick={() => pick(r)}
                  >
                    <span className={styles.resultEmoji}>{r.emoji}</span>
                    <span className={styles.resultText}>
                      <span className={styles.resultName}>{r.name}</span>
                      <span className={styles.resultSub}>{r.placeName}</span>
                    </span>
                  </button>
                ))}
                {!searching && !searchError && results.length === 0 && query.trim().length >= 2 && (
                  <div className={styles.statusRow}>No matches</div>
                )}
                {!query && (
                  <div className={styles.hint}>
                    Type any street address, business, or landmark — Mapbox finds it globally.
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={styles.formStage}
            >
              <div className={styles.pickedCard}>
                <span className={styles.pickedEmoji}>{emoji}</span>
                <div className={styles.pickedCopy}>
                  <div className={styles.pickedName}>{picked.name}</div>
                  <div className={styles.pickedAddr}>{picked.placeName}</div>
                </div>
                <button
                  type="button"
                  className={styles.changeBtn}
                  onClick={() => {
                    setPicked(null);
                    setQuery(picked.name);
                  }}
                >
                  Change
                </button>
              </div>

              {!pickOnly && (
                <>
                  <label className={styles.fieldLabel}>
                    Name
                    <input
                      type="text"
                      className={styles.field}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                    />
                  </label>

                  <div className={styles.fieldLabel}>
                    Tag
                    <div className={styles.typeRow}>
                      {TYPES.map((t) => {
                        const Icon = t.Icon;
                        const active = type === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`${styles.typeBtn} ${active ? styles.typeBtnActive : ''}`}
                            onClick={() => {
                              setType(t.id);
                              // Suggest a matching emoji if user hasn't picked yet
                              if (emoji === '📍' || emoji === '🏠' || emoji === '💼' || emoji === '⭐') {
                                setEmoji(t.emoji);
                              }
                            }}
                          >
                            <Icon size={14} strokeWidth={active ? 2.2 : 1.7} />
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.fieldLabel}>
                    Emoji
                    <div className={styles.emojiGrid}>
                      {EMOJI_PALETTE.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className={`${styles.emojiBtn} ${emoji === e ? styles.emojiBtnActive : ''}`}
                          onClick={() => setEmoji(e)}
                          aria-label={`Choose ${e}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.actions}>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={save} fullWidth>
                  {saveLabel}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
