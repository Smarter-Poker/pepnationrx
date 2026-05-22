'use strict';

// ============================================================================
// Typed application errors.
// AppError carries an HTTP status and a stable machine-readable code. The
// centralized error handler renders these consistently; any non-AppError is
// treated as an unexpected 500 and its detail is never leaked to the client.
// ============================================================================

class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details || null;
    // Marks errors that are safe to surface to the client verbatim.
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - malformed request or failed schema validation.
function badRequest(message, details) {
  return new AppError(400, 'bad_request', message || 'Bad Request', details);
}

// 401 - missing, invalid, or expired credentials.
function unauthorized(message) {
  return new AppError(401, 'unauthorized', message || 'Unauthorized');
}

// 403 - authenticated but not permitted.
function forbidden(message) {
  return new AppError(403, 'forbidden', message || 'Forbidden');
}

// 404 - resource does not exist.
function notFound(message) {
  return new AppError(404, 'not_found', message || 'Not Found');
}

// 409 - state conflict, for example a duplicate email on registration.
function conflict(message) {
  return new AppError(409, 'conflict', message || 'Conflict');
}

// 422 - well-formed request that fails a domain rule.
function unprocessable(message, details) {
  return new AppError(422, 'unprocessable_entity', message || 'Unprocessable Entity', details);
}

// 429 - rate limit exceeded.
function tooManyRequests(message) {
  return new AppError(429, 'too_many_requests', message || 'Too Many Requests');
}

module.exports = {
  AppError: AppError,
  badRequest: badRequest,
  unauthorized: unauthorized,
  forbidden: forbidden,
  notFound: notFound,
  conflict: conflict,
  unprocessable: unprocessable,
  tooManyRequests: tooManyRequests,
};
