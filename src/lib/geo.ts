/**
 * Initial bearing (compass heading 0..360) from one lat/lng to another.
 * 0 = north, 90 = east, 180 = south, 270 = west.
 */
export function bearingTo(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Crow-flies distance between two coords in metres (Haversine).
 */
export function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371000; // earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δφ = toRad(to.lat - from.lat);
  const Δλ = toRad(to.lng - from.lng);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
