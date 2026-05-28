import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { BrandMark } from '../../components/layout/BrandMark';
import { Button } from '../../components/ui/Button';
import styles from './GuestProfileScreen.module.css';

export function GuestProfileScreen() {
  const navigate = useNavigate();
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <BrandMark size={56} />
        <h1 className={styles.title}>Join Pindrapp</h1>
        <p className={styles.body}>
          Save your favorite local spots, follow businesses, and never forget a great find again.
        </p>
        <ul className={styles.perks}>
          <li>
            <MapPin size={14} /> Save places to your personal map
          </li>
          <li>
            <MapPin size={14} /> Follow businesses for their latest deals
          </li>
          <li>
            <MapPin size={14} /> Claim flash deals near you
          </li>
        </ul>
        <Button variant="primary" fullWidth onClick={() => navigate('/auth/email?mode=signup')}>
          Sign up
        </Button>
        <button
          type="button"
          className={styles.loginLink}
          onClick={() => navigate('/auth/email?mode=login')}
        >
          Already have an account? <span>Log in</span>
        </button>
      </div>
    </div>
  );
}
