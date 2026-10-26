'use strict';

const mongoose = require('mongoose');
const { success } = require('../../utils/respond');

/**
 * Health controller.
 * Kept separate from the router for testability.
 */

/**
 * GET /api/v1/health
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getHealth(req, res) {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    db: dbStatus,
  });
}

module.exports = { getHealth };
