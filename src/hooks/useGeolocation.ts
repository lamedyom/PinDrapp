import { useEffect, useState } from 'react';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeoState {
  coords: GeoCoords | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation(): GeoState {
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState({ coords: null, error: err.message, loading: false });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return state;
}
