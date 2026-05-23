'use strict';

// ============================================================================
// Notification templates.
// ----------------------------------------------------------------------------
// One entry per template key. Each renders a Title Case subject line and a
// plain-text body from a non-PHI payload. Payloads carry only template
// variables (names, dates, amounts, treatment names) - never clinical detail.
// A template gracefully tolerates missing payload fields so a notification is
// never blocked by an absent optional value.
// ============================================================================

// Read a payload value with a fallback, trimming surrounding whitespace.
function v(payload, key, fallback) {
  const raw = payload && payload[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw).trim();
}

const TEMPLATES = {
  prescription_signed: {
    subject: function () {
      return 'Your Prescription Has Been Reviewed';
    },
    text: function (p) {
      return (
        'Hello ' + v(p, 'firstName', 'there') + ',\n\n' +
        'A licensed provider has reviewed your intake for ' +
        v(p, 'treatmentName', 'your treatment') + '. Sign in to your ' +
        'PepNationRX dashboard to see the decision and next steps.\n\n' +
        'PepNationRX'
      );
    },
  },

  shipment_update: {
    subject: function () {
      return 'Your PepNationRX Shipment Update';
    },
    text: function (p) {
      const tracking = v(p, 'trackingNumber', '');
      const trackingLine = tracking
        ? '\nTracking number: ' + tracking + '\n'
        : '\n';
      return (
        'Hello ' + v(p, 'firstName', 'there') + ',\n\n' +
        'Your ' + v(p, 'treatmentName', 'treatment') + ' shipment status ' +
        'is now: ' + v(p, 'status', 'updated') + '.' + trackingLine +
        '\nPepNationRX'
      );
    },
  },

  billing_renewal: {
    subject: function () {
      return 'Your PepNationRX Plan Renews Soon';
    },
    text: function (p) {
      return (
        'Hello ' + v(p, 'firstName', 'there') + ',\n\n' +
        'Your ' + v(p, 'planName', 'plan') + ' renews on ' +
        v(p, 'renewalDate', 'your next billing date') + ' for ' +
        v(p, 'amount', 'the plan amount') + '. No action is needed to ' +
        'continue. You can manage your subscription from your dashboard.\n\n' +
        'PepNationRX'
      );
    },
  },

  checkin_due: {
    subject: function () {
      return 'Your Monthly Check-In Is Due';
    },
    text: function (p) {
      return (
        'Hello ' + v(p, 'firstName', 'there') + ',\n\n' +
        'Your monthly clinical check-in is due by ' +
        v(p, 'dueDate', 'soon') + '. Completing it keeps your protocol ' +
        'authorized without interruption. Sign in to complete it.\n\n' +
        'PepNationRX'
      );
    },
  },

  subscription_changed: {
    subject: function () {
      return 'Your Subscription Was Updated';
    },
    text: function (p) {
      return (
        'Hello ' + v(p, 'firstName', 'there') + ',\n\n' +
        'Your ' + v(p, 'planName', 'subscription') + ' was updated: ' +
        v(p, 'change', 'a change was applied') + '. If you did not make ' +
        'this change, contact support right away.\n\n' +
        'PepNationRX'
      );
    },
  },
};

// Render a template to { subject, text }. Returns null for an unknown key so
// the service can fail safely rather than send an empty message.
function render(templateKey, payload) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return null;
  return {
    subject: tpl.subject(payload || {}),
    text: tpl.text(payload || {}),
  };
}

// True when the template key is known.
function exists(templateKey) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, templateKey);
}

module.exports = {
  render: render,
  exists: exists,
  TEMPLATE_KEYS: Object.keys(TEMPLATES),
};
