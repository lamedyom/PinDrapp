import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '../components/layout/AppShell';
import { FeedScreen } from '../features/feed/FeedScreen';
import { MapScreen } from '../features/map/MapScreen';
import { DealsScreen } from '../features/deals/DealsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { PostScreen } from '../features/post/PostScreen';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2, ease: 'easeOut' as const };

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      variants={pageVariants}
      transition={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route element={<AppShell />}>
          <Route
            path="/feed"
            element={
              <PageWrap>
                <FeedScreen />
              </PageWrap>
            }
          />
          <Route
            path="/map"
            element={
              <PageWrap>
                <MapScreen />
              </PageWrap>
            }
          />
          <Route
            path="/deals"
            element={
              <PageWrap>
                <DealsScreen />
              </PageWrap>
            }
          />
          <Route
            path="/profile"
            element={
              <PageWrap>
                <ProfileScreen />
              </PageWrap>
            }
          />
        </Route>
        <Route path="/post" element={<PostScreen />} />
      </Routes>
    </AnimatePresence>
  );
}
