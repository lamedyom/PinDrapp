import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { BrandMark } from '../components/layout/BrandMark';
import { UserTypeScreen } from '../features/auth/UserTypeScreen';
import { BusinessOnboarding } from '../features/auth/BusinessOnboarding';
import { ConsumerOnboarding } from '../features/auth/ConsumerOnboarding';
import { useBootstrap } from '../hooks/useBootstrap';

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

  // Fetches feed, deals, explore, and saved-places from Supabase whenever a
  // user is authenticated. No-op in 'disabled' (no Supabase) mode.
  useBootstrap();

  // When unauthenticated, push to splash unless already on an /auth/* route.
  useEffect(() => {
    if (stage === 'unauthenticated' && !location.pathname.startsWith('/auth')) {
      navigate('/auth/splash', { replace: true });
    }
  }, [stage, location.pathname, navigate]);

  // When fully authenticated and currently on an /auth/* route, send to feed.
  useEffect(() => {
    if (stage === 'authenticated' && location.pathname.startsWith('/auth')) {
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
