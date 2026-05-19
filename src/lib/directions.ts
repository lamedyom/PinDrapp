import { MAPBOX_TOKEN } from './mapbox';

export type TravelMode = 'driving' | 'driving-traffic' | 'walking' | 'cycling';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  /** [lng, lat] of where the maneuver happens. Used by nav-mode camera. */
  maneuverLocation?: [number, number];
}

export interface RouteResult {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  bounds: [[number, number], [number, number]];
}

interface MapboxStep {
  maneuver: {
    instruction: string;
    type: string;
    modifier?: string;
    location?: [number, number];
  };
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

export class DirectionsError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'DirectionsError';
    this.code = code;
    this.status = status;
  }
}

/** True when the error means "no route exists between these points for this profile". */
export function isNoRoute(err: unknown): boolean {
  if (!(err instanceof DirectionsError)) return false;
  return (
    err.code === 'NoRoute' ||
    err.code === 'NoSegment' ||
    err.code === 'InvalidInput' ||
    err.status === 422
  );
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
  // Try to read the response body even on non-2xx — Mapbox returns a JSON
  // error envelope with { code, message } that's much more useful than the
  // HTTP status alone (e.g. NoRoute / NoSegment / InvalidInput).
  let data: MapboxDirectionsResponse | null = null;
  try {
    data = (await res.json()) as MapboxDirectionsResponse;
  } catch {
    // body wasn't JSON
  }

  if (!res.ok || !data) {
    const code = data?.code ?? `HTTP${res.status}`;
    const msg = data?.message ?? `Directions API ${res.status}`;
    throw new DirectionsError(msg, code, res.status);
  }
  if (data.code !== 'Ok' || data.routes.length === 0) {
    throw new DirectionsError(
      data.message ?? `No route (${data.code})`,
      data.code,
      res.status,
    );
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
        maneuverModifier: s.maneuver.modifier,
        maneuverLocation: s.maneuver.location,
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

export function remainingFromStep(
  route: RouteResult,
  fromStepIndex: number,
): { distanceMeters: number; durationSeconds: number } {
  const start = Math.max(0, Math.min(route.steps.length - 1, fromStepIndex));
  const rest = route.steps.slice(start);
  return {
    distanceMeters: rest.reduce((a, s) => a + s.distanceMeters, 0),
    durationSeconds: rest.reduce((a, s) => a + s.durationSeconds, 0),
  };
}

export function etaTime(durationSeconds: number, now: Date = new Date()): string {
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}
