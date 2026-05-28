import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { useAuthStore, type UserType } from '../../stores/authStore';
import { tapHaptic } from '../../lib/haptics';
import styles from './UserTypeScreen.module.css';

export function UserTypeScreen() {
  const setUserType = useAuthStore((s) => s.setUserType);
  const signOut = useAuthStore((s) => s.signOut);
  const [picked, setPicked] = useState<UserType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!picked || submitting) return;
    tapHaptic();
    setSubmitting(true);
    await setUserType(picked);
    setSubmitting(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <h1 className={styles.title}>Welcome to Pindrapp</h1>
        <p className={styles.sub}>
          Discover local businesses, save your favorites, and never forget a great find again.
        </p>
      </header>

      <div className={styles.cards}>
        <Card
          active={picked === 'business'}
          onClick={() => {
            tapHaptic();
            setPicked('business');
          }}
          Icon={Store}
          accent="orange"
          title="I own or manage a business"
          features={['Post updates', 'Create flash deals', 'Get discovered']}
        />
        <Card
          active={picked === 'consumer'}
          onClick={() => {
            tapHaptic();
            setPicked('consumer');
          }}
          Icon={MapPin}
          accent="blue"
          title="I want to discover local businesses"
          features={['Find deals near you', 'Save places', 'Explore your neighborhood']}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!picked || submitting}
          onClick={submit}
        >
          {submitting ? 'Setting up…' : 'Continue'} <ArrowRight size={16} />
        </button>
        <button type="button" className={styles.secondaryLink} onClick={signOut}>
          Use a different account
        </button>
      </div>
    </div>
  );
}

interface CardProps {
  active: boolean;
  onClick: () => void;
  Icon: typeof Store;
  accent: 'orange' | 'blue';
  title: string;
  features: string[];
}

function Card({ active, onClick, Icon, accent, title, features }: CardProps) {
  return (
    <motion.button
      type="button"
      className={[
        styles.card,
        accent === 'orange' ? styles.cardOrange : styles.cardBlue,
        active ? styles.cardActive : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className={styles.cardIconWrap}>
        <Icon size={24} strokeWidth={2.1} />
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.cardTitle}>{title}</div>
        <ul className={styles.featureList}>
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div className={styles.cardRadio} aria-hidden>
        {active && <div className={styles.cardRadioDot} />}
      </div>
    </motion.button>
  );
}
