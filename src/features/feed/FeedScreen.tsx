import { useMemo } from 'react';
import { Pin } from 'lucide-react';
import { useFeedStore, type FeedTab } from '../../stores/feedStore';
import { StoryRail } from './StoryRail';
import { VideoCard } from './VideoCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import styles from './FeedScreen.module.css';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'updates', label: 'Updates' },
  { id: 'deals', label: 'Deals' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'ai', label: 'AI Ask' },
];

export function FeedScreen() {
  const posts = useFeedStore((s) => s.posts);
  const activeTab = useFeedStore((s) => s.activeTab);
  const setTab = useFeedStore((s) => s.setTab);
  const loading = useFeedStore((s) => s.loading);
  const hydrated = useFeedStore((s) => s.hydrated);

  const visiblePosts = useMemo(() => {
    if (activeTab === 'deals') return posts.filter((p) => p.hasDeal);
    if (activeTab === 'nearby') return [...posts].sort((a, b) => a.distanceMiles - b.distanceMiles);
    if (activeTab === 'ai') return [];
    return posts;
  }, [posts, activeTab]);

  return (
    <div className={styles.screen}>
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
          message={
            hydrated
              ? 'No updates yet. Be the first business to post.'
              : 'Follow businesses to see their updates'
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
