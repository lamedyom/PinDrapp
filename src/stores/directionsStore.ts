import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { RouteResult, TravelMode } from '../lib/directions';
import { useMapStore } from './mapStore';

export type MapStyleKey = 'streets' | 'satellite';

export interface DirectionsPoint {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
}

interface DirectionsState {
  /** Where the user wants to go. */
  destination: DirectionsPoint | null;
  /**
   * Where to start the route from. `null` means "use my current GPS location"
   * (the panel resolves this from useMapStore.userLocation at fetch time).
   */
  origin: DirectionsPoint | null;
  mode: TravelMode;
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  mapStyle: MapStyleKey;
  /** True after the user taps "Start" — panel switches into nav mode. */
  isNavigating: boolean;
  /** Index of the active turn step while navigating. */
  currentStepIndex: number;

  setDestination: (dest: DirectionsPoint | null) => void;
  setOrigin: (origin: DirectionsPoint | null) => void;
  swapEndpoints: () => void;
  setMode: (mode: TravelMode) => void;
  setRoute: (route: RouteResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  clearRoute: () => void;
  toggleMapStyle: () => void;
  setMapStyle: (style: MapStyleKey) => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  setCurrentStep: (index: number) => void;
  advanceStep: () => void;
}

export const useDirectionsStore = create<DirectionsState>()(
  immer((set) => ({
    destination: null,
    origin: null,
    mode: 'walking',
    route: null,
    loading: false,
    error: null,
    mapStyle: 'streets',
    isNavigating: false,
    currentStepIndex: 0,

    setDestination: (dest) =>
      set((s) => {
        s.destination = dest;
        // Any change in destination starts fresh — exit nav mode.
        s.isNavigating = false;
        s.currentStepIndex = 0;
        if (!dest) {
          s.route = null;
          s.loading = false;
          s.error = null;
          s.origin = null;
        }
      }),
    setOrigin: (origin) =>
      set((s) => {
        s.origin = origin;
      }),
    swapEndpoints: () => {
      // Snapshot current value of GPS so "My location" stays as a fixed point
      // after the swap (otherwise it would drift while you walk).
      const userLoc = useMapStore.getState().userLocation;
      set((s) => {
        const o = s.origin;
        const d = s.destination;
        if (!d) return;
        // The current origin in concrete form (resolve GPS to coords if needed).
        const resolvedOrigin: DirectionsPoint =
          o ??
          (userLoc
            ? {
                id: 'my-location',
                name: 'My location',
                emoji: '📍',
                lat: userLoc.lat,
                lng: userLoc.lng,
              }
            : {
                id: 'origin-fallback',
                name: 'Hollywood',
                emoji: '📍',
                lat: 26.0118,
                lng: -80.1495,
              });
        s.origin = { id: d.id, name: d.name, emoji: d.emoji, lat: d.lat, lng: d.lng };
        s.destination = resolvedOrigin;
        s.route = null;
        s.isNavigating = false;
        s.currentStepIndex = 0;
      });
    },
    setMode: (mode) =>
      set((s) => {
        s.mode = mode;
      }),
    setRoute: (route) =>
      set((s) => {
        s.route = route;
        // A fresh route always starts at step 0; exit nav if it was running
        // since the underlying steps may have changed (mode switch, etc).
        s.currentStepIndex = 0;
        if (!route) s.isNavigating = false;
      }),
    setLoading: (loading) =>
      set((s) => {
        s.loading = loading;
      }),
    setError: (msg) =>
      set((s) => {
        s.error = msg;
      }),
    clearRoute: () =>
      set((s) => {
        s.destination = null;
        s.origin = null;
        s.route = null;
        s.loading = false;
        s.error = null;
        s.isNavigating = false;
        s.currentStepIndex = 0;
      }),
    toggleMapStyle: () =>
      set((s) => {
        s.mapStyle = s.mapStyle === 'streets' ? 'satellite' : 'streets';
      }),
    setMapStyle: (style) =>
      set((s) => {
        s.mapStyle = style;
      }),

    startNavigation: () =>
      set((s) => {
        if (!s.route) return;
        s.isNavigating = true;
        s.currentStepIndex = 0;
      }),
    stopNavigation: () =>
      set((s) => {
        s.isNavigating = false;
        s.currentStepIndex = 0;
      }),
    setCurrentStep: (index) =>
      set((s) => {
        const max = (s.route?.steps.length ?? 1) - 1;
        s.currentStepIndex = Math.max(0, Math.min(max, index));
      }),
    advanceStep: () =>
      set((s) => {
        if (!s.route) return;
        const max = s.route.steps.length - 1;
        if (s.currentStepIndex < max) s.currentStepIndex += 1;
      }),
  })),
);

export const MAPBOX_STYLES: Record<MapStyleKey, string> = {
  streets: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

// Kept for back-compat with one PinPopup import.
export type DirectionsDestination = DirectionsPoint;
