import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  Bike,
  Car,
  ChevronRight,
  Footprints,
  Locate,
  Navigation2,
  Search,
  Square,
  TrafficCone,
  X,
} from 'lucide-react';
import { useDirectionsStore, type DirectionsPoint } from '../../stores/directionsStore';
import { useMapStore } from '../../stores/mapStore';
import {
  fetchRoute,
  formatDistance,
  formatDuration,
  type TravelMode,
} from '../../lib/directions';
import { maneuverIcon } from './maneuverIcon';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import { tapHaptic } from '../../lib/haptics';
import styles from './DirectionsPanel.module.css';

const MODES: { id: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { id: 'walking', label: 'Walk', Icon: Footprints },
  { id: 'driving', label: 'Drive', Icon: Car },
  { id: 'driving-traffic', label: 'Traffic', Icon: TrafficCone },
  { id: 'cycling', label: 'Cycle', Icon: Bike },
];

const DEBOUNCE_MS = 220;

type EditTarget = 'origin' | 'destination' | null;

export function DirectionsPanel() {
  const destination = useDirectionsStore((s) => s.destination);
  const origin = useDirectionsStore((s) => s.origin);
  const mode = useDirectionsStore((s) => s.mode);
  const route = useDirectionsStore((s) => s.route);
  const loading = useDirectionsStore((s) => s.loading);
  const error = useDirectionsStore((s) => s.error);
  const setMode = useDirectionsStore((s) => s.setMode);
  const setRoute = useDirectionsStore((s) => s.setRoute);
  const setLoading = useDirectionsStore((s) => s.setLoading);
  const setError = useDirectionsStore((s) => s.setError);
  const setOrigin = useDirectionsStore((s) => s.setOrigin);
  const setDestination = useDirectionsStore((s) => s.setDestination);
  const swapEndpoints = useDirectionsStore((s) => s.swapEndpoints);
  const clearRoute = useDirectionsStore((s) => s.clearRoute);
  const isNavigating = useDirectionsStore((s) => s.isNavigating);
  const currentStepIndex = useDirectionsStore((s) => s.currentStepIndex);
  const startNavigation = useDirectionsStore((s) => s.startNavigation);
  const stopNavigation = useDirectionsStore((s) => s.stopNavigation);
  const setCurrentStep = useDirectionsStore((s) => s.setCurrentStep);
  const advanceStep = useDirectionsStore((s) => s.advanceStep);
  const userLocation = useMapStore((s) => s.userLocation);

  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  // Stash the live user location in a ref so GPS pings (which fire every
  // ~2s via watchPosition) don't enter any effect's dependency array and
  // can't trigger a refetch loop that would make the panel flash.
  const userLocationRef = useRef(userLocation);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Refetch only when the user actually changes something — destination,
  // explicit origin, mode — or the first time a GPS fix becomes available
  // (so a route requested before GPS still kicks off once it arrives).
  useEffect(() => {
    if (!destination) return;
    const o = origin
      ? { lat: origin.lat, lng: origin.lng }
      : userLocationRef.current
        ? { lat: userLocationRef.current.lat, lng: userLocationRef.current.lng }
        : null;
    if (!o) return; // wait until we have any origin

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRoute(null);
    fetchRoute(o, { lat: destination.lat, lng: destination.lng }, mode, controller.signal)
      .then((r) => {
        setRoute(r);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Failed to fetch route';
        setError(msg);
        setLoading(false);
      });
    return () => controller.abort();
  }, [
    destination?.id,
    destination?.lat,
    destination?.lng,
    origin?.id,
    origin?.lat,
    origin?.lng,
    mode,
    // Flips false→true the first time a GPS fix arrives, then stays stable —
    // so we kick off the fetch on that first fix without re-firing on drift.
    userLocation !== null,
    setError,
    setLoading,
    setRoute,
  ]);

  const looksNoRoute =
    !!error && /no\s?route|nosegment|invalidinput|too\s?far|422/i.test(error);
  const suggestDrive = looksNoRoute && (mode === 'walking' || mode === 'cycling');

  const originDisplay = origin
    ? { emoji: origin.emoji, name: origin.name }
    : { emoji: '📍', name: userLocation ? 'My location' : 'Waiting for GPS…' };

  return (
    <AnimatePresence>
      {destination && (
        <motion.div
          className={styles.panel}
          initial={{ y: 320, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        >
          <div className={styles.handle} aria-hidden />

          <div className={styles.endpointsHeader}>
            <div className={styles.endpoints}>
              <div className={styles.endpointConnector} aria-hidden>
                <span className={`${styles.dot} ${styles.dotOrigin}`} />
                <span className={styles.dotLine} />
                <span className={`${styles.dot} ${styles.dotDest}`} />
              </div>

              <div className={styles.endpointRows}>
                <button
                  type="button"
                  className={styles.endpointRow}
                  onClick={() => {
                    tapHaptic();
                    setEditTarget('origin');
                  }}
                >
                  <span className={styles.endpointLabel}>From</span>
                  <span className={styles.endpointName}>
                    <span className={styles.endpointEmoji}>{originDisplay.emoji}</span>
                    {originDisplay.name}
                  </span>
                  <ChevronRight size={14} className={styles.chev} />
                </button>

                <button
                  type="button"
                  className={styles.endpointRow}
                  onClick={() => {
                    tapHaptic();
                    setEditTarget('destination');
                  }}
                >
                  <span className={styles.endpointLabel}>To</span>
                  <span className={styles.endpointName}>
                    <span className={styles.endpointEmoji}>{destination.emoji}</span>
                    {destination.name}
                  </span>
                  <ChevronRight size={14} className={styles.chev} />
                </button>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.swapBtn}
                aria-label="Swap origin and destination"
                onClick={() => {
                  tapHaptic();
                  swapEndpoints();
                }}
              >
                <ArrowUpDown size={16} />
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Clear route"
                onClick={() => {
                  tapHaptic();
                  clearRoute();
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className={styles.modes}>
            {MODES.map((m) => {
              const Icon = m.Icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.modeBtn} ${active ? styles.modeBtnActive : ''}`}
                  onClick={() => {
                    tapHaptic();
                    setMode(m.id);
                  }}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.7} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.stats}>
            {loading && <div className={styles.loadingBar} />}
            {error && !loading && (
              <div className={styles.errorBlock}>
                <div className={styles.error}>
                  {looksNoRoute
                    ? `No ${
                        mode === 'walking' ? 'walking' : mode === 'cycling' ? 'cycling' : ''
                      } route available between these points.`
                    : `Couldn't fetch route — ${error}`}
                </div>
                {suggestDrive && (
                  <button
                    type="button"
                    className={styles.errorAction}
                    onClick={() => {
                      tapHaptic();
                      setMode('driving');
                    }}
                  >
                    Try driving instead
                  </button>
                )}
              </div>
            )}
            {route && !loading && (
              <>
                <div className={styles.stat}>
                  <div className={styles.statValue}>
                    {formatDuration(route.durationSeconds)}
                  </div>
                  <div className={styles.statLabel}>ETA</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statValue}>
                    {formatDistance(route.distanceMeters)}
                  </div>
                  <div className={styles.statLabel}>Distance</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statValue}>{route.steps.length}</div>
                  <div className={styles.statLabel}>Steps</div>
                </div>
              </>
            )}
          </div>

          {route && !loading && (
            <div className={styles.navActions}>
              {!isNavigating ? (
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={() => {
                    tapHaptic();
                    startNavigation();
                  }}
                >
                  <Navigation2 size={16} strokeWidth={2.4} />
                  Start
                </button>
              ) : (
                <>
                  <div className={styles.navStatus}>
                    <span className={styles.navDot} />
                    Navigating · Step {currentStepIndex + 1} of {route.steps.length}
                  </div>
                  <div className={styles.navBtns}>
                    {currentStepIndex < route.steps.length - 1 ? (
                      <button
                        type="button"
                        className={styles.nextBtn}
                        onClick={() => {
                          tapHaptic();
                          advanceStep();
                        }}
                      >
                        Next step
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.nextBtn}
                        onClick={() => {
                          tapHaptic();
                          stopNavigation();
                        }}
                      >
                        Arrived 🎉
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.stopBtn}
                      onClick={() => {
                        tapHaptic();
                        stopNavigation();
                      }}
                      aria-label="Exit navigation"
                    >
                      <Square size={14} strokeWidth={2.4} fill="currentColor" />
                      Exit
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {route && route.steps.length > 0 && !loading && (
            <ol className={styles.steps}>
              {route.steps.map((step, i) => {
                const Icon = maneuverIcon(step);
                const isActive = isNavigating && i === currentStepIndex;
                const isPast = isNavigating && i < currentStepIndex;
                return (
                  <li
                    key={i}
                    className={[
                      styles.step,
                      isActive ? styles.stepActive : '',
                      isPast ? styles.stepPast : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (isNavigating) setCurrentStep(i);
                    }}
                    style={{ cursor: isNavigating ? 'pointer' : 'default' }}
                  >
                    <span className={styles.stepIcon}>
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                    <span className={styles.stepText}>{step.instruction}</span>
                    <span className={styles.stepDist}>
                      {formatDistance(step.distanceMeters)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          <AnimatePresence>
            {editTarget && (
              <EndpointSearchOverlay
                target={editTarget}
                userLocation={userLocation}
                onClose={() => setEditTarget(null)}
                onPick={(point) => {
                  if (editTarget === 'origin') setOrigin(point);
                  else setDestination(point);
                  setEditTarget(null);
                }}
                onUseMyLocation={() => {
                  if (editTarget === 'origin') {
                    setOrigin(null);
                  } else if (userLocation) {
                    setDestination({
                      id: 'my-location',
                      name: 'My location',
                      emoji: '📍',
                      lat: userLocation.lat,
                      lng: userLocation.lng,
                    });
                  }
                  setEditTarget(null);
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface OverlayProps {
  target: 'origin' | 'destination';
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onPick: (point: DirectionsPoint) => void;
  onUseMyLocation: () => void;
}

function EndpointSearchOverlay({
  target,
  userLocation,
  onClose,
  onPick,
  onUseMyLocation,
}: OverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
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
      geocodePlaces(query, userLocation ?? undefined, controller.signal)
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
  }, [query, userLocation]);

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.16 }}
    >
      <div className={styles.overlayHead}>
        <span className={styles.overlayLabel}>
          {target === 'origin' ? 'Start from' : 'Go to'}
        </span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => {
            tapHaptic();
            onClose();
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.overlayInputWrap}>
        <Search size={14} className={styles.overlayLeftIcon} />
        <input
          ref={inputRef}
          className={styles.overlayInput}
          placeholder={
            target === 'origin'
              ? 'Start location — address, business, place'
              : 'Destination — address, business, place'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              const r = results[0];
              onPick({
                id: r.id,
                name: r.name,
                emoji: r.emoji,
                lat: r.lat,
                lng: r.lng,
              });
            }
          }}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className={styles.overlayClearBtn}
            aria-label="Clear"
            onClick={() => setQuery('')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className={styles.overlayList}>
        {target === 'origin' && (
          <button
            type="button"
            className={styles.overlayGps}
            onClick={() => {
              tapHaptic();
              onUseMyLocation();
            }}
          >
            <span className={styles.overlayGpsIcon}>
              <Locate size={14} strokeWidth={2.2} />
            </span>
            <span className={styles.overlayResultText}>
              <span className={styles.overlayResultName}>Use my current location</span>
              <span className={styles.overlayResultSub}>
                {userLocation ? 'Live GPS' : 'No GPS fix yet — tap to enable'}
              </span>
            </span>
          </button>
        )}

        {loading && results.length === 0 && (
          <div className={styles.overlayStatus}>
            <div className={styles.overlaySpinner} aria-hidden /> Searching…
          </div>
        )}
        {error && <div className={`${styles.overlayStatus} ${styles.overlayError}`}>{error}</div>}

        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            className={styles.overlayResult}
            onClick={() => {
              tapHaptic();
              onPick({
                id: r.id,
                name: r.name,
                emoji: r.emoji,
                lat: r.lat,
                lng: r.lng,
              });
            }}
          >
            <span className={styles.overlayResultEmoji}>{r.emoji}</span>
            <span className={styles.overlayResultText}>
              <span className={styles.overlayResultName}>{r.name}</span>
              <span className={styles.overlayResultSub}>{r.placeName}</span>
            </span>
          </button>
        ))}

        {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
          <div className={styles.overlayStatus}>No matches</div>
        )}
      </div>
    </motion.div>
  );
}
