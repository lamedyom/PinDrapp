import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { RouteResult, TravelMode } from '../lib/directions';

export type MapStyleKey = 'streets' | 'satellite';

export interface DirectionsDestination {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
}

interface DirectionsState {
  destination: DirectionsDestination | null;
  mode: TravelMode;
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  mapStyle: MapStyleKey;

  setDestination: (dest: DirectionsDestination | null) => void;
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
        }
      }),
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
