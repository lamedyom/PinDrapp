import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDirectionsStore } from '../../stores/directionsStore';
import { formatDistance } from '../../lib/directions';
import { maneuverIcon } from './maneuverIcon';
import { tapHaptic } from '../../lib/haptics';
import styles from './NavigationTopBar.module.css';

export function NavigationTopBar() {
  const route = useDirectionsStore((s) => s.route);
  const currentStepIndex = useDirectionsStore((s) => s.currentStepIndex);
  const stopNavigation = useDirectionsStore((s) => s.stopNavigation);
  const clearRoute = useDirectionsStore((s) => s.clearRoute);

  if (!route) return null;
  const step = route.steps[currentStepIndex];
  if (!step) return null;

  const Icon = maneuverIcon(step);
  const isLast = currentStepIndex >= route.steps.length - 1;

  return (
    <motion.div
      className={styles.bar}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
    >
      <div className={styles.iconWrap}>
        <Icon size={24} strokeWidth={2.4} />
      </div>

      <div className={styles.copy}>
        <div className={styles.instruction}>{step.instruction}</div>
        <div className={styles.meta}>
          {isLast ? 'Arriving' : `${formatDistance(step.distanceMeters)} ahead`}
        </div>
      </div>

      <button
        type="button"
        className={styles.exitBtn}
        aria-label="Exit navigation"
        onClick={() => {
          tapHaptic();
          stopNavigation();
          clearRoute();
        }}
      >
        <X size={18} />
      </button>
    </motion.div>
  );
}
