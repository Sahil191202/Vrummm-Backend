'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../utils/asyncHandler');
const { success } = require('../../utils/respond');

const router = express.Router();

/**
 * GET /api/v1/health
 *
 * Public health check endpoint.
 * Returns server status, uptime, and DB connectivity.
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const dbState = mongoose.connection.readyState;
    // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

    return success(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      env: process.env.NODE_ENV || 'development',
      db: dbStatus,
    });
  })
);

module.exports = { healthRouter: router };
