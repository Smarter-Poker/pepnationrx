'use strict';

// ============================================================================
// Patient controller.
// ----------------------------------------------------------------------------
// Assembles the data behind the patient dashboard: the patient's profile,
// their subscriptions, prescriptions, pharmacy orders, and recent billing.
// A patient only ever sees their own dashboard; the data is keyed entirely on
// the authenticated user id.
// ============================================================================

const userModel = require('../models/user.model');
const subscriptionModel = require('../models/subscription.model');
const subscriptionEventModel = require('../models/subscription-event.model');
const prescriptionModel = require('../models/prescription.model');
const pharmacyOrderModel = require('../models/pharmacy-order.model');
const transactionModel = require('../models/transaction.model');
const addressModel = require('../models/address.model');
const notificationModel = require('../models/notification.model');
const notificationService = require('../services/notification');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// Human-readable change phrase per subscription event, used in the
// subscription_changed notification body.
const SUBSCRIPTION_CHANGE_TEXT = {
  paused: 'Your Plan Was Paused. Billing And Refills Are On Hold Until You Resume.',
  resumed: 'Your Plan Was Resumed And Is Active Again.',
  canceled: 'Your Plan Was Canceled. No Further Billing Will Occur.',
};

// Record a subscription state change to the audit log, the subscription_events
// history, and the patient's notification timeline. `event` is one of
// 'paused', 'resumed', 'canceled'. Notification failure never throws (the
// notification service swallows its own errors), so a change is durably
// recorded even if the email cannot be sent.
async function recordSubscriptionChange(req, sub, updated, event) {
  const eventRow = await subscriptionEventModel.record({
    subscriptionId: sub.id,
    userId: sub.user_id,
    eventType: event,
    fromStatus: sub.status,
    toStatus: updated.status,
    metadata: { actorRole: req.user.role },
  });

  await audit.record({
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'subscription.' + event,
    entityType: 'subscription',
    entityId: sub.id,
    phiAccessed: false,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  });

  await notificationService.send({
    userId: sub.user_id,
    template: 'subscription_changed',
    payload: {
      planName: sub.plan_name,
      change: SUBSCRIPTION_CHANGE_TEXT[event] || 'A Change Was Applied.',
    },
    // Key the dedupe on the unique subscription_events row id. Each distinct
    // change is its own event, so re-pausing after a resume always notifies,
    // while a server retry of the same request is still idempotent (the same
    // event row is referenced).
    dedupeKey: 'subscription-changed:' + eventRow.id,
  });
}

