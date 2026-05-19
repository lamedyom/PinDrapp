import { MapSearchBar } from './MapSearchBar';
import { PindrappMap } from './PindrappMap';
import { MapBottomSheet } from './MapBottomSheet';
import { DirectionsPanel } from './DirectionsPanel';
import { NavigationTopBar } from './NavigationTopBar';
import { NavigationBottomBar } from './NavigationBottomBar';
import { useDirectionsStore } from '../../stores/directionsStore';
import styles from './MapScreen.module.css';

export function MapScreen() {
  const hasDestination = useDirectionsStore((s) => s.destination !== null);
  const isNavigating = useDirectionsStore((s) => s.isNavigating);

  return (
    <div className={`${styles.screen} ${isNavigating ? styles.screenNav : ''}`}>
      {/* While navigating, the chrome is replaced by the immersive
       * top + bottom nav bars — search and the sheet stay out of the way. */}
      {!hasDestination && !isNavigating && <MapSearchBar />}

      <PindrappMap />

      {isNavigating ? (
        <>
          <NavigationTopBar />
          <NavigationBottomBar />
        </>
      ) : hasDestination ? (
        <DirectionsPanel />
      ) : (
        <MapBottomSheet />
      )}
    </div>
  );
}
