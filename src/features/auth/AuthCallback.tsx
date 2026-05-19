import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrandMark } from '../../components/layout/BrandMark';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

/**
 * Lands here after Google / Apple / email OAuth.
 *
 * - Supabase JS v2 uses the PKCE flow by default — the URL has `?code=…`.
 *   `detectSessionInUrl: true` (set in lib/supabase.ts) usually exchanges it
 *   automatically, but we call `exchangeCodeForSession` explicitly here to
 *   handle edge cases where the auto-exchange didn't fire (page reload,
 *   strict-mode double mount, etc.).
 * - Once `authStore.stage` settles, route by it:
 *     authenticated         → /feed   (existing onboarded user)
 *     pickingType / onboarding* → /onboarding (new user)
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const stage = useAuthStore((s) => s.stage);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      navigate('/auth/splash', { replace: true });
      return;
    }
    const url = new URL(window.location.href);
    const hasPkceCode = !!url.searchParams.get('code');
    const hasErrorParam = url.searchParams.get('error') ?? url.hash.includes('error=');

    if (hasErrorParam) {
      const desc =
        url.searchParams.get('error_description') ??
        url.hash.match(/error_description=([^&]+)/)?.[1] ??
        'OAuth sign-in failed';
      setExchangeError(decodeURIComponent(desc).replace(/\+/g, ' '));
      return;
    }

    const sb = supabase;
    const finalize = async () => {
      try {
        if (hasPkceCode) {
          // Belt-and-braces: even though detectSessionInUrl handles this,
          // running it explicitly avoids races on slow networks.
          await sb.auth.exchangeCodeForSession(window.location.href);
        }
        await sb.auth.getSession();
        await refreshProfile();
      } catch (e) {
        setExchangeError(e instanceof Error ? e.message : 'Failed to complete sign-in');
      }
    };
    void finalize();
  }, [navigate, refreshProfile]);

  // Once the auth store finishes resolving, send the user to the right place.
  useEffect(() => {
    if (stage === 'loading') return;
    if (stage === 'unauthenticated') {
      // OAuth came back but no session — kick back to splash.
      navigate('/auth/splash', { replace: true });
      return;
    }
    if (stage === 'authenticated' || stage === 'disabled') {
      navigate('/feed', { replace: true });
      return;
    }
    // pickingType / onboardingBusiness / onboardingConsumer → onboarding URL.
    // AuthGate overlays the correct screen for the stage.
    navigate('/onboarding', { replace: true });
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
        padding: 24,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={48} />
      </motion.div>
      <div
        style={{
          fontFamily: 'var(--font-head)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        {exchangeError ? 'Sign-in failed' : 'Signing you in…'}
      </div>
      {exchangeError && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--red)',
              maxWidth: 320,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {exchangeError}
          </div>
          <button
            type="button"
            onClick={() => navigate('/auth/splash', { replace: true })}
            style={{
              marginTop: 8,
              background: 'var(--orange)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back to sign in
          </button>
        </>
      )}
    </div>
  );
}