// GET /api/patient/dashboard - the authenticated patient's full dashboard.
async function dashboard(req, res, next) {
  try {
    const userId = req.user.id;

    const [profile, subscriptions, prescriptions, orders, transactions, lifetimeGross] =
      await Promise.all([
        userModel.findById(userId),
        subscriptionModel.findByUserId(userId),
        prescriptionModel.findByUserId(userId),
        pharmacyOrderModel.findByUserId(userId),
        transactionModel.findByUserId(userId, 25),
        transactionModel.lifetimeGrossCentsForUser(userId),
      ]);

    const activeSubscriptions = subscriptions.filter(function (s) {
      return subscriptionModel.ACTIVE_STATUSES.indexOf(s.status) !== -1;
    });

    await audit.record({
      actorUserId: userId,
      actorRole: req.user.role,
      action: 'patient.dashboard.viewed',
      entityType: 'user',
      entityId: userId,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({
      profile: profile,
      summary: {
        activeSubscriptionCount: activeSubscriptions.length,
        prescriptionCount: prescriptions.length,
        openOrderCount: orders.filter(function (o) {
          return o.status !== 'delivered' && o.status !== 'canceled';
        }).length,
        lifetimeSpendCents: lifetimeGross,
      },
      subscriptions: subscriptions,
      prescriptions: prescriptions,
      orders: orders,
      billing: {
        transactions: transactions,
        lifetimeSpendCents: lifetimeGross,
      },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/patient/subscriptions/:subscriptionId
// A patient cancels one of their own subscriptions. Only the subscription
// owner may cancel; admins use the admin router. Retained for backward
// compatibility; PATCH with action 'cancel' is the unified path.
async function cancelSubscription(req, res, next) {
  try {
    const subscriptionId = req.params.subscriptionId;

    const sub = await subscriptionModel.findById(subscriptionId);
    if (!sub) {
      return next(errors.notFound('Subscription Not Found.'));
    }
    if (sub.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Cancel Your Own Subscriptions.'));
    }

    const result = await subscriptionModel.cancel(subscriptionId, null, req.user.id);
    if (!result) {
      return next(errors.conflict('Subscription Is Already Canceled Or Expired.'));
    }

    await recordSubscriptionChange(req, sub, result, 'canceled');

    res.status(200).json({ subscription: result });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/patient/subscriptions/:subscriptionId
// The unified self-service subscription endpoint. The request body carries an
// `action` of 'pause', 'resume', or 'cancel'. Only the subscription owner may
// act. Each successful transition is recorded to the subscription_events
// history, the audit log, and the patient's notification timeline.
async function patchSubscription(req, res, next) {
  try {
    const subscriptionId = req.params.subscriptionId;
    const action =
      typeof req.body.action === 'string'
        ? req.body.action.trim().toLowerCase()
        : '';

    if (['pause', 'resume', 'cancel'].indexOf(action) === -1) {
      return next(
        errors.badRequest('Action Must Be One Of: Pause, Resume, Or Cancel.')
      );
    }

    const sub = await subscriptionModel.findById(subscriptionId);
    if (!sub) {
      return next(errors.notFound('Subscription Not Found.'));
    }
    if (sub.user_id !== req.user.id) {
      return next(
        errors.forbidden('You May Only Manage Your Own Subscriptions.')
      );
    }

    let updated = null;
    let event = null;
    if (action === 'pause') {
      updated = await subscriptionModel.pause(subscriptionId, null, req.user.id);
      event = 'paused';
      if (!updated) {
        return next(
          errors.conflict('Only An Active Subscription Can Be Paused.')
        );
      }
    } else if (action === 'resume') {
      updated = await subscriptionModel.resume(subscriptionId, null, req.user.id);
      event = 'resumed';
      if (!updated) {
        return next(
          errors.conflict('Only A Paused Subscription Can Be Resumed.')
        );
      }
    } else {
      updated = await subscriptionModel.cancel(subscriptionId, null, req.user.id);
      event = 'canceled';
      if (!updated) {
        return next(
          errors.conflict('Subscription Is Already Canceled Or Expired.')
        );
      }
    }

    await recordSubscriptionChange(req, sub, updated, event);

    res.status(200).json({ subscription: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/patient/addresses/:addressId
// Update mutable fields on an address the patient owns.
async function updateAddress(req, res, next) {
  try {
    const addressId = req.params.addressId;

    const addr = await addressModel.findById(addressId);
    if (!addr) {
      return next(errors.notFound('Address Not Found.'));
    }
    if (addr.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Edit Your Own Addresses.'));
    }

    const row = await addressModel.update(addressId, {
      userId: req.user.id,
      line1: req.body.line1 !== undefined ? req.body.line1 : addr.line1,
      line2: req.body.line2 !== undefined ? req.body.line2 : addr.line2,
      city: req.body.city !== undefined ? req.body.city : addr.city,
      state: req.body.state !== undefined ? req.body.state : addr.state,
      postalCode:
        req.body.postalCode !== undefined ? req.body.postalCode : addr.postal_code,
      country: req.body.country !== undefined ? req.body.country : addr.country,
    });

    res.status(200).json({ address: row });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/addresses/:addressId/set-default
// Make one address the patient's default shipping address.
async function setDefaultAddress(req, res, next) {
  try {
    const addressId = req.params.addressId;

    const addr = await addressModel.findById(addressId);
    if (!addr) {
      return next(errors.notFound('Address Not Found.'));
    }
    if (addr.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Manage Your Own Addresses.'));
    }

    const row = await addressModel.setDefault(addressId, req.user.id);

    res.status(200).json({ address: row });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/patient/addresses/:addressId
// Hard-delete an address the patient owns. Returns 204 No Content.
async function deleteAddress(req, res, next) {
  try {
    const addressId = req.params.addressId;

    const addr = await addressModel.findById(addressId);
    if (!addr) {
      return next(errors.notFound('Address Not Found.'));
    }
    if (addr.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Delete Your Own Addresses.'));
    }

    await addressModel.remove(addressId, req.user.id);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/notification-preferences
// The patient's per-channel notification opt-in. A patient with no stored
// row receives the platform defaults (email on, SMS off).
async function getNotificationPreferences(req, res, next) {
  try {
    const preferences = await notificationModel.getPreferences(req.user.id);
    res.status(200).json({
      preferences: {
        emailEnabled: preferences.email_enabled !== false,
        smsEnabled: preferences.sms_enabled === true,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/patient/notification-preferences
// Update the patient's per-channel notification opt-in. Both flags are
// optional; an omitted flag keeps its current value.
async function updateNotificationPreferences(req, res, next) {
  try {
    const current = await notificationModel.getPreferences(req.user.id);
    const emailEnabled =
      typeof req.body.emailEnabled === 'boolean'
        ? req.body.emailEnabled
        : current.email_enabled !== false;
    const smsEnabled =
      typeof req.body.smsEnabled === 'boolean'
        ? req.body.smsEnabled
        : current.sms_enabled === true;

    const row = await notificationModel.upsertPreferences(req.user.id, {
      emailEnabled: emailEnabled,
      smsEnabled: smsEnabled,
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'patient.notification_preferences.updated',
      entityType: 'notification_preferences',
      entityId: req.user.id,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({
      preferences: {
        emailEnabled: row.email_enabled !== false,
        smsEnabled: row.sms_enabled === true,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard: dashboard,
  cancelSubscription: cancelSubscription,
  patchSubscription: patchSubscription,
  updateAddress: updateAddress,
  setDefaultAddress: setDefaultAddress,
  deleteAddress: deleteAddress,
  getNotificationPreferences: getNotificationPreferences,
  updateNotificationPreferences: updateNotificationPreferences,
};
