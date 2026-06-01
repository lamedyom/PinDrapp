import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Navigation, Radio } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore } from '../../stores/directionsStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { searchRadar, type RadarBusinessResult, type RadarResponse } from '../../lib/radarService';
import { tapHaptic } from '../../lib/haptics';
import styles from './RadarScreen.module.css';

const SUGGESTIONS = [
  '🥩 Kosher near me',
  '⚡ Deals right now',
  '☕ Best coffee today',
  '🎉 Events this week',
  '🆕 New businesses',
  '📍 Save a place',
];

export function RadarScreen() {
  const navigate = useNavigate();
  const userLocation = useMapStore((s) => s.userLocation);
  const setDestination = useDirectionsStore((s) => s.setDestination);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RadarResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const submit = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    tapHaptic();
    setLoading(true);
    setResponse(null);
    try {
      const res = await searchRadar(trimmed, userLocation ?? null);
      setResponse(res);
    } finally {
      setLoading(false);
    }
  };

  const pickSuggestion = (s: string) => {
    setQuery(s);
    void submit(s);
    inputRef.current?.blur();
  };

  const goToBusiness = (id: string) => navigate(`/profile/${id}`);

  const goDirections = (b: RadarBusinessResult) => {
    setDestination({ id: b.id, name: b.name, emoji: b.emoji, lat: b.lat, lng: b.lng });
    navigate('/map');
  };

  return (
    <div className={styles.screen}>
      {/* ── Hero — animated radar rings + headline */}
      <section className={styles.hero}>
        <div className={styles.ringStage} aria-hidden>
          <div className={`${styles.ring} ${styles.ring1}`} />
          <div className={`${styles.ring} ${styles.ring2}`} />
          <div className={`${styles.ring} ${styles.ring3}`} />
          <div className={styles.pin}>
            <MapPin size={32} fill="#FF5C1A" stroke="#fff" strokeWidth={2} />
          </div>
        </div>
        <h1 className={styles.title}>What are you looking for?</h1>
        <p className={styles.sub}>Ask anything — deals, restaurants, events nearby.</p>
      </section>

      {/* ── Search bar overlapping hero bottom */}
      <div className={styles.searchWrap}>
        <div className={styles.searchPill}>
          <Radio size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Radar anything..."
            className={styles.searchInput}
            autoComplete="off"
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit(query);
              }
            }}
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              className={styles.sendBtn}
              aria-label="Search"
              onClick={() => void submit(query)}
            >
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Quick suggestions */}
      <div className={`${styles.suggestRow} no-scrollbar`}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.suggestChip}
            onClick={() => pickSuggestion(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Results */}
      <div className={styles.results}>
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} aria-hidden />
            <div className={styles.loadingLabel}>Radar is scanning…</div>
            <div className={styles.skeletonStack}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} width="100%" height={68} radius={14} />
              ))}
            </div>
          </div>
        )}

        {!loading && response && (
          <>
            {response.message && <p className={styles.aiMessage}>{response.message}</p>}
            <div className={styles.resultList}>
              {response.businesses.map((b) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={styles.resultCard}
                >
                  <div className={styles.resultEmoji}>{b.emoji}</div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{b.name}</div>
                    <div className={styles.resultMeta}>
                      {b.category}
                      {b.distanceMiles != null && ` · ${b.distanceMiles.toFixed(1)} mi`}
                    </div>
                    {b.hasActiveDeal && (
                      <span className={styles.dealPill}>⚡ Deal active</span>
                    )}
                  </div>
                  <div className={styles.resultActions}>
                    <Button size="sm" variant="save" onClick={() => goToBusiness(b.id)}>
                      View
                    </Button>
                    <button
                      type="button"
                      className={styles.dirBtn}
                      aria-label={`Directions to ${b.name}`}
                      onClick={() => goDirections(b)}
                    >
                      <Navigation size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {!loading && !response && (
          <div className={styles.initial}>
            <p className={styles.initialHint}>
              Type a question above, or tap a suggestion to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
