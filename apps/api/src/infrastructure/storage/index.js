'use strict';

const { config } = require('../../config/env');

/**
 * Storage provider factory.
 * Returns the active storage provider based on STORAGE_PROVIDER config.
 *
 * Provider interface:
 *   upload({ key, body, contentType })  → Promise<{ key, [bucket] }>
 *   remove(key)                          → Promise<void>
 *   getPresignedUrl(key, expiresIn?)     → Promise<string>
 */
function getStorageProvider() {
  switch (config.STORAGE_PROVIDER) {
    case 'minio':
      return require('./minioProvider');
    case 'local':
      return require('./localProvider');
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: "${config.STORAGE_PROVIDER}"`);
  }
}

module.exports = { getStorageProvider };
