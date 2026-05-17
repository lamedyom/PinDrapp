export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const hasMapboxToken = (): boolean =>
  !!MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith('your_');

export const DEFAULT_CENTER = { longitude: -73.9857, latitude: 40.7484 };
export const DEFAULT_ZOOM = 13;
