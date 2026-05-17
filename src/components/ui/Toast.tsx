import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../stores/toastStore';
import styles from './Toast.module.css';

export function Toast() {
  const message = useToastStore((s) => s.message);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="toast"
          className={styles.toast}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
          role="status"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
