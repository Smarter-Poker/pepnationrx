'use strict';

// ============================================================================
// Notification service - orchestrates patient notifications.
// ----------------------------------------------------------------------------
// send() is the single entry point. It renders a template, checks the user's
// channel preferences, records a durable notifications row (idempotent via
// dedupeKey), dispatches through the channel adapter, and marks the row sent,
// failed, or skipped.
//
// Like the audit service, send() never throws into its caller: a notification
// failure must not roll back the clinical or billing action that triggered it.
// Failures are recorded on the notification row and to the application logger.
// ============================================================================

const { queryOne } = require('../../db/query');
const logger = require('../../utils/logger');
const notificationModel = require('../../models/notification.model');
const templates = require('./templates');
const emailAdapter = require('./email-adapter');

// Resolve the recipient email: trust an explicitly supplied address, otherwise
// look it up from the users table. Returns null when neither is available.
async function resolveEmail(userId, suppliedEmail) {
  if (suppliedEmail) return suppliedEmail;
  const row = await queryOne('SELECT email FROM users WHERE id = $1', [userId]);
  return row ? row.email : null;
}

// Whether the user's preferences permit the channel.
function channelEnabled(preferences, channel) {
  if (channel === 'sms') return preferences.sms_enabled === true;
  return preferences.email_enabled !== false;
}

// Send a notification.
//   data.userId    - recipient users.id (required)
//   data.template  - a key from templates.TEMPLATE_KEYS (required)
//   data.payload   - non-PHI template variables
//   data.channel   - 'email' (default) or 'sms'
//   data.dedupeKey - optional idempotency key; a repeat is a no-op
//   data.email     - optional explicit recipient address
// Resolves to a result object; never rejects.
async function send(data) {
  const channel = data && data.channel === 'sms' ? 'sms' : 'email';
  try {
    if (!data || !data.userId || !data.template) {
      logger.warn('Notification send missing userId or template');
      return { ok: false, reason: 'invalid_request' };
    }
    if (!templates.exists(data.template)) {
      logger.warn('Notification send unknown template', {
        template: data.template,
      });
      return { ok: false, reason: 'unknown_template' };
    }

    const rendered = templates.render(data.template, data.payload || {});

    // Honor the user's channel preference. A skipped notification is still
    // recorded so the timeline shows the platform chose not to send.
    const preferences = await notificationModel.getPreferences(data.userId);
    if (!channelEnabled(preferences, channel)) {
      const skippedRow = await notificationModel.create({
        userId: data.userId,
        channel: channel,
        template: data.template,
        subject: rendered.subject,
        payload: data.payload || {},
        dedupeKey: data.dedupeKey || null,
      });
      if (skippedRow) await notificationModel.markSkipped(skippedRow.id);
      return { ok: true, skipped: true };
    }

    // Record the notification. A null row means the dedupeKey already exists -
    // this exact event was handled, so stop here.
    const row = await notificationModel.create({
      userId: data.userId,
      channel: channel,
      template: data.template,
      subject: rendered.subject,
      payload: data.payload || {},
      dedupeKey: data.dedupeKey || null,
    });
    if (!row) {
      return { ok: true, duplicate: true };
    }

    // SMS is not wired yet; record the row and skip dispatch cleanly.
    if (channel === 'sms') {
      await notificationModel.markSkipped(row.id);
      return { ok: true, skipped: true, reason: 'sms_not_enabled' };
    }

    const to = await resolveEmail(data.userId, data.email);
    if (!to) {
      await notificationModel.markFailed(row.id, 'no recipient email');
      return { ok: false, reason: 'no_recipient' };
    }

    const result = await emailAdapter.send({
      to: to,
      subject: rendered.subject,
      text: rendered.text,
    });
    await notificationModel.markSent(row.id);
    return { ok: true, notificationId: row.id, simulated: result.simulated === true };
  } catch (err) {
    // A dispatch failure is logged and recorded but never thrown onward.
    logger.error('Notification send failed', {
      template: data && data.template,
      message: err.message,
    });
    return { ok: false, reason: 'send_error', error: err.message };
  }
}

module.exports = {
  send: send,
};
