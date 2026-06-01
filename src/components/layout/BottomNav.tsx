import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, Radio, User, Zap, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import styles from './BottomNav.module.css';

interface NavTab {
  to: string;
  label: string;
  Icon: typeof Home;
}

// Business owner layout — five slots: Feed | Map | + | Deals | Profile.
const BIZ_LEFT: NavTab[] = [
  { to: '/feed', label: 'Feed', Icon: Home },
  { to: '/map', label: 'Map', Icon: MapPin },
];
const BIZ_RIGHT: NavTab[] = [
  { to: '/deals', label: 'Deals', Icon: Zap },
  { to: '/profile', label: 'Profile', Icon: User },
];

// Consumer layout — five slots: Feed | Radar | Map(center) | Deals | Profile.
// The center Map button is icon-only (no text) and blue, matching the
// business + button's elevated style.
const CONSUMER_LEFT: NavTab[] = [
  { to: '/feed', label: 'Feed', Icon: Home },
  { to: '/radar', label: 'Radar', Icon: Radio },
];
const CONSUMER_RIGHT: NavTab[] = [
  { to: '/deals', label: 'Deals', Icon: Zap },
  { to: '/profile', label: 'Profile', Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const isBusinessOwner = profile?.userType === 'business';
  const onPostScreen = location.pathname === '/post';
  const onMapScreen = location.pathname === '/map';

  if (isBusinessOwner) {
    return (
      <nav className={`${styles.nav} no-select`} aria-label="Primary">
        {BIZ_LEFT.map((tab) => (
          <NavTabLink key={tab.to} tab={tab} />
        ))}
        <button
          type="button"
          aria-label="Create post"
          className={`${styles.postBtn} ${onPostScreen ? styles.postBtnActive : ''}`}
          onClick={() => navigate('/post')}
        >
          <Plus size={22} strokeWidth={2.5} color="#fff" />
        </button>
        {BIZ_RIGHT.map((tab) => (
          <NavTabLink key={tab.to} tab={tab} />
        ))}
      </nav>
    );
  }

  // Consumer / guest layout.
  return (
    <nav className={`${styles.nav} no-select`} aria-label="Primary">
      {CONSUMER_LEFT.map((tab) => (
        <NavTabLink key={tab.to} tab={tab} />
      ))}
      <button
        type="button"
        aria-label="Open map"
        className={`${styles.mapBtn} ${onMapScreen ? styles.mapBtnActive : ''}`}
        onClick={() => navigate('/map')}
      >
        <MapPin size={24} strokeWidth={2.2} color="#fff" />
      </button>
      {CONSUMER_RIGHT.map((tab) => (
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
