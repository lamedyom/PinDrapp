import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../stores/toastStore';
import { startProTrial } from '../../lib/subscriptionService';
import styles from './AIUpgradeModal.module.css';

interface AIUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful trial start so the parent can re-open AI Autopilot. */
  onTrialStarted?: () => void;
}

const FEATURES = [
  'AI writes the headline and description',
  'Generates a professional deal image',
  'Suggests the best price and duration',
  'Schedules for peak customer activity',
  'You review and edit before it goes live',
];

export function AIUpgradeModal({ open, onClose, onTrialStarted }: AIUpgradeModalProps) {
  const business = useAuthStore((s) => s.business);
  const [submitting, setSubmitting] = useState(false);

  const handleTrial = async () => {
    if (!business) {
      showToast('Sign in as a business to start a trial');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await startProTrial(business.id);
      if (ok) {
        showToast('Welcome to Pindrapp Pro — 7 days free ⭐');
        onTrialStarted?.();
        onClose();
      } else {
        showToast('Could not start trial — try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} label="AI Deal Autopilot — Pro">
      <div className={styles.sheet}>
        <div className={styles.iconWrap}>
          <Sparkles size={24} />
        </div>
        <h3 className={styles.title}>Meet AI Deal Autopilot</h3>
        <p className={styles.body}>
          AI analyzes your menu, your best sellers, and what customers in your area are buying
          right now. Then it writes your deal, creates a professional image, and schedules it for
          the perfect time. One tap. Done.
        </p>

        <ul className={styles.features}>
          {FEATURES.map((f) => (
            <li key={f}>
              <span className={styles.check}>✓</span> {f}
            </li>
          ))}
        </ul>

        <div className={styles.price}>
          $29/month <span className={styles.cancel}>· cancel anytime</span>
        </div>

        <Button variant="primary" fullWidth onClick={handleTrial} disabled={submitting}>
          {submitting ? 'Starting trial…' : 'Start Free Trial — 7 Days Free'}
        </Button>
        <button type="button" className={styles.maybeLater} onClick={onClose}>
          Maybe Later
        </button>
      </div>
    </Modal>
  );
}
