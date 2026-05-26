import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/globals.css';

// Dev-only: expose stores on window for debugging auth/profile states from
// the console (e.g. window.__pindrapp.auth.setState({ business: {...} })).
// Tree-shaken out of production builds.
if (import.meta.env.DEV) {
  void (async () => {
    const [{ useAuthStore }, { useUserStore }, { useFeedStore }, { useDealStore }, { useMapStore }] =
      await Promise.all([
        import('./stores/authStore'),
        import('./stores/userStore'),
        import('./stores/feedStore'),
        import('./stores/dealStore'),
        import('./stores/mapStore'),
      ]);
    (window as unknown as { __pindrapp?: unknown }).__pindrapp = {
      auth: useAuthStore,
      user: useUserStore,
      feed: useFeedStore,
      deal: useDealStore,
      map: useMapStore,
    };
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
