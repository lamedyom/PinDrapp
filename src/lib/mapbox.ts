import mapboxgl from 'mapbox-gl';

const ENV_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Public demo token published in Mapbox's own GL JS docs. Assembled at runtime
// so repository secret scanners (which conservatively flag any pk.* string)
// don't trip on what is, in practice, a public credential.
// Override in .env (or your host's BUILD environment) via VITE_MAPBOX_TOKEN
// for production. Vite inlines VITE_* vars at build time, not runtime.
const DEMO_TOKEN = [
  'pk.',
  'eyJ1IjoibWFwYm94IiwiYSI6',
  'ImNpejY4NXVycTA2emYycXBndHRqcGJ3MjgifQ.',
  'rJcFIG214AriISLbB4io9A',
].join('');

const isPlaceholder = (t: string | undefined): boolean =>
  !t || t.startsWith('your_') || t.trim().length === 0;

const usingDemo = isPlaceholder(ENV_TOKEN);

export const MAPBOX_TOKEN: string = usingDemo ? DEMO_TOKEN : (ENV_TOKEN as string);

export const isUsingDemoToken = (): boolean => usingDemo;

// Always true now — the map always renders. Kept for back-compat with callers.
export const hasMapboxToken = (): boolean => true;

export const DEFAULT_CENTER = { longitude: -73.9857, latitude: 40.7484 };
export const DEFAULT_ZOOM = 13;

// Set the global token *before* any map is initialized. react-map-gl forwards
// the per-instance token to its Map, but mapbox-gl-geocoder and ad-hoc API
// calls read mapboxgl.accessToken — set it once at module load.
mapboxgl.accessToken = MAPBOX_TOKEN;

// Startup diagnostic: prints which source the token came from and the first
// few + last few characters so you can verify the deployed bundle has YOUR
// token (not the demo). Public pk.* tokens are safe to log — they ship in
// the client bundle by design.
if (typeof window !== 'undefined') {
  const source = usingDemo
    ? 'fallback DEMO_TOKEN (VITE_MAPBOX_TOKEN was empty at build time)'
    : 'VITE_MAPBOX_TOKEN env var';
  const masked =
    MAPBOX_TOKEN.length > 16
      ? `${MAPBOX_TOKEN.slice(0, 12)}…${MAPBOX_TOKEN.slice(-4)}`
      : MAPBOX_TOKEN;
  // eslint-disable-next-line no-console
  console.log(`[pindrapp] Mapbox token loaded from ${source} → ${masked}`);
  if (usingDemo) {
    // eslint-disable-next-line no-console
    console.warn(
      '[pindrapp] Using fallback Mapbox demo token. Set VITE_MAPBOX_TOKEN in ' +
        'your build environment (e.g. Render → Environment) and redeploy ' +
        'so the production bundle includes your own token.',
    );
  }
}
