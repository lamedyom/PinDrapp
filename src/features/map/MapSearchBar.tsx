import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import MapboxGeocoder, { type Result } from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { MAPBOX_TOKEN, hasMapboxToken } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import styles from './MapSearchBar.module.css';

export function MapSearchBar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const flyToCoords = useMapStore((s) => s.flyToCoords);
  const userLocation = useMapStore((s) => s.userLocation);
  const [focused, setFocused] = useState(false);
  const geocoderRef = useRef<MapboxGeocoder | null>(null);

  useEffect(() => {
    if (!hasMapboxToken() || !containerRef.current || geocoderRef.current) return;
    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN as string,
      types: 'address,poi',
      placeholder: 'Search businesses, places...',
      marker: false,
      proximity: userLocation
        ? { longitude: userLocation.lng, latitude: userLocation.lat }
        : { longitude: -73.9857, latitude: 40.7484 },
    });
    geocoder.addTo(containerRef.current);
    const onResult = (ev: { result: Result }) => {
      const [lng, lat] = ev.result.center;
      flyToCoords(lat, lng, 15);
    };
    geocoder.on('result', onResult);
    geocoderRef.current = geocoder;
    return () => {
      geocoder.off('result', onResult);
      geocoder.clear();
      geocoderRef.current = null;
    };
  }, [flyToCoords, userLocation]);

  if (!hasMapboxToken()) {
    return (
      <div className={`${styles.wrap} ${focused ? styles.focused : ''}`}>
        <Search size={16} className={styles.leftIcon} />
        <input
          type="text"
          placeholder="Search businesses, places..."
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={styles.fallbackInput}
        />
        <SlidersHorizontal size={16} className={styles.rightIcon} />
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${styles.geocoderWrap}`}>
      <div ref={containerRef} className={styles.geocoderContainer} />
      <SlidersHorizontal size={16} className={styles.rightIcon} />
    </div>
  );
}
