import { MapSearchBar } from './MapSearchBar';
import { PindrappMap } from './PindrappMap';
import { MapBottomSheet } from './MapBottomSheet';
import styles from './MapScreen.module.css';

export function MapScreen() {
  return (
    <div className={styles.screen}>
      <MapSearchBar />
      <PindrappMap />
      <MapBottomSheet />
    </div>
  );
}
