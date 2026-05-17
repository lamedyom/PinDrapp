import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Locate, LocateFixed } from 'lucide-react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, isUsingDemoToken } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { SavedPin, ExplorePin, UserLocationDot } from './Pins';
import { PinPopup } from './PinPopup';
import { tapHaptic } from '../../lib/haptics';
import styles from './PindrappMap.module.css';

export function PindrappMap() {
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const explorePlaces = useMapStore((s) => s.explorePlaces);
  const activeTab = useMapStore((s) => s.activeTab);
  const selectPin = useMapStore((s) => s.selectPin);
  const flyTarget = useMapStore((s) => s.flyTarget);
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const userLocation = useMapStore((s) => s.userLocation);
  const activePopupId = useMapStore((s) => s.activePopupId);
  const clearPin = useMapStore((s) => s.clearPin);
  const geo = useGeolocation();

  // Fly to user location on first GPS fix.
  useEffect(() => {
    if (!geo.coords) return;
    setUserLocation({ lat: geo.coords.latitude, lng: geo.coords.longitude });
    if (mapReady) {
      mapRef.current?.flyTo({
        center: [geo.coords.longitude, geo.coords.latitude],
        zoom: 14,
        duration: 1500,
      });
    }
  }, [geo.coords, setUserLocation, mapReady]);

  // Fly to selected pin / search result.
  useEffect(() => {
    if (!flyTarget || !mapReady) return;
    mapRef.current?.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom ?? 15,
      duration: 1200,
      essential: true,
    });
  }, [flyTarget, mapReady]);

  const onMarkerClick = useCallback(
    (id: string) => (e: { originalEvent: { stopPropagation: () => void } }) => {
      e.originalEvent.stopPropagation();
      tapHaptic();
      selectPin(id);
    },
    [selectPin],
  );

  const handleFindMe = () => {
    tapHaptic();
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
        duration: 1200,
        essential: true,
      });
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          mapRef.current?.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 15,
            duration: 1200,
          });
        },
        () => {
          // ignore — denied
        },
      );
    }
  };

  return (
    <div className={styles.mapWrap}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{
          longitude: DEFAULT_CENTER.longitude,
          latitude: DEFAULT_CENTER.latitude,
          zoom: DEFAULT_ZOOM,
          pitch: 0,
          bearing: 0,
        }}
        attributionControl={false}
        cooperativeGestures={false}
        dragRotate
        pitchWithRotate
        touchPitch
        touchZoomRotate
        doubleClickZoom
        scrollZoom
        boxZoom={false}
        keyboard
        maxPitch={75}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
        onLoad={() => setMapReady(true)}
        onClick={clearPin}
      >
        <NavigationControl
          position="top-right"
          showCompass
          showZoom
          visualizePitch
        />

        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
            style={{ zIndex: 5 }}
          >
            <UserLocationDot />
          </Marker>
        )}

        {activeTab === 'myPlaces' &&
          savedPlaces.map((place) => (
            <Marker
              key={place.id}
              longitude={place.lng}
              latitude={place.lat}
              anchor="bottom"
              onClick={onMarkerClick(place.id)}
            >
              <SavedPin place={place} onClick={() => selectPin(place.id)} />
            </Marker>
          ))}

        {activeTab === 'explore' &&
          explorePlaces.map((place) => (
            <Marker
              key={place.id}
              longitude={place.lng}
              latitude={place.lat}
              anchor="center"
              onClick={onMarkerClick(place.id)}
            >
              <ExplorePin place={place} onClick={() => selectPin(place.id)} />
            </Marker>
          ))}
      </Map>

      <button
        type="button"
        className={styles.findMeBtn}
        onClick={handleFindMe}
        aria-label="Find my location"
      >
        {userLocation ? <LocateFixed size={20} /> : <Locate size={20} />}
      </button>

      {isUsingDemoToken() && (
        <div className={styles.demoHint}>
          Demo Mapbox token — set <code>VITE_MAPBOX_TOKEN</code> for production
        </div>
      )}

      {activePopupId && (
        <div className={styles.popupHost}>
          <PinPopup id={activePopupId} />
        </div>
      )}
    </div>
  );
}
