import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrandMark } from '../../components/layout/BrandMark';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

/**
 * Lands here after an OAuth provider redirect. Supabase's
 * `detectSessionInUrl: true` already pulled the session out of the URL
 * fragment, so we just wait for authStore's onAuthStateChange listener
 * to update `stage` and route accordingly.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const stage = useAuthStore((s) => s.stage);

  useEffect(() => {
    if (!supabase) {
      navigate('/');
      return;
    }
    // Belt-and-braces: explicitly read the session, then route.
    supabase.auth.getSession().then(() => {
      // The auth store's listener will fire and set the correct stage.
      // Once it's no longer 'loading', the top-level <AuthGate /> takes
      // over and routes us appropriately.
    });
  }, [navigate]);

  useEffect(() => {
    if (stage !== 'loading' && stage !== 'unauthenticated') {
      navigate('/', { replace: true });
    }
  }, [stage, navigate]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={48} />
      </motion.div>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, color: 'var(--text-muted)' }}>
        Signing you in…
      </div>
    </div>
  );
}
