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
const audit = require('../services/audit.service');

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

module.exports = {
  dashboard: dashboard,
};
