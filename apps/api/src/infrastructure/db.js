'use strict';

const mongoose = require('mongoose');
const { config } = require('../config/env');
const { logger } = require('./logger');

/**
 * Connect to MongoDB.
 * - Uses the URI from config (should include replicaSet query param for transactions).
 * - Disables mongoose's internal command buffering so ops fail fast if DB is down.
 * - Registers lifecycle event handlers for logging.
 */
async function connectDB() {
  mongoose.set('bufferCommands', false);

  mongoose.connection.on('connected', () => {
    logger.info({ uri: sanitiseUri(config.MONGODB_URI) }, 'MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    // Replica set awareness is established via the URI replicaSet param
  });
}

/**
 * Gracefully close the MongoDB connection.
 */
async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

/**
 * Redact credentials from a MongoDB URI for safe logging.
 * @param {string} uri
 * @returns {string}
 */
function sanitiseUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (_err) {
    return '[unparseable URI]';
  }
}

module.exports = { connectDB, disconnectDB, mongoose };
