'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('../../config/env');
const { logger } = require('../logger');
const { PRESIGNED_URL_EXPIRY_SECONDS } = require('../../config/constants');

/**
 * MinIO storage provider using the AWS S3-compatible API.
 */

let _client = null;

/**
 * Lazily initialise the S3 client.
 * @returns {S3Client}
 */
function getClient() {
  if (!_client) {
    const protocol = config.MINIO_USE_SSL ? 'https' : 'http';
    _client = new S3Client({
      endpoint: `${protocol}://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`,
      region: 'us-east-1', // Required by AWS SDK; MinIO ignores it
      credentials: {
        accessKeyId: config.MINIO_ACCESS_KEY,
        secretAccessKey: config.MINIO_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return _client;
}

/**
 * Upload a file to MinIO.
 * @param {Object} options
 * @param {string}          options.key         - Object key (path within bucket)
 * @param {Buffer|string}   options.body        - File content
 * @param {string}          [options.contentType] - MIME type
 * @returns {Promise<{ key: string, bucket: string }>}
 */
async function upload({ key, body, contentType }) {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: config.MINIO_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  });

  await client.send(command);
  logger.debug({ key, bucket: config.MINIO_BUCKET }, 'MinioProvider: file uploaded');
  return { key, bucket: config.MINIO_BUCKET };
}

/**
 * Delete an object from MinIO.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function remove(key) {
  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: config.MINIO_BUCKET,
    Key: key,
  });
  await client.send(command);
  logger.debug({ key, bucket: config.MINIO_BUCKET }, 'MinioProvider: file deleted');
}

/**
 * Generate a presigned GET URL for an object.
 * @param {string} key
 * @param {number} [expiresIn] - Expiry in seconds (default from constants)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresIn = PRESIGNED_URL_EXPIRY_SECONDS) {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: config.MINIO_BUCKET,
    Key: key,
  });
  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

module.exports = { upload, remove, getPresignedUrl };
