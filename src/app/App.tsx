import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { AnimatePresence, motion } from 'framer-motion';
import { AppRoutes } from './routes';
import { AuthGate } from './AuthGate';
import { stripePromise } from '../lib/stripe';
import { BrandMark } from '../components/layout/BrandMark';
import { Toast } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

function LoadingGate() {
  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <BrandMark size={56} />
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [fontsReady, setFontsReady] = useState<boolean>(() => {
    if (typeof document === 'undefined' || !document.fonts) return true;
    return document.fonts.status === 'loaded';
  });

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    document.fonts.ready.then(() => setFontsReady(true));
    const fallback = window.setTimeout(() => setFontsReady(true), 2000);
    return () => window.clearTimeout(fallback);
  }, []);

  const inner = (
    <BrowserRouter>
      {/* App-level boundary catches crashes in AuthGate / AppShell — above
       * the per-route boundaries — so nothing can produce a black screen. */}
      <ErrorBoundary label="Pindrapp">
        <AuthGate>
          <AppRoutes />
        </AuthGate>
      </ErrorBoundary>
      <Toast />
    </BrowserRouter>
  );

  return (
    <>
      <AnimatePresence>{!fontsReady && <LoadingGate />}</AnimatePresence>
      <Elements stripe={stripePromise}>{inner}</Elements>
    </>
  );
}
