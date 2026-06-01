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
import { Layers, Locate, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, isUsingDemoToken } from '../../lib/mapbox';
import { useMapStore } from '../../stores/mapStore';
import { useDirectionsStore, MAPBOX_STYLES } from '../../stores/directionsStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { bearingTo } from '../../lib/geo';
import { SavedPin, ExplorePin, UserLocationDot } from './Pins';
import { PinPopup } from './PinPopup';
import { tapHaptic } from '../../lib/haptics';
import styles from './PindrappMap.module.css';

const NAV_PITCH = 60;
const NAV_ZOOM = 17;
const OVERVIEW_PITCH = 0;
const OVERVIEW_ZOOM = 13;

// Outer glow halo around the route — wider, low opacity, slight blur.
const ROUTE_GLOW: LineLayerSpecification = {
  id: 'route-glow',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#FF5C1A',
    'line-width': 14,
    'line-opacity': 0.25,
    'line-blur': 6,
  },
};

// Dark inner casing to make the orange pop against light tiles too.
const ROUTE_CASING: LineLayerSpecification = {
  id: 'route-casing',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#1A0A00',
    'line-width': 8,
    'line-opacity': 0.55,
  },
};

// The main orange line — 4px as specified.
const ROUTE_LAYER: LineLayerSpecification = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#FF5C1A',
    'line-width': 4,
    'line-opacity': 1,
  },
};

