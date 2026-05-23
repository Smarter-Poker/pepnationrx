'use strict';

// ============================================================================
// Express application bootstrap.
// Mounts security middleware, the rate limiter, the API router, and the
// centralized error handlers; verifies the database connection; then starts
// the HTTP listener. Graceful shutdown drains the pool on SIGINT/SIGTERM.
// ============================================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const logger = require('./utils/logger');
const apiRoutes = require('./routes');
const { generalLimiter } = require('./middleware/rate-limit');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const { verifyConnection, closePool } = require('./db/pool');

const app = express();

// Behind the AWS Application Load Balancer; trust the first proxy hop so
// req.ip reflects the real client address used for rate limiting and audit.
app.set('trust proxy', 1);

// Security headers.
app.use(helmet());

// CORS: only the configured browser origins may call the API with credentials.
app.use(
  cors({
    origin: function originCheck(origin, callback) {
      // Non-browser clients (no Origin header, e.g. server-to-server) pass.
      if (!origin) {
        return callback(null, true);
      }
      // With no allowlist configured, permit any browser origin in
      // development for convenience, but fail closed in production so a
      // missing CORS_ORIGINS env var cannot silently open the API. A
      // disallowed origin resolves with `false` (no CORS headers, so the
      // browser blocks the response) rather than throwing - throwing turns
      // an ordinary cross-origin rejection into a logged 500.
      if (config.corsOrigins.length === 0) {
        return config.isProduction
          ? callback(null, false)
          : callback(null, true);
      }
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Body and cookie parsing. The JSON ceiling blocks oversized payloads. The
// verify hook keeps the raw request buffer on req.rawBody so webhook handlers
// can check an HMAC signature over the exact bytes that were received.
app.use(
  express.json({
    limit: '100kb',
    verify: function captureRawBody(req, res, buf) {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());

// Per-IP rate limiting across the whole API.
app.use(generalLimiter);

// Feature routes.
app.use('/api', apiRoutes);

// 404 for anything unmatched, then the terminal error handler.
app.use(notFoundHandler);
app.use(errorHandler);

let server = null;

// Verify the database, then begin accepting connections.
async function start() {
  try {
    await verifyConnection();
  } catch (err) {
    logger.error('Database connection failed at startup', { message: err.message });
    process.exit(1);
  }

  server = app.listen(config.port, () => {
    logger.info('PepNationRX API listening', {
      port: config.port,
      env: config.nodeEnv,
    });
  });
}

// Drain in-flight requests and close the pool before exiting.
async function shutdown(signal) {
  logger.info('Shutdown signal received', { signal: signal });
  // Stop accepting new connections and let in-flight requests finish before
  // the pool is drained, so no live query loses its connection mid-flight.
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    logger.info('HTTP server closed');
  }
  try {
    await closePool();
  } catch (err) {
    logger.error('Error closing database pool', { message: err.message });
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// A rejected promise that escapes a handler is a programming error; log it
// rather than letting Node terminate silently.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason && reason.message ? reason.message : String(reason),
  });
});

// Only start a listener when run directly; tests can require the app.
if (require.main === module) {
  start();
}

module.exports = app;
