import { useMemo } from 'react';
import { MapPin, Zap } from 'lucide-react';
import { useDealStore } from '../../stores/dealStore';
import { DealCard } from './DealCard';
import { CheckoutModal } from './CheckoutModal';
import { EmptyState } from '../../components/ui/EmptyState';
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

  const visibleDeals = useMemo(() => {
    return activeCategory === 'All'
      ? deals
      : deals.filter((d) => d.category === activeCategory);
  }, [deals, activeCategory]);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Zap size={18} fill="#FF5C1A" stroke="#FF5C1A" /> Flash Deals
          </h1>
          <p className={styles.sub}>Expires today · Near you</p>
        </div>
        <div className={styles.location}>
          <MapPin size={12} /> Brooklyn, NY
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

      <div className={styles.list}>
        {visibleDeals.length === 0 ? (
          <EmptyState
            icon={<Zap size={36} />}
            message="No active deals nearby right now"
          />
        ) : (
          visibleDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>

      <CheckoutModal />
    </div>
  );
}