export function PindrappMap() {
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locBannerDismissed, setLocBannerDismissed] = useState(false);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const explorePlaces = useMapStore((s) => s.explorePlaces);
  const searchedLocation = useMapStore((s) => s.searchedLocation);
  const activeTab = useMapStore((s) => s.activeTab);
  const selectPin = useMapStore((s) => s.selectPin);
  const flyTarget = useMapStore((s) => s.flyTarget);
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const userLocation = useMapStore((s) => s.userLocation);
  const activePopupId = useMapStore((s) => s.activePopupId);
  const clearPin = useMapStore((s) => s.clearPin);

  const route = useDirectionsStore((s) => s.route);
  const destination = useDirectionsStore((s) => s.destination);
  const routeLoading = useDirectionsStore((s) => s.loading);
  const mapStyle = useDirectionsStore((s) => s.mapStyle);
  const toggleMapStyle = useDirectionsStore((s) => s.toggleMapStyle);
  const isNavigating = useDirectionsStore((s) => s.isNavigating);
  const currentStepIndex = useDirectionsStore((s) => s.currentStepIndex);

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

  // Fit bounds when a new route arrives — but only in overview mode. In
  // active navigation we keep the camera glued to the user via easeTo.
  useEffect(() => {
    if (!route || !mapReady || isNavigating) return;
    mapRef.current?.fitBounds(route.bounds, {
      padding: { top: 220, bottom: 320, left: 40, right: 40 },
      duration: 900,
    });
  }, [route, mapReady, isNavigating]);

  // Entering / exiting navigation mode — drives the pitched 3D camera.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating) {
      // Compute an initial bearing from the user toward the next maneuver
      // (or the first route polyline segment if no GPS yet) so the map
      // faces forward immediately.
      const startCoord =
        userLocation
          ? { lat: userLocation.lat, lng: userLocation.lng }
          : route?.geometry.coordinates[0]
            ? {
                lat: route.geometry.coordinates[0][1],
                lng: route.geometry.coordinates[0][0],
              }
            : null;
      const nextManeuver =
        route?.steps[currentStepIndex + 1]?.maneuverLocation ??
        (route ? route.geometry.coordinates.at(-1) : null);
      const initialBearing =
        startCoord && nextManeuver
          ? bearingTo(startCoord, { lat: nextManeuver[1], lng: nextManeuver[0] })
          : 0;
      map.easeTo({
        center: startCoord ? [startCoord.lng, startCoord.lat] : undefined,
        pitch: NAV_PITCH,
        zoom: NAV_ZOOM,
        bearing: initialBearing,
        duration: 1200,
      });
    } else {
      map.easeTo({
        pitch: OVERVIEW_PITCH,
        zoom: OVERVIEW_ZOOM,
        bearing: 0,
        duration: 900,
      });
    }
    // Only re-run when navigation flag flips. The follow-user effect below
    // handles per-GPS-tick updates while navigating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, mapReady]);

  // While navigating, follow the user — recenter and re-orient on every
  // GPS update or step advance. Uses device heading when available, else
  // bearing-from-user-to-next-maneuver.
  useEffect(() => {
    if (!isNavigating || !mapReady || !userLocation) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    let bearing = geo.coords?.heading ?? null;
    if (bearing == null || Number.isNaN(bearing)) {
      const next =
        route?.steps[currentStepIndex + 1]?.maneuverLocation ??
        (route ? route.geometry.coordinates.at(-1) : null);
      if (next) {
        bearing = bearingTo(userLocation, { lat: next[1], lng: next[0] });
      }
    }
    map.easeTo({
      center: [userLocation.lng, userLocation.lat],
      bearing: bearing ?? 0,
      pitch: NAV_PITCH,
      zoom: NAV_ZOOM,
      duration: 600,
    });
  }, [
    isNavigating,
    mapReady,
    userLocation?.lat,
    userLocation?.lng,
    currentStepIndex,
    geo.coords?.heading,
    route,
  ]);

  // Pulse the route line opacity while the directions request is in flight.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!routeLoading) {
      // Restore steady state.
      try {
        if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-opacity', 1);
        if (map.getLayer('route-glow')) map.setPaintProperty('route-glow', 'line-opacity', 0.25);
      } catch {
        // layer not yet registered — ignore
      }
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 900; // ~0.9s cycle
      const v = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      try {
        if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-opacity', v);
        if (map.getLayer('route-glow'))
          map.setPaintProperty('route-glow', 'line-opacity', 0.15 + 0.25 * v);
      } catch {
        // ignore — layer may have been removed
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [routeLoading, mapReady]);

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

  // Loading placeholder: a straight line from user to destination while
  // the real route is being fetched (route data may not be available yet).
  const loadingGeometry = useMemo<GeoJSON.LineString | null>(() => {
    if (!routeLoading || !destination || !userLocation) return null;
    return {
      type: 'LineString',
      coordinates: [
        [userLocation.lng, userLocation.lat],
        [destination.lng, destination.lat],
      ],
    };
  }, [routeLoading, destination, userLocation]);

  const renderedGeometry: GeoJSON.LineString | null = route?.geometry ?? loadingGeometry;

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
        {!isNavigating && (
          <NavigationControl position="top-right" showCompass showZoom visualizePitch />
        )}

        {renderedGeometry && (
          <Source
            id="route"
            type="geojson"
            data={{ type: 'Feature', properties: {}, geometry: renderedGeometry }}
          >
            <Layer {...ROUTE_GLOW} />
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

        {searchedLocation && !destination && (
          <Marker
            longitude={searchedLocation.lng}
            latitude={searchedLocation.lat}
            anchor="bottom"
            style={{ zIndex: 7 }}
            onClick={onMarkerClick(searchedLocation.id)}
          >
            <div className={styles.searchedMarker}>
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

      {!isNavigating && (
        <>
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

          {/* Location permission banner — shown when GPS errored (denied/
             unsupported) and we never got a fix. Disappears once GPS resolves
             or the user dismisses it. */}
          {!userLocation && geo.error && !locBannerDismissed && (
            <div className={styles.locBanner}>
              <MapPin size={16} />
              <span>Enable location to discover businesses near you</span>
              <button
                type="button"
                className={styles.locBannerBtn}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                        mapRef.current?.flyTo({
                          center: [pos.coords.longitude, pos.coords.latitude],
                          zoom: 14,
                          duration: 1200,
                        });
                      },
                      () => setLocBannerDismissed(false),
                      { enableHighAccuracy: true, timeout: 8000 },
                    );
                  }
                }}
              >
                Enable
              </button>
              <button
                type="button"
                className={styles.locBannerClose}
                onClick={() => setLocBannerDismissed(true)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isUsingDemoToken() && (
            <div className={styles.demoHint}>
              <Search size={10} /> Demo Mapbox token — set{' '}
              <code>VITE_MAPBOX_TOKEN</code> for production
            </div>
          )}

          {activePopupId && (
            <div className={styles.popupHost}>
              <PinPopup id={activePopupId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
