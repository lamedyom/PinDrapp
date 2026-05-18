import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Bike,
  Car,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Footprints,
  MapPin,
  RotateCw,
  TrafficCone,
  X,
} from 'lucide-react';
import { useDirectionsStore } from '../../stores/directionsStore';
import { useMapStore } from '../../stores/mapStore';
import {
  fetchRoute,
  formatDistance,
  formatDuration,
  type RouteStep,
  type TravelMode,
} from '../../lib/directions';
import { tapHaptic } from '../../lib/haptics';
import styles from './DirectionsPanel.module.css';

const MODES: { id: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { id: 'walking', label: 'Walk', Icon: Footprints },
  { id: 'driving', label: 'Drive', Icon: Car },
  { id: 'driving-traffic', label: 'Traffic', Icon: TrafficCone },
  { id: 'cycling', label: 'Cycle', Icon: Bike },
];

function maneuverIcon(step: RouteStep): typeof ArrowUp {
  const t = step.maneuverType;
  const m = step.maneuverModifier ?? '';
  if (t === 'depart') return MapPin;
  if (t === 'arrive') return Flag;
  if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') return RotateCw;
  if (m.includes('uturn')) return RotateCw;
  if (m.includes('sharp left')) return CornerUpLeft;
  if (m.includes('sharp right')) return CornerUpRight;
  if (m.includes('slight left')) return ArrowUpLeft;
  if (m.includes('slight right')) return ArrowUpRight;
  if (m === 'left') return CornerDownLeft;
  if (m === 'right') return CornerDownRight;
  if (m === 'straight') return ArrowUp;
  if (t === 'continue') return ArrowUp;
  if (t === 'end of road') return ArrowDown;
  return ArrowUp;
}

export function DirectionsPanel() {
  const destination = useDirectionsStore((s) => s.destination);
  const mode = useDirectionsStore((s) => s.mode);
  const route = useDirectionsStore((s) => s.route);
  const loading = useDirectionsStore((s) => s.loading);
  const error = useDirectionsStore((s) => s.error);
  const setMode = useDirectionsStore((s) => s.setMode);
  const setRoute = useDirectionsStore((s) => s.setRoute);
  const setLoading = useDirectionsStore((s) => s.setLoading);
  const setError = useDirectionsStore((s) => s.setError);
  const clearRoute = useDirectionsStore((s) => s.clearRoute);
  const userLocation = useMapStore((s) => s.userLocation);

  useEffect(() => {
    if (!destination) return;
    const origin = userLocation ?? { lat: 40.7484, lng: -73.9857 };
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRoute(null);
    fetchRoute(origin, { lat: destination.lat, lng: destination.lng }, mode, controller.signal)
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
  }, [destination, mode, userLocation, setRoute, setLoading, setError]);

  const looksNoRoute = !!error && /no\s?route|nosegment|invalidinput|too\s?far|422/i.test(error);
  const suggestDrive = looksNoRoute && (mode === 'walking' || mode === 'cycling');

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

          <div className={styles.header}>
            <div className={styles.headerCopy}>
              <div className={styles.label}>Directions to</div>
              <div className={styles.destName}>
                <span className={styles.destEmoji}>{destination.emoji}</span>
                {destination.name}
              </div>
            </div>
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
                    ? `No ${mode === 'walking' ? 'walking' : mode === 'cycling' ? 'cycling' : ''} route available between these points.`
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
                  <div className={styles.statValue}>{formatDuration(route.durationSeconds)}</div>
                  <div className={styles.statLabel}>ETA</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statValue}>{formatDistance(route.distanceMeters)}</div>
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

          {route && route.steps.length > 0 && !loading && (
            <ol className={styles.steps}>
              {route.steps.map((step, i) => {
                const Icon = maneuverIcon(step);
                return (
                  <li key={i} className={styles.step}>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
