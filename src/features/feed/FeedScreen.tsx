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
import { Skeleton } from '../../components/ui/Skeleton';
import { fetchFeed } from '../../lib/supabaseApi';
import styles from './FeedScreen.module.css';

const PULL_THRESHOLD = 60;

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'updates', label: 'Updates' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'ai', label: 'AI Ask' },
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

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const screenRef = useRef<HTMLDivElement>(null);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
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
    const root = screenRef.current;
    if (!root) return;
    // Closest scrollable ancestor (AppShell <main>); only arm the pull when
    // it's already at scrollTop=0 so we never hijack a normal scroll-up.
    let scroller: HTMLElement | null = root.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY === 'visible') {
      scroller = scroller.parentElement;
    }
    if (!scroller) scroller = document.scrollingElement as HTMLElement;

    const onStart = (e: TouchEvent) => {
      if (!scroller || scroller.scrollTop > 0 || refreshing) return;
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
      // Rubber-band: damp the visual distance so the indicator never feels
      // glued to a finger that's still moving past threshold.
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

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', onEnd);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, userId, userLocation?.lat, userLocation?.lng]);

  // Mirror pullDist into a ref so the touchend handler can read it without
  // re-binding listeners on every state change.
  const pullDistRef = useRef(0);
  pullDistRef.current = pullDist;

  const visiblePosts = useMemo(() => {
    if (activeTab === 'nearby') return [...posts].sort((a, b) => a.distanceMiles - b.distanceMiles);
    if (activeTab === 'ai') return [];
    return posts;
  }, [posts, activeTab]);

  return (
    <div ref={screenRef} className={styles.screen}>
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
      <StoryRail />

      <div className={styles.tabs}>
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

      {activeTab === 'ai' ? (
        <EmptyState
          icon={<Pin size={36} />}
          message="AI assistant coming soon — ask Pindrapp anything about nearby places, deals, and recommendations."
        />
      ) : loading && posts.length === 0 ? (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => (
            <FeedSkeleton key={i} />
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
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
      ) : (
        <div className={styles.list}>
          {visiblePosts.map((post) => (
            <VideoCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ height: 340, position: 'relative', overflow: 'hidden' }}>
      <Skeleton width="100%" height={340} radius={0} />
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width={140} height={34} radius={20} />
        <Skeleton width={70} height={28} radius={20} />
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="80%" height={12} radius={6} />
        <Skeleton width="40%" height={12} radius={6} />
      </div>
    </div>
  );
}
