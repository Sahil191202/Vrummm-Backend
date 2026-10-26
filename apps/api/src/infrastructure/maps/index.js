'use strict';

const { config } = require('../../config/env');

/**
 * Maps provider factory.
 * Returns the active maps provider based on MAPS_PROVIDER config.
 *
 * Provider interface:
 *   getDistanceAndDuration(origin, destination) → Promise<{ distanceMetres, durationSeconds }>
 *   geocode(address)                             → Promise<{ longitude, latitude, formattedAddress }>
 *   reverseGeocode(coordinates)                  → Promise<{ formattedAddress }>
 */
function getMapsProvider() {
  switch (config.MAPS_PROVIDER) {
    case 'mock':
      return require('./mockProvider');
    case 'googlemaps':
      throw new Error('Google Maps provider is not yet implemented. Use MAPS_PROVIDER=mock.');
    default:
      throw new Error(`Unknown MAPS_PROVIDER: "${config.MAPS_PROVIDER}"`);
  }
}

module.exports = { getMapsProvider };
