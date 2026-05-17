import { useMemo } from 'react';
import { useFeedStore } from '../../stores/feedStore';
import styles from './StoryRail.module.css';

export function StoryRail() {
  const posts = useFeedStore((s) => s.posts);

  const businesses = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; emoji: string; hasDeal: boolean; isLive: boolean }[] =
      [];
    for (const p of posts) {
      if (seen.has(p.businessId)) continue;
      seen.add(p.businessId);
      out.push({
        id: p.businessId,
        name: p.businessName,
        emoji: p.businessEmoji,
        hasDeal: p.hasDeal,
        isLive: !!p.isLive,
      });
    }
    return out;
  }, [posts]);

  return (
    <section className={styles.section}>
      <div className={styles.label}>📍 Near You</div>
      <div className={`${styles.rail} no-scrollbar`}>
        {businesses.map((b) => (
          <button key={b.id} type="button" className={styles.bubble}>
            <div
              className={[
                styles.ring,
                b.hasDeal ? styles.ringDeal : '',
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
