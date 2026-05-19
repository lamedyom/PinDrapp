import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Clock } from 'lucide-react';
import { useDirectionsStore } from '../../stores/directionsStore';
import {
  etaTime,
  formatDistance,
  formatDuration,
  remainingFromStep,
} from '../../lib/directions';
import { maneuverIcon } from './maneuverIcon';
import { tapHaptic } from '../../lib/haptics';
import styles from './NavigationBottomBar.module.css';

export function NavigationBottomBar() {
  const route = useDirectionsStore((s) => s.route);
  const currentStepIndex = useDirectionsStore((s) => s.currentStepIndex);
  const advanceStep = useDirectionsStore((s) => s.advanceStep);
  const stopNavigation = useDirectionsStore((s) => s.stopNavigation);
  const setCurrentStep = useDirectionsStore((s) => s.setCurrentStep);

  const [expanded, setExpanded] = useState(false);

  if (!route) return null;

  const remaining = remainingFromStep(route, currentStepIndex);
  const eta = etaTime(remaining.durationSeconds);
  const isLast = currentStepIndex >= route.steps.length - 1;

  return (
    <motion.div
      className={styles.wrap}
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
    >
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            className={styles.stepsPane}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ol className={styles.steps}>
              {route.steps.map((step, i) => {
                const Icon = maneuverIcon(step);
                const isActive = i === currentStepIndex;
                const isPast = i < currentStepIndex;
                return (
                  <li
                    key={i}
                    className={[
                      styles.step,
                      isActive ? styles.stepActive : '',
                      isPast ? styles.stepPast : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      tapHaptic();
                      setCurrentStep(i);
                    }}
                  >
                    <span className={styles.stepIcon}>
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                    <span className={styles.stepText}>{step.instruction}</span>
                    <span className={styles.stepDist}>
                      {formatDistance(step.distanceMeters)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        className={styles.pill}
        onClick={() => {
          tapHaptic();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide step list' : 'Show step list'}
      >
        <div className={styles.pillCol}>
          <div className={styles.eta}>{eta}</div>
          <div className={styles.etaLabel}>ARRIVE</div>
        </div>
        <div className={styles.pillDivider} />
        <div className={styles.pillCol}>
          <div className={styles.metric}>
            <Clock size={11} strokeWidth={2.4} /> {formatDuration(remaining.durationSeconds)}
          </div>
          <div className={styles.metric}>{formatDistance(remaining.distanceMeters)}</div>
        </div>
        <div className={styles.pillDivider} />
        <div className={`${styles.pillCol} ${styles.actionCol}`}>
          {isLast ? (
            <button
              type="button"
              className={styles.arrivedBtn}
              onClick={(e) => {
                e.stopPropagation();
                tapHaptic();
                stopNavigation();
              }}
            >
              Arrived
            </button>
          ) : (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={(e) => {
                e.stopPropagation();
                tapHaptic();
                advanceStep();
              }}
            >
              Next
            </button>
          )}
        </div>
        <ChevronUp
          size={14}
          className={`${styles.chev} ${expanded ? styles.chevDown : ''}`}
          aria-hidden
        />
      </button>
    </motion.div>
  );
}
