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
const prescriptionModel = require('../models/prescription.model');
const pharmacyOrderModel = require('../models/pharmacy-order.model');
const transactionModel = require('../models/transaction.model');
const addressModel = require('../models/address.model');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

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
// owner may cancel; admins use the admin router.
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

    const result = await subscriptionModel.cancel(subscriptionId);
    if (!result) {
      return next(errors.conflict('Subscription Is Already Canceled Or Expired.'));
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'subscription.canceled',
      entityType: 'subscription',
      entityId: subscriptionId,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ subscription: result });
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

    await addressModel.remove(addressId);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard: dashboard,
  cancelSubscription: cancelSubscription,
  updateAddress: updateAddress,
  setDefaultAddress: setDefaultAddress,
  deleteAddress: deleteAddress,
};
