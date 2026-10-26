'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../../infrastructure/logger');

/**
 * Local filesystem storage provider (development only).
 * Files are stored under <cwd>/tmp/uploads/.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

/**
 * Ensure the upload directory exists.
 */
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Upload a file buffer to local filesystem.
 * @param {Object} options
 * @param {string}         options.key       - Destination key (relative path)
 * @param {Buffer|string}  options.body      - File content
 * @param {string}         [options.contentType] - MIME type (ignored locally)
 * @returns {Promise<{ key: string }>}
 */
async function upload({ key, body, contentType: _contentType }) {
  ensureDir();
  const dest = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dest, body);
  logger.debug({ key }, 'LocalProvider: file uploaded');
  return { key };
}

/**
 * Delete a file from local filesystem.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function remove(key) {
  const dest = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
    logger.debug({ key }, 'LocalProvider: file deleted');
  }
}

/**
 * Generate a pseudo presigned URL pointing to a local file.
 * In dev this is just a local path URL; real auth is not needed.
 * @param {string} key
 * @param {number} _expiresIn - Ignored for local provider
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, _expiresIn) {
  return `file://${path.join(UPLOAD_DIR, key)}`;
}

module.exports = { upload, remove, getPresignedUrl };
