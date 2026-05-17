import { motion } from 'framer-motion';
import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  on: boolean;
  onChange: () => void;
  ariaLabel?: string;
}

export function ToggleSwitch({ on, onChange, ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`${styles.track} ${on ? styles.on : styles.off}`}
    >
      <motion.span
        className={styles.thumb}
        animate={{ x: on ? 16 : 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      />
    </button>
  );
}
