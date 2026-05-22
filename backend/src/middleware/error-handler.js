'use strict';

// ============================================================================
// Centralized error handling.
// notFoundHandler catches unmatched routes. errorHandler is the terminal
// Express error middleware: it renders AppError instances with their status
// and code, and treats anything else as an opaque 500 so internal detail is
// never leaked to a client.
// ============================================================================

const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

// Mounted after all routes; converts a missed route into a 404 AppError.
function notFoundHandler(req, res, next) {
  next(new AppError(404, 'not_found', 'The requested resource was not found.'));
}

// Terminal error middleware. Must keep the four-argument signature so Express
// recognizes it as an error handler.
function errorHandler(err, req, res, next) {
  // Delegate to Express if the response has already started streaming.
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Operational error', { code: err.code, message: err.message });
    }
    const body = { error: { code: err.code, message: err.message } };
    if (err.details) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  // Unknown error: log the full detail server-side, return a generic message.
  logger.error('Unhandled error', {
    message: err && err.message,
    stack: err && err.stack,
  });
  return res.status(500).json({
    error: { code: 'internal_error', message: 'An unexpected error occurred.' },
  });
}

module.exports = {
  notFoundHandler: notFoundHandler,
  errorHandler: errorHandler,
};
