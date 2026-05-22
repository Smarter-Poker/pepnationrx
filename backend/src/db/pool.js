'use strict';

// ============================================================================
// Shared PostgreSQL connection pool.
// A single pg.Pool is created for the process lifetime. Connection details
// come from config; a DATABASE_URL takes precedence over the discrete PG*
// fields when present.
// ============================================================================

const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../utils/logger');

function buildPoolConfig() {
  const base = {
    max: config.database.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (config.database.ssl) {
    // Managed RDS terminates TLS with a CA chain the Node process may not
    // bundle; rejectUnauthorized is left enabled and the CA is supplied by
    // the deployment environment when required.
    base.ssl = { rejectUnauthorized: true };
  }

  if (config.database.url) {
    base.connectionString = config.database.url;
    return base;
  }

  base.host = config.database.host;
  base.port = config.database.port;
  base.database = config.database.name;
  base.user = config.database.user;
  base.password = config.database.password;
  return base;
}

const pool = new Pool(buildPoolConfig());

// An idle-client error is emitted when a pooled connection fails outside of
// an active query. Log it but do not crash; the pool will replace the client.
pool.on('error', (err) => {
  logger.error('Unexpected idle PostgreSQL client error', { message: err.message });
});

// Verify connectivity once at startup so a misconfigured database surfaces
// immediately rather than on the first request.
async function verifyConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('PostgreSQL connection pool ready');
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
  logger.info('PostgreSQL connection pool closed');
}

module.exports = {
  pool: pool,
  verifyConnection: verifyConnection,
  closePool: closePool,
};
