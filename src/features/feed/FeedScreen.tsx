import { useMemo } from 'react';
import { Pin } from 'lucide-react';
import { useFeedStore, type FeedTab } from '../../stores/feedStore';
import { StoryRail } from './StoryRail';
import { VideoCard } from './VideoCard';
import { EmptyState } from '../../components/ui/EmptyState';
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
      ) : visiblePosts.length === 0 ? (
        <EmptyState
          icon={<Pin size={36} />}
          message="Follow businesses to see their updates"
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
