'use strict';

// ============================================================================
// Email adapter for the notification service.
// ----------------------------------------------------------------------------
// Wraps the transactional email provider behind a small, stable interface so
// the notification orchestrator does not depend on a specific vendor. The
// default provider is Resend; the request shape is simple enough that a
// different provider is a one-function change.
//
// When no provider key is configured, or when running under NODE_ENV=test,
// send() simulates delivery (no network call) and reports simulated=true. This
// keeps the API and the test suite runnable without live credentials, exactly
// as the Triad services do.
// ============================================================================

const config = require('../../config/env');
const logger = require('../../utils/logger');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// True when a live email provider key is present.
function isConfigured() {
  return Boolean(config.integrations.notifications.emailApiKey);
}

// Send one email. Resolves to { delivered, simulated, providerId? }. Throws
// only on a live provider error so the orchestrator can record it as failed.
async function send(message) {
  if (!message || !message.to || !message.subject) {
    throw new Error('Email message requires to and subject.');
  }

  // Simulated path: no credentials, or the test environment. Never a network
  // call. The orchestrator still records the notification row.
  if (!isConfigured() || config.nodeEnv === 'test') {
    logger.info('Email simulated (no live provider)', {
      to: message.to,
      subject: message.subject,
    });
    return { delivered: false, simulated: true };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.integrations.notifications.emailApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.integrations.notifications.emailFrom,
      to: [message.to],
      subject: message.subject,
      text: message.text || '',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(function () {
      return '';
    });
    throw new Error(
      'Email provider returned ' + response.status + ': ' + detail.slice(0, 200)
    );
  }

  const body = await response.json().catch(function () {
    return {};
  });
  return { delivered: true, simulated: false, providerId: body.id || null };
}

module.exports = {
  isConfigured: isConfigured,
  send: send,
};
