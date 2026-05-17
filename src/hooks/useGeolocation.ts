import { useEffect, useState } from 'react';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
}

export interface GeoState {
  coords: GeoCoords | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  /** Continuously watch position (default true). Set false for one-shot lookup. */
  watch?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}): GeoState {
  const { watch = true } = options;
  const [state, setState] = useState<GeoState>({
    coords: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coords: null, error: 'Geolocation unsupported', loading: false });
      return;
    }

    const onSuccess: PositionCallback = (pos) => {
      setState({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        error: null,
        loading: false,
      });
    };
    const onError: PositionErrorCallback = (err) => {
      setState((prev) => ({ ...prev, error: err.message, loading: false }));
    };
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: watch ? 2000 : 60000,
    };

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, opts);
      return () => navigator.geolocation.clearWatch(id);
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
  }, [watch]);

  return state;
}
