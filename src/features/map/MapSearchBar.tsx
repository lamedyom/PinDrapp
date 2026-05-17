import { useEffect, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import MapboxGeocoder, { type Result } from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { MAPBOX_TOKEN } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import styles from './MapSearchBar.module.css';

export function MapSearchBar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const flyToCoords = useMapStore((s) => s.flyToCoords);
  const userLocation = useMapStore((s) => s.userLocation);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous geocoder DOM (defensive against StrictMode double-mount)
    container.innerHTML = '';

    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      types: 'address,poi',
      placeholder: 'Search businesses, places...',
      marker: false,
      proximity: userLocation
        ? { longitude: userLocation.lng, latitude: userLocation.lat }
        : { longitude: -73.9857, latitude: 40.7484 },
    });
    geocoder.addTo(container);

    const onResult = (ev: { result: Result }) => {
      const [lng, lat] = ev.result.center;
      flyToCoords(lat, lng, 15);
      setSearchQuery('');
    };
    const onChange = (e: Event) => {
      setSearchQuery((e.target as HTMLInputElement).value);
    };

    geocoder.on('result', onResult);
    const input = container.querySelector('input');
    input?.addEventListener('input', onChange);

    return () => {
      geocoder.off('result', onResult);
      input?.removeEventListener('input', onChange);
      // Tear down the geocoder's DOM entirely so StrictMode re-mount doesn't stack.
      container.innerHTML = '';
    };
  }, [flyToCoords, setSearchQuery, userLocation]);

  return (
    <div className={`${styles.wrap} ${styles.geocoderWrap}`}>
      <div ref={containerRef} className={styles.geocoderContainer} />
      <SlidersHorizontal size={16} className={styles.rightIcon} />
    </div>
  );
}
