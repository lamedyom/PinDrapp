import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { BrandMark } from './BrandMark';
import styles from './TopBar.module.css';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
}

export function TopBar({ title, showBack, rightAction }: TopBarProps) {
  const navigate = useNavigate();
  const isLogoMode = !title;

  return (
    <header className={`${styles.bar} no-select`}>
      <div className={styles.left}>
        {showBack && (
          <button
            type="button"
            aria-label="Back"
            className={styles.iconBtn}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {isLogoMode && !showBack && (
          <div className={styles.logo}>
            <BrandMark size={26} />
            <span className={styles.brandWord}>pindrapp</span>
          </div>
        )}
      </div>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.right}>{rightAction}</div>
    </header>
  );
}
