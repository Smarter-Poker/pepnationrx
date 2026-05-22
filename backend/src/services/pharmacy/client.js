'use strict';

// ============================================================================
// Pharmacy HTTP client (503A compounding pharmacy B2B API).
// ----------------------------------------------------------------------------
// A thin, typed wrapper over the pharmacy's B2B REST API. The client no-ops in
// development when no base URL and API key are configured; callers check
// isConfigured() before routing a live order.
// ============================================================================

const config = require('../../config/env');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errors');

const settings = config.integrations.pharmacy;
const REQUEST_TIMEOUT_MS = 15000;

// True when the integration has the credentials it needs to make a live call.
function isConfigured() {
  return Boolean(settings.baseUrl && settings.apiKey);
}

// Issue a JSON request against the pharmacy API. Throws an AppError with a
// stable code on misconfiguration, timeout, or a non-2xx response.
async function request(method, path, body) {
  if (!isConfigured()) {
    throw new AppError(
      503,
      'pharmacy_unconfigured',
      'The pharmacy integration is not configured.'
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
      logger.error('Pharmacy request failed', { path: path, status: response.status });
      throw new AppError(502, 'pharmacy_error', 'The pharmacy returned an error.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'AbortError') {
      throw new AppError(504, 'pharmacy_timeout', 'The pharmacy timed out.');
    }
    throw new AppError(502, 'pharmacy_error', 'The pharmacy is unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

// Submit an approved prescription order for fulfillment. Returns the
// pharmacy's external order id and its initial status.
async function submitOrder(orderPayload) {
  return request('POST', '/v1/orders', orderPayload);
}

// Read the current fulfillment status of an order.
async function getOrderStatus(externalOrderId) {
  return request('GET', '/v1/orders/' + encodeURIComponent(externalOrderId));
}

// Cancel an order that has not yet shipped.
async function cancelOrder(externalOrderId) {
  return request(
    'POST',
    '/v1/orders/' + encodeURIComponent(externalOrderId) + '/cancel'
  );
}

module.exports = {
  isConfigured: isConfigured,
  submitOrder: submitOrder,
  getOrderStatus: getOrderStatus,
  cancelOrder: cancelOrder,
};
