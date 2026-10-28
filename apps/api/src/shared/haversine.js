// Straight-line distance between two GeoJSON points.
// Input: [longitude, latitude] pairs (GeoJSON order).
// Output: distance in metres.
// Used for: captain-to-pickup and captain-to-drop distance checks (Phase 5),
//           and fare distance calculation (Phase 4).
// A route-based provider can be swapped in later without changing callers.

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineMetres([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function metrestoKm(metres) {
  return metres / 1000;
}