import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import { useDirectionsStore } from '../../stores/directionsStore';
import { GuestPromptSheet } from '../ui/GuestPromptSheet';
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
  const isBusinessProfile = location.pathname.startsWith('/profile/');
  // Full-bleed surfaces — Feed is now a TikTok-style snap scroller and Map
  // owns its own canvas, so AppShell stops drawing the TopBar and stops
  // wrapping them in the scrollable .main.
  const hideTopBar =
    location.pathname === '/map' ||
    location.pathname === '/feed' ||
    isBusinessProfile;
  const noScroll = location.pathname === '/map' || location.pathname === '/feed';

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
      {/* Global guest sign-up sheet — opens any time a visitor tries a
          restricted action (like, save, follow, claim). */}
      <GuestPromptSheet />
    </div>
  );
}
