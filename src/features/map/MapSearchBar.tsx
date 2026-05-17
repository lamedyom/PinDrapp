import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import { useMapStore } from '../../stores/mapStore';
import { tapHaptic } from '../../lib/haptics';
import styles from './MapSearchBar.module.css';

const DEBOUNCE_MS = 220;

export function MapSearchBar() {
  const userLocation = useMapStore((s) => s.userLocation);
  const setSearchedLocation = useMapStore((s) => s.setSearchedLocation);
  const searchQuery = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);

  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      geocodePlaces(searchQuery, userLocation ?? undefined, controller.signal)
        .then((r) => {
          setResults(r);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchQuery, userLocation]);

  // Close dropdown on outside tap
  useEffect(() => {
    if (!focused) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [focused]);

  const pickResult = (r: GeocodingResult) => {
    tapHaptic();
    setSearchedLocation({
      id: r.id,
      name: r.name,
      placeName: r.placeName,
      emoji: r.emoji,
      lat: r.lat,
      lng: r.lng,
    });
    setSearchQuery('');
    setResults([]);
    setFocused(false);
  };

  const showDropdown = focused && (loading || error || results.length > 0 || searchQuery.trim().length >= 2);

  return (
    <div className={styles.outer} ref={wrapRef}>
      <div className={`${styles.wrap} ${focused ? styles.focused : ''}`}>
        <Search size={16} className={styles.leftIcon} />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Search any address, business, or place..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          className={styles.input}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.clearBtn}
            aria-label="Clear search"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchQuery('');
              setResults([]);
            }}
          >
            <X size={14} />
          </button>
        )}
        <SlidersHorizontal size={16} className={styles.rightIcon} />
      </div>

      {showDropdown && (
        <div className={styles.dropdown} role="listbox">
          {loading && results.length === 0 && (
            <div className={styles.statusRow}>
              <div className={styles.spinner} aria-hidden /> Searching...
            </div>
          )}
          {error && <div className={`${styles.statusRow} ${styles.errorRow}`}>{error}</div>}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              className={styles.result}
              onClick={() => pickResult(r)}
            >
              <span className={styles.resultEmoji}>{r.emoji}</span>
              <span className={styles.resultText}>
                <span className={styles.resultName}>{r.name}</span>
                <span className={styles.resultPlace}>{r.placeName}</span>
              </span>
            </button>
          ))}
          {!loading && !error && results.length === 0 && searchQuery.trim().length >= 2 && (
            <div className={styles.statusRow}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
