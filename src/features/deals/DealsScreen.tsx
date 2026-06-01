import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useDealStore } from '../../stores/dealStore';
import { DealCard } from './DealCard';
import { CheckoutModal } from './CheckoutModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import styles from './DealsScreen.module.css';

const CATEGORIES = [
  'All',
  'Food',
  'Shopping',
  'Beauty',
  'Services',
  'Entertainment',
  'Bakery',
  'Coffee',
];

export function DealsScreen() {
  const deals = useDealStore((s) => s.deals);
  const activeCategory = useDealStore((s) => s.activeCategory);
  const setCategory = useDealStore((s) => s.setCategory);
  const loading = useDealStore((s) => s.loading);

  const visibleDeals = useMemo(() => {
    const filtered =
      activeCategory === 'All'
        ? deals
        : deals.filter((d) => d.category === activeCategory);
    // Pro deals get priority placement within the current view.
    return [...filtered].sort((a, b) => {
      if (!!a.isPro === !!b.isPro) return 0;
      return a.isPro ? -1 : 1;
    });
  }, [deals, activeCategory]);

  const topDeals = useMemo(
    () => visibleDeals.filter((d) => d.isPro && d.expiresAt.getTime() > Date.now()).slice(0, 8),
    [visibleDeals],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Zap size={18} fill="#FF5C1A" stroke="#FF5C1A" /> Flash Deals
          </h1>
          <p className={styles.sub}>Expires today · Near you</p>
        </div>
      </header>

      <div className={`${styles.chips} no-scrollbar`}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${activeCategory === c ? styles.chipActive : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {topDeals.length > 0 && (
        <section className={styles.topDeals}>
          <div className={styles.sectionLabel}>🔥 Top Deals</div>
          <div className={`${styles.topRow} no-scrollbar`}>
            {topDeals.map((deal) => (
              <div key={`top_${deal.id}`} className={styles.topCardWrap}>
                <DealCard deal={deal} featuredLabel />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.list}>
        <div className={styles.sectionLabel}>⚡ All Deals Near You</div>
        {loading && deals.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={232} radius={16} />
          ))
        ) : visibleDeals.length === 0 ? (
          <EmptyState
            icon={<Zap size={36} />}
            message="No active deals right now — check back soon. Businesses post new deals daily."
          />
        ) : (
          visibleDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>

      <CheckoutModal />
    </div>
  );
}
