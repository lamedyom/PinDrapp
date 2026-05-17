import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{icon}</div>
      <p className={styles.msg}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
