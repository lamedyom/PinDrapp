import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/layout/BrandMark';
import { supabase, OAUTH_REDIRECT_URL } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../stores/toastStore';
import { tapHaptic } from '../../lib/haptics';
import { GoogleIcon, AppleIcon } from './brandIcons';
import styles from './SplashScreen.module.css';

export function SplashScreen() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const oauth = async (provider: 'google' | 'apple') => {
    if (!supabase) {
      showToast('Connect Supabase to enable sign-in');
      return;
    }
    tapHaptic();
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Pinned to the prod URL (see OAUTH_REDIRECT_URL in lib/supabase.ts).
        // Must be in the Supabase Redirect URLs allow list.
        redirectTo: OAUTH_REDIRECT_URL,
        // Ask Google to always show the account chooser even if there's
        // only one cached account — better UX for users with multiple
        // Google accounts.
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
      },
    });
    if (error) {
      setBusy(null);
      showToast(`Sign-in error: ${error.message}`);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.gridBg} aria-hidden />
      <div className={styles.hero}>
        <motion.div
          className={styles.logo}
          initial={{ y: -300, opacity: 0, rotate: -10 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 220, mass: 0.7, delay: 0.1 }}
        >
          <BrandMark size={88} />
        </motion.div>
        <motion.h1
          className={styles.wordmark}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45 }}
        >
          pindrapp
        </motion.h1>
        <motion.p
          className={styles.tagline}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          See it once. Find it forever.
        </motion.p>
      </div>

      <motion.div
        className={styles.actions}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.5 }}
      >
        <button
          type="button"
          className={`${styles.btn} ${styles.googleBtn}`}
          onClick={() => oauth('google')}
          disabled={!!busy}
        >
          <GoogleIcon /> <span>Continue with Google</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.appleBtn}`}
          onClick={() => oauth('apple')}
          disabled={!!busy}
        >
          <AppleIcon /> <span>Continue with Apple</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.phoneBtn}`}
          onClick={() => navigate('/auth/phone')}
          disabled={!!busy}
        >
          <Phone size={16} strokeWidth={2.2} /> <span>Continue with Phone</span>
        </button>

        <div className={styles.divider}>
          <span /> or <span />
        </div>

        <button
          type="button"
          className={`${styles.btn} ${styles.outlineBtn}`}
          onClick={() => navigate('/auth/email?mode=signup')}
        >
          <Mail size={16} strokeWidth={2.2} /> <span>Sign up with Email</span>
        </button>

        <div className={styles.loginRow}>
          Already have an account?{' '}
          <button type="button" className={styles.loginLink} onClick={() => navigate('/auth/email?mode=login')}>
            Log in
          </button>
        </div>

        <div className={styles.guestRow}>
          <div className={styles.guestDivider} aria-hidden />
          <div className={styles.guestLabel}>Just browsing?</div>
          <button
            type="button"
            className={styles.guestBtn}
            onClick={() => {
              tapHaptic();
              useAuthStore.getState().continueAsGuest();
              navigate('/feed');
            }}
          >
            Continue as Guest <ArrowRight size={14} />
          </button>
        </div>

        <p className={styles.legal}>
          By continuing you agree to our <a href="#tos">Terms of Service</a> and{' '}
          <a href="#privacy">Privacy Policy</a>
        </p>
      </motion.div>

      <AnimatePresence>
        {busy && (
          <motion.div
            className={styles.busyOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.spinner} aria-hidden />
            <div className={styles.busyText}>Redirecting to {busy}…</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
