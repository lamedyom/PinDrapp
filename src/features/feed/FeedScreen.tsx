import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, RefreshCw } from 'lucide-react';
import { useFeedStore, type FeedTab } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { StoryRail } from './StoryRail';
import { VideoCard } from './VideoCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { fetchFeed } from '../../lib/supabaseApi';
import styles from './FeedScreen.module.css';

const PULL_THRESHOLD = 60;

// Note: 'ai' is intentionally absent — AI search lives in the Radar tab in
// the bottom nav now, so duplicating it in the feed would be confusing.
const TABS: { id: FeedTab; label: string }[] = [
  { id: 'updates', label: 'Updates' },
  { id: 'nearby', label: 'Nearby' },
];

export function FeedScreen() {
  const navigate = useNavigate();
  const posts = useFeedStore((s) => s.posts);
  const activeTab = useFeedStore((s) => s.activeTab);
  const setTab = useFeedStore((s) => s.setTab);
  const loading = useFeedStore((s) => s.loading);
  const isBusinessOwner = useAuthStore(
    (s) => s.profile?.userType === 'business' && !!s.business,
  );
  const userId = useAuthStore((s) => s.profile?.id);
  const userLocation = useMapStore((s) => s.userLocation);

  const visiblePosts = useMemo(() => {
    if (activeTab === 'nearby') return [...posts].sort((a, b) => a.distanceMiles - b.distanceMiles);
    return posts;
  }, [posts, activeTab]);

  // ── Active card detection — exactly one card "plays" at a time.
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersectionRatio that crosses the
        // active threshold — guards against two cards both being "kinda" in
        // view during snap-scroll easing. Threshold dropped to 0.6 so we
        // settle on the new card sooner during the snap animation.
        let best: { id: string; ratio: number } | null = null;
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.postId;
          if (!id) continue;
          if (e.intersectionRatio >= 0.6 && (!best || e.intersectionRatio > best.ratio)) {
            best = { id, ratio: e.intersectionRatio };
          }
        }
        if (best) setActivePostId(best.id);
      },
      { root, threshold: [0.6, 0.8] },
    );
    const cards = root.querySelectorAll('[data-post-id]');
    cards.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [visiblePosts.length]);

  // Default the active card to the first one on initial render so it autoplays.
  useEffect(() => {
    if (!activePostId && visiblePosts[0]) setActivePostId(visiblePosts[0].id);
  }, [visiblePosts, activePostId]);

  // ── Pull-to-refresh on the snap container itself.
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistRef = useRef(0);
  pullDistRef.current = pullDist;
  const pullRef = useRef({ startY: 0, tracking: false });

  const refresh = async () => {
    setRefreshing(true);
    useFeedStore.getState().setLoading(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
    try {
      const near = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null;
      const fresh = await fetchFeed(near, userId);
      useFeedStore.getState().hydrate(fresh);
    } catch {
      useFeedStore.getState().setLoading(false);
    } finally {
      setRefreshing(false);
      setPullDist(0);
    }
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshing) return;
      pullRef.current.startY = e.touches[0].clientY;
      pullRef.current.tracking = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pullRef.current.tracking) return;
      const dy = e.touches[0].clientY - pullRef.current.startY;
      if (dy <= 0) {
        setPullDist(0);
        return;
      }
      setPullDist(Math.min(dy * 0.55, PULL_THRESHOLD * 1.8));
    };
    const onEnd = () => {
      if (!pullRef.current.tracking) return;
      pullRef.current.tracking = false;
      if (pullDistRef.current >= PULL_THRESHOLD) {
        void refresh();
      } else {
        setPullDist(0);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, userId, userLocation?.lat, userLocation?.lng]);

  // ── Story rail visibility — fade it out as the user scrolls past the
  // very first card (Instagram-Stories feel).
  const [storyOpacity, setStoryOpacity] = useState(1);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const ratio = el.scrollTop / Math.max(1, window.innerHeight * 0.6);
      setStoryOpacity(Math.max(0, 1 - ratio));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [visiblePosts.length]);

  return (
    <div className={styles.screen}>
      {/* ── Floating top overlay: tab pill + story rail */}
      <div
        className={styles.topOverlay}
        style={{ opacity: storyOpacity > 0.04 ? 1 : 0.85 }}
      >
        <div className={styles.tabPill}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.storyRailWrap} style={{ opacity: storyOpacity }}>
          <StoryRail />
        </div>
      </div>

      {/* ── Pull-to-refresh banner (above everything in the scroller) */}
      {(pullDist > 0 || refreshing) && (
        <div
          className={`${styles.pullIndicator} ${refreshing ? styles.pullIndicatorActive : ''}`}
          style={{
            height: refreshing ? PULL_THRESHOLD : pullDist,
            opacity: refreshing ? 1 : Math.min(1, pullDist / PULL_THRESHOLD),
          }}
        >
          <RefreshCw
            size={16}
            className={refreshing ? styles.pullIconSpin : styles.pullIcon}
            style={{ transform: refreshing ? undefined : `rotate(${pullDist * 4}deg)` }}
          />
          <span>{refreshing ? 'Refreshing…' : 'Pull to refresh'}</span>
        </div>
      )}

      {/* ── Snap scroller */}
      <div ref={scrollerRef} className={styles.scroller}>
        {loading && visiblePosts.length === 0 ? (
          <div className={styles.fullScreenEmpty}>
            <div className={styles.loadingMsg}>Loading feed…</div>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className={styles.fullScreenEmpty}>
            <EmptyState
              icon={<Pin size={36} />}
              message="No updates yet. Be the first business to post, or explore the map to discover businesses near you."
              action={
                <div className={styles.emptyActions}>
                  <Button variant="save" onClick={() => navigate('/map')}>
                    Explore Map
                  </Button>
                  {isBusinessOwner && (
                    <Button variant="primary" onClick={() => navigate('/post')}>
                      Post Your First Update
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        ) : (
          visiblePosts.map((post) => (
            <VideoCard key={post.id} post={post} isActive={activePostId === post.id} />
          ))
        )}
      </div>
    </div>
  );
}
