'use strict';

const { HttpStatus } = require('@vrumm/contracts');

/**
 * Send a standardised success response.
 *
 * @param {import('express').Response} res
 * @param {*}      data       - Response payload
 * @param {Object} [meta]     - Optional metadata (pagination, etc.)
 * @param {number} [statusCode] - HTTP status code (default 200)
 */
function success(res, data, meta = undefined, statusCode = HttpStatus.OK) {
  const body = { success: true, data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  if (res.req && res.req.id) {
    body.requestId = res.req.id;
  }
  return res.status(statusCode).json(body);
}

/**
 * Send a standardised success response for a newly created resource (201).
 *
 * @param {import('express').Response} res
 * @param {*} data
 */
function created(res, data) {
  return success(res, data, undefined, HttpStatus.CREATED);
}

/**
 * Send a standardised paginated success response.
 *
 * @param {import('express').Response} res
 * @param {Array}  data
 * @param {Object} pagination
 * @param {number} pagination.page
 * @param {number} pagination.limit
 * @param {number} pagination.total
 */
function paginated(res, data, { page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  const meta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
  return success(res, data, meta);
}

module.exports = { success, created, paginated };
