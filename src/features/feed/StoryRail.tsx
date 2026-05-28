import { useMemo } from 'react';
import { useFeedStore } from '../../stores/feedStore';
import styles from './StoryRail.module.css';

export function StoryRail() {
  const posts = useFeedStore((s) => s.posts);

  const businesses = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      id: string;
      postId: string;
      name: string;
      emoji: string;
      isLive: boolean;
      isPro: boolean;
    }[] = [];
    for (const p of posts) {
      if (seen.has(p.businessId)) continue;
      seen.add(p.businessId);
      out.push({
        id: p.businessId,
        postId: p.id,
        name: p.businessName,
        emoji: p.businessEmoji,
        isLive: !!p.isLive,
        isPro: !!p.isPro,
      });
    }
    return out;
  }, [posts]);

  const scrollToCard = (postId: string) => {
    const el = document.getElementById(`post-${postId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className={styles.section}>
      <div className={styles.label}>📍 Near You</div>
      <div className={`${styles.rail} no-scrollbar`}>
        {businesses.map((b) => (
          <button
            key={b.id}
            type="button"
            className={styles.bubble}
            onClick={() => scrollToCard(b.postId)}
          >
            <div
              className={[
                styles.ring,
                b.isPro ? styles.ringPro : '',
                b.isLive ? styles.ringLive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.inner}>
                <span>{b.emoji}</span>
              </div>
              {b.isLive && <span className={styles.liveBadge}>LIVE</span>}
            </div>
            <span className={styles.label2}>{b.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
