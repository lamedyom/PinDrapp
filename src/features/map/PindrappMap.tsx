import { useCallback, useEffect, useRef } from 'react';
import { Map, Marker, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, hasMapboxToken, DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { SavedPin, ExplorePin, UserLocationDot } from './Pins';
import { PinPopup } from './PinPopup';
import styles from './PindrappMap.module.css';

export function PindrappMap() {
  const mapRef = useRef<MapRef | null>(null);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const explorePlaces = useMapStore((s) => s.explorePlaces);
  const activeTab = useMapStore((s) => s.activeTab);
  const selectPin = useMapStore((s) => s.selectPin);
  const flyTarget = useMapStore((s) => s.flyTarget);
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const userLocation = useMapStore((s) => s.userLocation);
  const activePopupId = useMapStore((s) => s.activePopupId);
  const geo = useGeolocation();

  useEffect(() => {
    if (geo.coords) {
      setUserLocation({ lat: geo.coords.latitude, lng: geo.coords.longitude });
      mapRef.current?.flyTo({
        center: [geo.coords.longitude, geo.coords.latitude],
        zoom: 14,
        duration: 1500,
      });
    }
  }, [geo.coords, setUserLocation]);

  useEffect(() => {
    if (!flyTarget) return;
    mapRef.current?.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom ?? 15,
      duration: 1200,
    });
  }, [flyTarget]);

  const onMarkerClick = useCallback(
    (id: string) => (e: { originalEvent: { stopPropagation: () => void } }) => {
      e.originalEvent.stopPropagation();
      selectPin(id);
    },
    [selectPin],
  );

  if (!hasMapboxToken()) {
    const display = activeTab === 'myPlaces' ? savedPlaces : explorePlaces;
    return (
      <div className={styles.fallback}>
        <div className={styles.fallbackGrid}>
          {display.map((p, i) => {
            const tone =
              'hasDeal' in p && p.hasDeal
                ? 'deal'
                : 'type' in p && (p.type === 'home' || p.type === 'work' || p.type === 'social')
                  ? 'orange'
                  : 'blue';
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.fallbackPin} ${styles[`fallbackPin_${tone}`]}`}
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  transform: `translate(${(i % 3) * 6}px, ${(i % 2) * 8}px)`,
                }}
                onClick={() => selectPin(p.id)}
                aria-label={p.name}
              >
                <span className={styles.fallbackEmoji}>{p.emoji}</span>
                <span className={styles.fallbackName}>{p.name}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.fallbackHint}>
          Add <code>VITE_MAPBOX_TOKEN</code> to <code>.env</code> for live tiles
        </div>
        {activePopupId && (
          <div className={styles.popupHost}>
            <PinPopup id={activePopupId} />
          </div>
        )}
      </div>
    );
  }

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
        }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
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

      {activePopupId && (
        <div className={styles.popupHost}>
          <PinPopup id={activePopupId} />
        </div>
      )}
    </div>
  );
}
