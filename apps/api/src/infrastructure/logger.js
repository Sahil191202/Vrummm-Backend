'use strict';

const pino = require('pino');
const { config } = require('../config/env');

const redactPaths = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.pin',
  'req.body.currentPassword',
  'req.body.newPassword',
  '*.token',
  '*.secret',
  '*.accessToken',
  '*.refreshToken',
];

/**
 * Determine transport options.
 * In development, attempt to use pino-pretty for human-readable output.
 * In production/test, output raw JSON.
 */
function buildTransport() {
  if (config.NODE_ENV === 'development') {
    try {
      require.resolve('pino-pretty');
      return {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      };
    } catch (_err) {
      // pino-pretty not installed — fall through to JSON
    }
  }
  return undefined;
}

const transport = buildTransport();

const logger = pino(
  {
    level: config.LOG_LEVEL,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    base: {
      env: config.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport ? pino.transport(transport) : undefined
);

module.exports = { logger };
