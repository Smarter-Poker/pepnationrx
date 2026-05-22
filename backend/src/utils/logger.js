'use strict';

// ============================================================================
// Dependency-free structured logger.
// Emits single-line JSON to stdout/stderr so logs are machine-parseable in
// CloudWatch. PHI must never be passed to the logger; callers pass only
// non-identifying metadata.
// ============================================================================

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// In production, suppress debug-level noise.
const minLevel = process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;

function emit(level, message, meta) {
  if (LEVELS[level] < minLevel) return;
  const record = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
  };
  if (meta && typeof meta === 'object') {
    record.meta = meta;
  }
  const line = JSON.stringify(record);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
