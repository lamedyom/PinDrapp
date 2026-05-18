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

    setDestination: (dest) =>
      set((s) => {
        s.destination = dest;
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
      });
    },
    setMode: (mode) =>
      set((s) => {
        s.mode = mode;
      }),
    setRoute: (route) =>
      set((s) => {
        s.route = route;
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
      }),
    toggleMapStyle: () =>
      set((s) => {
        s.mapStyle = s.mapStyle === 'streets' ? 'satellite' : 'streets';
      }),
    setMapStyle: (style) =>
      set((s) => {
        s.mapStyle = style;
      }),
  })),
);

export const MAPBOX_STYLES: Record<MapStyleKey, string> = {
  streets: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

// Kept for back-compat with one PinPopup import.
export type DirectionsDestination = DirectionsPoint;
