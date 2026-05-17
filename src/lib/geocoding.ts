import { MAPBOX_TOKEN } from './mapbox';

export interface GeocodingResult {
  id: string;
  /** Short name, e.g. "Empire State Building" */
  name: string;
  /** Full place string, e.g. "350 5th Ave, New York, NY 10118, USA" */
  placeName: string;
  /** Mapbox place types: poi, address, place, neighborhood, etc. */
  types: string[];
  lat: number;
  lng: number;
  /** Best-guess emoji for the place category. */
  emoji: string;
}

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  place_type: string[];
  center: [number, number];
  properties?: { category?: string };
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

const EMOJI_BY_CATEGORY: Record<string, string> = {
  food: '🍽️',
  restaurant: '🍽️',
  cafe: '☕',
  coffee: '☕',
  bar: '🍷',
  bakery: '🥐',
  pizza: '🍕',
  fastfood: '🍔',
  hotel: '🏨',
  lodging: '🏨',
  shopping: '🛍️',
  shop: '🛍️',
  market: '🛒',
  grocery: '🛒',
  gym: '🏋️',
  park: '🌳',
  museum: '🏛️',
  school: '🏫',
  hospital: '🏥',
  bank: '🏦',
  gas: '⛽',
  pharmacy: '💊',
};

function emojiFor(feature: MapboxFeature): string {
  const cat = (feature.properties?.category ?? '').toLowerCase();
  for (const key of Object.keys(EMOJI_BY_CATEGORY)) {
    if (cat.includes(key)) return EMOJI_BY_CATEGORY[key];
  }
  if (feature.place_type.includes('poi')) return '📍';
  if (feature.place_type.includes('address')) return '🏠';
  if (feature.place_type.includes('place')) return '🏙️';
  if (feature.place_type.includes('neighborhood')) return '🏘️';
  if (feature.place_type.includes('region')) return '🗺️';
  return '📍';
}

export async function geocodePlaces(
  query: string,
  proximity?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    limit: '6',
    types: 'address,poi,place,neighborhood',
  });
  if (proximity) {
    params.set('proximity', `${proximity.lng},${proximity.lat}`);
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    trimmed,
  )}.json?${params}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding API ${res.status}`);
  const data = (await res.json()) as MapboxGeocodingResponse;

  return data.features.map((f) => ({
    id: f.id,
    name: f.text,
    placeName: f.place_name,
    types: f.place_type,
    lat: f.center[1],
    lng: f.center[0],
    emoji: emojiFor(f),
  }));
}
