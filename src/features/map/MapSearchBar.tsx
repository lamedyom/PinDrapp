import { useEffect, useRef, useState } from 'react';
import { Navigation, Search, SlidersHorizontal, X } from 'lucide-react';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore } from '../../stores/directionsStore';
import { searchBusinesses, type BusinessSearchResult } from '../../lib/supabaseApi';
import { tapHaptic } from '../../lib/haptics';
import styles from './MapSearchBar.module.css';

const DEBOUNCE_MS = 250;

export function MapSearchBar() {
  const userLocation = useMapStore((s) => s.userLocation);
  const setSearchedLocation = useMapStore((s) => s.setSearchedLocation);
  const searchQuery = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const setDestination = useDirectionsStore((s) => s.setDestination);

  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [bizResults, setBizResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setBizResults([]);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      // Run address geocoding + Pindrapp business search in parallel.
      geocodePlaces(searchQuery, userLocation ?? undefined, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          setResults(r);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
          setLoading(false);
        });
      searchBusinesses(searchQuery, userLocation)
        .then((b) => {
          if (!controller.signal.aborted) setBizResults(b);
        })
        .catch(() => {
          if (!controller.signal.aborted) setBizResults([]);
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

  const reset = () => {
    setSearchQuery('');
    setResults([]);
    setBizResults([]);
    setFocused(false);
    inputRef.current?.blur();
  };

  const dropPin = (r: GeocodingResult) => {
    tapHaptic();
    setSearchedLocation({
      id: r.id,
      name: r.name,
      placeName: r.placeName,
      emoji: r.emoji,
      lat: r.lat,
      lng: r.lng,
    });
    reset();
  };

  // Tap a Pindrapp business: fly there, drop a pin, and open the business
  // popup (which links through to /profile/:businessId).
  const selectBusiness = (b: BusinessSearchResult) => {
    tapHaptic();
    setSearchedLocation({
      id: b.id,
      name: b.name,
      placeName: b.address ?? b.category,
      emoji: b.emoji,
      category: b.category,
      businessId: b.id,
      lat: b.lat,
      lng: b.lng,
    });
    reset();
  };

  const routeTo = (r: GeocodingResult) => {
    tapHaptic();
    setDestination({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      lat: r.lat,
      lng: r.lng,
    });
    setSearchQuery('');
    setResults([]);
    setFocused(false);
    inputRef.current?.blur();
  };

  // On Enter: jump straight into directions for the top result.
  const handleSubmit = () => {
    if (results.length > 0) routeTo(results[0]);
  };

  const showDropdown =
    focused &&
    (loading || error || results.length > 0 || bizResults.length > 0 || searchQuery.trim().length >= 2);

  return (
    <div className={styles.outer} ref={wrapRef}>
      <div className={`${styles.wrap} ${focused ? styles.focused : ''}`}>
        <Search size={16} className={styles.leftIcon} />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Search businesses or addresses"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
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
              setBizResults([]);
            }}
          >
            <X size={14} />
          </button>
        )}
        <SlidersHorizontal size={16} className={styles.rightIcon} />
      </div>

      {showDropdown && (
        <div className={styles.dropdown} role="listbox">
          {loading && results.length === 0 && bizResults.length === 0 && (
            <div className={styles.statusRow}>
              <div className={styles.spinner} aria-hidden /> Searching...
            </div>
          )}
          {error && <div className={`${styles.statusRow} ${styles.errorRow}`}>{error}</div>}

          {bizResults.length > 0 && (
            <>
              <div className={styles.sectionHeader}>📍 On Pindrapp</div>
              {bizResults.map((b) => (
                <button
                  key={`biz_${b.id}`}
                  type="button"
                  className={styles.result}
                  onClick={() => selectBusiness(b)}
                  aria-label={`Show ${b.name} on map`}
                >
                  <span className={`${styles.bizAvatar} ${b.isPro ? styles.bizAvatarPro : ''}`}>
                    {b.avatarUrl ? (
                      <img src={b.avatarUrl} alt="" className={styles.bizAvatarImg} loading="lazy" />
                    ) : (
                      b.emoji
                    )}
                  </span>
                  <span className={styles.resultText}>
                    <span className={styles.resultName}>{b.name}</span>
                    <span className={styles.resultPlace}>
                      {[b.category, b.address].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {b.isPro ? (
                    <span className={styles.proBadge}>⭐ PRO</span>
                  ) : b.distanceMiles != null ? (
                    <span className={styles.bizDistance}>{b.distanceMiles.toFixed(1)} mi</span>
                  ) : null}
                </button>
              ))}
            </>
          )}

          {results.length > 0 && <div className={styles.sectionHeader}>🗺️ Places</div>}
          {results.map((r) => (
            <div key={r.id} className={styles.resultRow} role="option">
              <button
                type="button"
                className={styles.result}
                onClick={() => dropPin(r)}
                aria-label={`Show ${r.name} on map`}
              >
                <span className={styles.resultEmoji}>{r.emoji}</span>
                <span className={styles.resultText}>
                  <span className={styles.resultName}>{r.name}</span>
                  <span className={styles.resultPlace}>{r.placeName}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.directionsBtn}
                onClick={() => routeTo(r)}
                aria-label={`Get directions to ${r.name}`}
                title="Get directions"
              >
                <Navigation size={16} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          {!loading &&
            !error &&
            results.length === 0 &&
            bizResults.length === 0 &&
            searchQuery.trim().length >= 2 && (
              <div className={styles.statusRow}>No matches</div>
            )}
          {results.length > 0 && (
            <div className={styles.dropdownHint}>
              Tap a row to drop a pin · Tap{' '}
              <span className={styles.inlineArrow}>
                <Navigation size={10} strokeWidth={2.4} />
              </span>{' '}
              for directions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
