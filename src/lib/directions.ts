import { MAPBOX_TOKEN } from './mapbox';

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
}

export interface RouteResult {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  bounds: [[number, number], [number, number]];
}

interface MapboxStep {
  maneuver: { instruction: string; type: string };
  distance: number;
  duration: number;
}

interface MapboxLeg {
  steps: MapboxStep[];
}

interface MapboxRoute {
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
  legs: MapboxLeg[];
}

interface MapboxDirectionsResponse {
  routes: MapboxRoute[];
  code: string;
  message?: string;
}

export async function fetchRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
    `?geometries=geojson&steps=true&overview=full&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Directions API ${res.status}`);
  }
  const data = (await res.json()) as MapboxDirectionsResponse;
  if (data.code !== 'Ok' || data.routes.length === 0) {
    throw new Error(data.message ?? 'No route found');
  }
  const route = data.routes[0];

  const coordsArr = route.geometry.coordinates;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coordsArr) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps: route.legs.flatMap((leg) =>
      leg.steps.map((s) => ({
        instruction: s.maneuver.instruction,
        distanceMeters: s.distance,
        durationSeconds: s.duration,
        maneuverType: s.maneuver.type,
      })),
    ),
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const miles = km * 0.621371;
  return miles < 0.1 ? `${(km).toFixed(2)} km` : `${miles.toFixed(1)} mi`;
}

export function formatDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}
