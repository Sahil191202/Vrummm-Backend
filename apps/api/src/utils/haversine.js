'use strict';

/**
 * Haversine distance formula.
 * Calculates the great-circle distance between two points on Earth.
 *
 * @param {[number, number]} coord1 - [longitude, latitude] in decimal degrees
 * @param {[number, number]} coord2 - [longitude, latitude] in decimal degrees
 * @returns {number} Distance in metres (float)
 */
function haversineMetres(coord1, coord2) {
  const EARTH_RADIUS_M = 6371000;

  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Convert decimal degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

module.exports = { haversineMetres };
