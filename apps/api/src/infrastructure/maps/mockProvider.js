'use strict';

/**
 * Mock maps provider.
 *
 * Returns deterministic fake distances and durations based on the
 * haversine distance between coordinate pairs, with a Mumbai-calibrated
 * average speed multiplier.
 *
 * This is used in development/test so no real Google Maps API key is needed.
 */

const { haversineMetres } = require('../../utils/haversine');

/** Assumed average speed in Mumbai traffic (km/h) → metres per second */
const AVG_SPEED_MPS = (20 * 1000) / 3600; // 20 km/h ≈ 5.56 m/s

/** Minimum realistic duration in seconds (even for very short distances) */
const MIN_DURATION_SECONDS = 60;

/**
 * Get the distance and estimated travel duration between two coordinate pairs.
 *
 * @param {[number, number]} origin      - [longitude, latitude]
 * @param {[number, number]} destination - [longitude, latitude]
 * @returns {Promise<{ distanceMetres: number, durationSeconds: number }>}
 */
async function getDistanceAndDuration(origin, destination) {
  const distanceMetres = haversineMetres(origin, destination);
  const rawDuration = distanceMetres / AVG_SPEED_MPS;
  const durationSeconds = Math.max(Math.round(rawDuration), MIN_DURATION_SECONDS);
  return { distanceMetres: Math.round(distanceMetres), durationSeconds };
}

/**
 * Geocode an address string to coordinates.
 * Mock implementation returns a fixed central-Mumbai coordinate.
 *
 * @param {string} _address
 * @returns {Promise<{ longitude: number, latitude: number, formattedAddress: string }>}
 */
async function geocode(_address) {
  return {
    longitude: 72.8777,
    latitude: 19.076,
    formattedAddress: 'Mock Address, Mumbai, Maharashtra, India',
  };
}

/**
 * Reverse-geocode coordinates to an address string.
 * Mock implementation returns a fixed label.
 *
 * @param {[number, number]} _coordinates - [longitude, latitude]
 * @returns {Promise<{ formattedAddress: string }>}
 */
async function reverseGeocode(_coordinates) {
  return { formattedAddress: 'Mock Address, Mumbai, Maharashtra, India' };
}

module.exports = { getDistanceAndDuration, geocode, reverseGeocode };
