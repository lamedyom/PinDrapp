import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Layer,
  Map,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
  type LineLayerSpecification,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Layers, Locate, LocateFixed, MapPin } from 'lucide-react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, isUsingDemoToken } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore, MAPBOX_STYLES } from '../../stores/directionsStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { SavedPin, ExplorePin, UserLocationDot } from './Pins';
import { PinPopup } from './PinPopup';
import { tapHaptic } from '../../lib/haptics';
import styles from './PindrappMap.module.css';

const ROUTE_LAYER: LineLayerSpecification = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#FF5C1A',
    'line-width': 6,
    'line-opacity': 0.9,
  },
};

const ROUTE_CASING: LineLayerSpecification = {
  id: 'route-casing',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#1A0A00',
    'line-width': 10,
    'line-opacity': 0.5,
  },
};

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

  const route = useDirectionsStore((s) => s.route);
  const destination = useDirectionsStore((s) => s.destination);
  const mapStyle = useDirectionsStore((s) => s.mapStyle);
  const toggleMapStyle = useDirectionsStore((s) => s.toggleMapStyle);

  const geo = useGeolocation({ watch: true });

  // Live-update user location dot.
  useEffect(() => {
    if (!geo.coords) return;
    setUserLocation({ lat: geo.coords.latitude, lng: geo.coords.longitude });
  }, [geo.coords, setUserLocation]);

  // First-fix recenter.
  const firstFixRef = useRef(false);
  useEffect(() => {
    if (!geo.coords || firstFixRef.current || !mapReady) return;
    firstFixRef.current = true;
    mapRef.current?.flyTo({
      center: [geo.coords.longitude, geo.coords.latitude],
      zoom: 14,
      duration: 1500,
    });
  }, [geo.coords, mapReady]);

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

  // Fit bounds when a new route arrives.
  useEffect(() => {
    if (!route || !mapReady) return;
    mapRef.current?.fitBounds(route.bounds, {
      padding: { top: 220, bottom: 320, left: 40, right: 40 },
      duration: 900,
    });
  }, [route, mapReady]);

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
        () => {},
      );
    }
  };

  const routeSource = useMemo(() => {
    if (!route) return null;
    return {
      type: 'geojson' as const,
      data: {
        type: 'Feature' as const,
        properties: {},
        geometry: route.geometry,
      },
    };
  }, [route]);

  return (
    <div className={styles.mapWrap}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAPBOX_STYLES[mapStyle]}
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
        onStyleData={() => setMapReady(true)}
        onClick={clearPin}
      >
        <NavigationControl position="top-right" showCompass showZoom visualizePitch />

        {routeSource && (
          <Source id="route" type="geojson" data={routeSource.data}>
            <Layer {...ROUTE_CASING} />
            <Layer {...ROUTE_LAYER} />
          </Source>
        )}

        {destination && (
          <Marker
            longitude={destination.lng}
            latitude={destination.lat}
            anchor="bottom"
            style={{ zIndex: 8 }}
          >
            <div className={styles.destMarker}>
              <MapPin size={28} fill="#FF5C1A" stroke="#fff" strokeWidth={2} />
            </div>
          </Marker>
        )}

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
        className={styles.styleBtn}
        onClick={() => {
          tapHaptic();
          toggleMapStyle();
        }}
        aria-label={`Switch to ${mapStyle === 'streets' ? 'satellite' : 'streets'} view`}
      >
        <Layers size={18} />
        <span className={styles.styleBtnLabel}>
          {mapStyle === 'streets' ? 'Satellite' : 'Streets'}
        </span>
      </button>

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
