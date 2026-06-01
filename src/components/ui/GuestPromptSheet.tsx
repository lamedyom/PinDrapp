import { useNavigate } from 'react-router-dom';
import { useAuthStore, type GuestPromptType } from '../../stores/authStore';
import { Modal } from './Modal';
import { Button } from './Button';
import styles from './GuestPromptSheet.module.css';

const COPY: Record<GuestPromptType, { title: string; body: string; primaryLabel?: string }> = {
  like: {
    title: 'Like this update',
    body: 'Join Pindrapp to support the local businesses you love.',
  },
  save: {
    title: 'Save to your map',
    body: 'Never forget a great business — pin them to your personal map.',
  },
  follow: {
    title: 'Follow this business',
    body: 'Get notified the moment they post new updates and deals.',
  },
  claim: {
    title: 'Claim this deal',
    body: 'Sign up free in seconds to save on flash deals near you.',
  },
  post: {
    title: 'Share your business',
    body: 'Create an account to post updates, flash deals, and grow your customer base.',
    primaryLabel: 'Create Business Account',
  },
};

export function GuestPromptSheet() {
  const navigate = useNavigate();
  const type = useAuthStore((s) => s.guestPromptType);
  const hide = useAuthStore((s) => s.hideGuestPrompt);

  const copy = type ? COPY[type] : null;

  const go = (path: string) => {
    hide();
    navigate(path);
  };

  return (
    <Modal open={!!type} onClose={hide} label="Sign up to continue">
      {copy && (
        <div className={styles.sheet}>
          <h3 className={styles.title}>{copy.title}</h3>
          <p className={styles.body}>{copy.body}</p>
          <Button
            variant="primary"
            fullWidth
            onClick={() => go('/auth/email?mode=signup')}
          >
            {copy.primaryLabel ?? 'Create Free Account'}
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => go('/auth/email?mode=login')}
          >
            Sign In
          </Button>
          <button type="button" className={styles.later} onClick={hide}>
            Maybe Later
          </button>
        </div>
      )}
    </Modal>
  );
}
