'use strict';

// ============================================================================
// Medical network HTTP client (Wheel / SteadyMD).
// ----------------------------------------------------------------------------
// A thin, typed wrapper over the medical network's REST API. Every PHI-bearing
// call goes through here. The client no-ops in development when no base URL
// and API key are configured, so the rest of the platform can be exercised
// before integration credentials exist; callers check isConfigured() first.
// ============================================================================

const config = require('../../config/env');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errors');

const settings = config.integrations.medicalNetwork;
const REQUEST_TIMEOUT_MS = 15000;

// True when the integration has the credentials it needs to make a live call.
function isConfigured() {
  return Boolean(settings.baseUrl && settings.apiKey);
}

// Issue a JSON request against the medical network API. Throws an AppError
// with a stable code on misconfiguration, timeout, or a non-2xx response.
async function request(method, path, body) {
  if (!isConfigured()) {
    throw new AppError(
      503,
      'medical_network_unconfigured',
      'The medical network integration is not configured.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(settings.baseUrl.replace(/\/$/, '') + path, {
      method: method,
      headers: {
        Authorization: 'Bearer ' + settings.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};

    if (!response.ok) {
      logger.error('Medical network request failed', {
        path: path,
        status: response.status,
      });
      throw new AppError(
        502,
        'medical_network_error',
        'The medical network returned an error.'
      );
    }
    return parsed;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'AbortError') {
      throw new AppError(504, 'medical_network_timeout', 'The medical network timed out.');
    }
    throw new AppError(502, 'medical_network_error', 'The medical network is unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

// Forward a mapped intake payload for clinical review. Returns the network's
// submission id and initial status.
async function submitIntake(networkPayload) {
  return request('POST', '/v1/intake-submissions', networkPayload);
}

// Read the current review status of a forwarded submission.
async function getSubmissionStatus(submissionId) {
  return request('GET', '/v1/intake-submissions/' + encodeURIComponent(submissionId));
}

// Request a synchronous (phone or video) visit for a submission, used in
// states that do not permit an asynchronous-only encounter.
async function requestSyncVisit(submissionId, state) {
  return request(
    'POST',
    '/v1/intake-submissions/' + encodeURIComponent(submissionId) + '/sync-visit',
    { state: state }
  );
}

module.exports = {
  isConfigured: isConfigured,
  submitIntake: submitIntake,
  getSubmissionStatus: getSubmissionStatus,
  requestSyncVisit: requestSyncVisit,
};
