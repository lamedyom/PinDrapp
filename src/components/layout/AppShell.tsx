import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import { useDirectionsStore } from '../../stores/directionsStore';
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
  const noScroll = location.pathname === '/map';

  // While active turn-by-turn navigation is running, hide the bottom nav
  // so the map can take over the full screen (Waze / Google Maps style).
  const isNavigating = useDirectionsStore((s) => s.isNavigating);
  const hideBottomNav = isNavigating && location.pathname === '/map';

  return (
    <div className={styles.outer}>
      <div className={styles.column}>
        {!hideTopBar && <TopBar title={meta.title} showBack={meta.showBack} />}
        <main className={noScroll ? styles.mainNoScroll : styles.main}>
          {children ?? <Outlet />}
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
