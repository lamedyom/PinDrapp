import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  children?: ReactNode;
}

const TITLE_BY_PATH: Record<string, { title?: string; showBack?: boolean }> = {
  '/feed': {},
  '/map': {},
  '/deals': {},
  '/profile': {},
};

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const meta = TITLE_BY_PATH[location.pathname] ?? {};
  const hideTopBar = location.pathname === '/map';

  return (
    <div className={styles.outer}>
      <div className={styles.column}>
        {!hideTopBar && <TopBar title={meta.title} showBack={meta.showBack} />}
        <main className={styles.main}>{children ?? <Outlet />}</main>
        <BottomNav />
      </div>
    </div>
  );
}
