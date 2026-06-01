import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, Zap, User, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import styles from './BottomNav.module.css';

interface NavTab {
  to: string;
  label: string;
  Icon: typeof Home;
}

const TABS_LEFT: NavTab[] = [
  { to: '/feed', label: 'Feed', Icon: Home },
  { to: '/map', label: 'Map', Icon: MapPin },
];

const TABS_RIGHT: NavTab[] = [
  { to: '/deals', label: 'Deals', Icon: Zap },
  { to: '/profile', label: 'Profile', Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const onPostScreen = location.pathname === '/post';

  return (
    <nav className={`${styles.nav} no-select`} aria-label="Primary">
      {TABS_LEFT.map((tab) => (
        <NavTabLink key={tab.to} tab={tab} />
      ))}
      <button
        type="button"
        aria-label="Create post"
        className={`${styles.postBtn} ${onPostScreen ? styles.postBtnActive : ''}`}
        onClick={() => {
          // Guests / signed-out users hit the sign-up wall instead of /post.
          const auth = useAuthStore.getState();
          if (auth.isGuest || !auth.profile) {
            auth.showGuestPrompt('post');
            return;
          }
          navigate('/post');
        }}
      >
        <Plus size={22} strokeWidth={2.5} color="#fff" />
      </button>
      {TABS_RIGHT.map((tab) => (
        <NavTabLink key={tab.to} tab={tab} />
      ))}
    </nav>
  );
}

function NavTabLink({ tab }: { tab: NavTab }) {
  const Icon = tab.Icon;
  return (
    <NavLink
      to={tab.to}
      className={({ isActive }) =>
        `${styles.tab} ${isActive ? styles.tabActive : ''}`
      }
    >
      <Icon size={22} strokeWidth={1.75} />
      <span className={styles.tabLabel}>{tab.label}</span>
    </NavLink>
  );
}
