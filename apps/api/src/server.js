'use strict';

// Load env vars first — must happen before any other import reads process.env
require('dotenv').config();

const { config } = require('./config/env');
const { logger } = require('./infrastructure/logger');
const { connectDB, disconnectDB } = require('./infrastructure/db');
const { app } = require('./app');

let server;

async function start() {
  // Connect to MongoDB
  await connectDB();

  // Start HTTP server
  server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'HTTP server listening');
  });

  server.on('error', (err) => {
    logger.fatal({ err }, 'HTTP server error');
    process.exit(1);
  });
}

/**
 * Graceful shutdown handler.
 * Stops accepting new connections, then closes DB.
 */
async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — shutting down gracefully');

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
    logger.info('HTTP server closed');
  }

  await disconnectDB();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
