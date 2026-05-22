'use strict';

// ============================================================================
// PHI encryption service.
// Implements application-layer envelope encryption for the BYTEA "_encrypted"
// columns defined in database/schema.sql. PHI is encrypted with AES-256-GCM
// before it reaches PostgreSQL and decrypted only after an audited read.
//
// In production the data key is managed by AWS KMS. For local development the
// PHI_ENCRYPTION_KEY environment value (32-byte hex) is used directly. The
// public interface does not change between the two modes.
// ============================================================================

const crypto = require('crypto');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the standard size for GCM.
const KEY_LENGTH = 32; // 256-bit key.

// Resolve the raw 32-byte key from configuration. A hex string of the exact
// length is used as-is; any other value is derived to 32 bytes via SHA-256 so
// development never fails on key formatting, while production is validated.
function resolveKey() {
  const raw = config.security.phiEncryptionKey;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (config.isProduction) {
    throw new AppError(
      500,
      'encryption_misconfigured',
      'PHI_ENCRYPTION_KEY must be a 32-byte hex value in production.'
    );
  }
  return crypto.createHash('sha256').update(String(raw)).digest();
}

const KEY = resolveKey();
if (KEY.length !== KEY_LENGTH) {
  throw new AppError(500, 'encryption_misconfigured', 'Resolved PHI key is not 32 bytes.');
}

// Encrypt a plaintext string into a self-describing Buffer suitable for a
// BYTEA column. Layout: [12-byte IV][16-byte auth tag][ciphertext].
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

// Decrypt a Buffer produced by encrypt() back to its plaintext string.
function decrypt(payload) {
  if (payload === null || payload === undefined) return null;
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (buffer.length < IV_LENGTH + 16) {
    throw new AppError(500, 'decryption_failed', 'Encrypted payload is too short.');
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    // A GCM auth-tag mismatch means tampering or a wrong key. Never leak detail.
    throw new AppError(500, 'decryption_failed', 'Unable to decrypt PHI payload.');
  }
}

// Convenience wrappers for JSON-shaped PHI (medical history, allergies, etc.).
function encryptJson(value) {
  if (value === null || value === undefined) return null;
  return encrypt(JSON.stringify(value));
}

function decryptJson(payload) {
  const text = decrypt(payload);
  return text === null ? null : JSON.parse(text);
}

module.exports = {
  encrypt: encrypt,
  decrypt: decrypt,
  encryptJson: encryptJson,
  decryptJson: decryptJson,
};
