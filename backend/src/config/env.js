'use strict';

// ============================================================================
// Typed environment loader and validation.
// Loads .env once, validates required keys, and exposes a frozen config
// object. The process exits early with a clear message if configuration is
// invalid, so misconfiguration never reaches request handling.
// ============================================================================

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const errors = [];

function required(key) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    errors.push('Missing required environment variable: ' + key);
    return '';
  }
  return value;
}

function optional(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function asInt(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    errors.push('Environment variable ' + key + ' must be an integer.');
    return fallback;
  }
  return parsed;
}

function asBool(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

const config = {
  nodeEnv: nodeEnv,
  isProduction: isProduction,
  port: asInt('PORT', 4000),
  corsOrigins: optional('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  database: {
    url: optional('DATABASE_URL', ''),
    host: optional('PGHOST', 'localhost'),
    port: asInt('PGPORT', 5432),
    name: optional('PGDATABASE', 'pepnationrx'),
    user: optional('PGUSER', 'pepnationrx'),
    password: optional('PGPASSWORD', ''),
    ssl: asBool('PGSSL', false),
    poolMax: asInt('PG_POOL_MAX', 10),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtlSeconds: asInt('JWT_ACCESS_TTL', 900),
    refreshTtlDays: asInt('JWT_REFRESH_TTL_DAYS', 30),
    issuer: optional('JWT_ISSUER', 'pepnationrx'),
  },

  security: {
    bcryptRounds: asInt('BCRYPT_ROUNDS', 12),
    phiEncryptionKey: required('PHI_ENCRYPTION_KEY'),
  },

  rateLimit: {
    windowMs: asInt('RATE_LIMIT_WINDOW_MS', 900000),
    max: asInt('RATE_LIMIT_MAX', 100),
    authMax: asInt('AUTH_RATE_LIMIT_MAX', 10),
  },

  // The Triad: medical network, 503A pharmacy, Stripe Connect. All optional so
  // the API still boots in development before integration credentials exist;
  // each service checks isConfigured() before making a live call.
  integrations: {
    medicalNetwork: {
      baseUrl: optional('MEDICAL_NETWORK_BASE_URL', ''),
      apiKey: optional('MEDICAL_NETWORK_API_KEY', ''),
      webhookSecret: optional('MEDICAL_NETWORK_WEBHOOK_SECRET', ''),
    },
    pharmacy: {
      baseUrl: optional('PHARMACY_BASE_URL', ''),
      apiKey: optional('PHARMACY_API_KEY', ''),
      webhookSecret: optional('PHARMACY_WEBHOOK_SECRET', ''),
    },
    stripe: {
      secretKey: optional('STRIPE_SECRET_KEY', ''),
      webhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
      platformAccountId: optional('STRIPE_PLATFORM_ACCOUNT_ID', ''),
      medicalPracticeAccountId: optional('STRIPE_MEDICAL_PRACTICE_ACCOUNT_ID', ''),
      providerAccountId: optional('STRIPE_PROVIDER_ACCOUNT_ID', ''),
    },
    // Transactional notifications. Optional so the API boots without an email
    // provider; the email adapter simulates delivery until a key is present.
    notifications: {
      emailApiKey: optional('NOTIFICATION_EMAIL_API_KEY', ''),
      emailFrom: optional(
        'NOTIFICATION_EMAIL_FROM',
        'PepNationRX <noreply@pepnationrx.com>'
      ),
    },
  },
};

if (config.jwt.accessSecret && config.jwt.accessSecret === config.jwt.refreshSecret) {
  errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}

if (isProduction) {
  // Reject any secret that still looks like a template or placeholder value,
  // not just the two exact strings from .env.example. This also catches the
  // docker-compose development placeholders, which contain "change-me".
  const placeholderPattern = /replace-with|change-me|changeme|placeholder|example/i;
  if (
    placeholderPattern.test(config.jwt.accessSecret) ||
    placeholderPattern.test(config.jwt.refreshSecret)
  ) {
    errors.push('JWT secrets still hold placeholder values in production.');
  }
  if (config.jwt.accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
  }
  // The refresh token is long-lived, so a weak refresh secret is at least as
  // dangerous as a weak access secret; hold it to the same length floor.
  if (config.jwt.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production.');
  }
  // Patient data must never cross the network unencrypted. Require TLS to the
  // database in production, either via PGSSL or an sslmode in DATABASE_URL.
  if (!config.database.ssl && !/ssl/i.test(config.database.url)) {
    errors.push('Database TLS is required in production: set PGSSL=true or an sslmode in DATABASE_URL.');
  }
}

if (errors.length > 0) {
  // Use stderr directly; the logger depends on nothing, but config must fail
  // before anything else loads.
  process.stderr.write('Environment configuration is invalid:\n');
  errors.forEach((message) => process.stderr.write('  - ' + message + '\n'));
  process.exit(1);
}

module.exports = Object.freeze(config);
