import { MapSearchBar } from './MapSearchBar';
import { PindrappMap } from './PindrappMap';
import { MapBottomSheet } from './MapBottomSheet';
import { DirectionsPanel } from './DirectionsPanel';
import { useDirectionsStore } from '../../stores/directionsStore';
import styles from './MapScreen.module.css';

export function MapScreen() {
  const hasDestination = useDirectionsStore((s) => s.destination !== null);
  return (
    <div className={styles.screen}>
      {!hasDestination && <MapSearchBar />}
      <PindrappMap />
      <DirectionsPanel />
      <MapBottomSheet />
    </div>
  );
}
