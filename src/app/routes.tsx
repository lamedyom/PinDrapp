import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '../components/layout/AppShell';
import { FeedScreen } from '../features/feed/FeedScreen';
import { MapScreen } from '../features/map/MapScreen';
import { DealsScreen } from '../features/deals/DealsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { BusinessProfileScreen } from '../features/profile/BusinessProfileScreen';
import { PostScreen } from '../features/post/PostScreen';
import { SplashScreen } from '../features/auth/SplashScreen';
import { PhoneAuth } from '../features/auth/PhoneAuth';
import { EmailAuth } from '../features/auth/EmailAuth';
import { AuthCallback } from '../features/auth/AuthCallback';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2, ease: 'easeOut' as const };

function PageWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      variants={pageVariants}
      transition={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Per-screen boundary — one crashing page can't blank the whole app. */}
      <ErrorBoundary label={label}>{children}</ErrorBoundary>
    </motion.div>
  );
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Auth flow — public routes, no shell */}
        <Route path="/auth/splash" element={<SplashScreen />} />
        <Route path="/auth/phone" element={<PhoneAuth />} />
        <Route path="/auth/email" element={<EmailAuth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/*
         * /onboarding is a URL-visible placeholder for users who have just
         * signed up but haven't completed setup. AuthGate detects this and
         * overlays UserTypeScreen / BusinessOnboarding / ConsumerOnboarding
         * — so the rendered content here doesn't matter (it's covered).
         */}
        <Route path="/onboarding" element={<div style={{ background: 'var(--bg-page)', minHeight: '100vh' }} />} />

        {/* Main app — wrapped in shell */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route element={<AppShell />}>
          <Route
            path="/feed"
            element={
              <PageWrap label="Feed">
                <FeedScreen />
              </PageWrap>
            }
          />
          <Route
            path="/map"
            element={
              <PageWrap label="Map">
                <MapScreen />
              </PageWrap>
            }
          />
          <Route
            path="/deals"
            element={
              <PageWrap label="Deals">
                <DealsScreen />
              </PageWrap>
            }
          />
          <Route
            path="/profile"
            element={
              <PageWrap label="Profile">
                <ProfileScreen />
              </PageWrap>
            }
          />
          <Route
            path="/profile/:businessId"
            element={
              <PageWrap label="Business profile">
                <BusinessProfileScreen />
              </PageWrap>
            }
          />
        </Route>
        <Route
          path="/post"
          element={
            <ErrorBoundary label="Post">
              <PostScreen />
            </ErrorBoundary>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
