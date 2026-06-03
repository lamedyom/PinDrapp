import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { BrandMark } from '../components/layout/BrandMark';
import { UserTypeScreen } from '../features/auth/UserTypeScreen';
import { BusinessOnboarding } from '../features/auth/BusinessOnboarding';
import { ConsumerOnboarding } from '../features/auth/ConsumerOnboarding';
import { useBootstrap } from '../hooks/useBootstrap';
import { showToast } from '../stores/toastStore';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Decides what to render based on the auth stage:
 * - loading → branded splash while checking session
 * - unauthenticated → push the user to /auth/splash (the regular auth routes
 *   from routes.tsx render). Only allow /auth/* paths through.
 * - pickingType → user-type screen (signed in, no profile yet)
 * - onboardingBusiness / onboardingConsumer → forced onboarding overlay
 * - authenticated → the main app
 * - disabled (no Supabase config) → main app with mock data, auth skipped
 */
export function AuthGate({ children }: AuthGateProps) {
  const stage = useAuthStore((s) => s.stage);
  const initialize = useAuthStore((s) => s.initialize);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Ultimate safety net: nothing may keep the user on the loading splash for
  // more than 8s. If auth init is still pending (e.g. Supabase totally
  // unreachable), force into offline mode so the app renders.
  useEffect(() => {
    const hardTimeout = window.setTimeout(() => {
      if (useAuthStore.getState().stage === 'loading') {
        // eslint-disable-next-line no-console
        console.warn('[pindrapp] hard timeout (8s) — forcing past loading');
        useAuthStore.setState({ stage: 'disabled' });
        showToast('Running in offline mode');
      }
    }, 8000);
    return () => window.clearTimeout(hardTimeout);
  }, []);

  // Fetches feed, deals, explore, and saved-places from Supabase whenever a
  // user is authenticated. No-op in 'disabled' (no Supabase) mode.
  useBootstrap();

  // When unauthenticated, push to splash unless already on an /auth/* route.
  useEffect(() => {
    if (stage === 'unauthenticated' && !location.pathname.startsWith('/auth')) {
      navigate('/auth/splash', { replace: true });
    }
  }, [stage, location.pathname, navigate]);

  // In any onboarding stage, keep the URL on /onboarding so it matches the
  // visible overlay. AuthGate returns the overlay component below; the URL
  // is just for user/back-button clarity.
  useEffect(() => {
    const inOnboarding =
      stage === 'pickingType' ||
      stage === 'onboardingBusiness' ||
      stage === 'onboardingConsumer';
    if (
      inOnboarding &&
      location.pathname !== '/onboarding' &&
      !location.pathname.startsWith('/auth')
    ) {
      navigate('/onboarding', { replace: true });
    }
  }, [stage, location.pathname, navigate]);

  // When fully authenticated and currently on an /auth/* or /onboarding route,
  // send to feed.
  useEffect(() => {
    if (
      stage === 'authenticated' &&
      (location.pathname.startsWith('/auth') || location.pathname === '/onboarding')
    ) {
      navigate('/feed', { replace: true });
    }
  }, [stage, location.pathname, navigate]);

  // No Supabase configured (demo / mock-data mode): the /onboarding route
  // has no meaning — never strand the user on the blank onboarding
  // placeholder. /auth/* IS allowed even in `disabled` mode because that
  // stage is also entered after the user taps "Continue as Guest" — and
  // a guest still needs to reach the sign-up / sign-in screens from the
  // guest-prompt sheet. Without this carve-out the buttons on that sheet
  // navigated → got bounced back to /feed in the same tick.
  useEffect(() => {
    if (stage === 'disabled' && location.pathname === '/onboarding') {
      navigate('/feed', { replace: true });
    }
  }, [stage, location.pathname, navigate]);

  if (stage === 'loading') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-page)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandMark size={56} />
        </motion.div>
        <div
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 800,
            fontSize: 22,
            color: 'var(--text-primary)',
          }}
        >
          pindrapp
        </div>
      </div>
    );
  }

  if (stage === 'pickingType') {
    return <UserTypeScreen />;
  }

  if (stage === 'onboardingBusiness') {
    return <BusinessOnboarding />;
  }

  if (stage === 'onboardingConsumer') {
    return <ConsumerOnboarding />;
  }

  // unauthenticated, authenticated, or disabled — render the regular tree.
  // The redirects above handle keeping unauthed users on /auth/*.
  return <>{children}</>;
}
