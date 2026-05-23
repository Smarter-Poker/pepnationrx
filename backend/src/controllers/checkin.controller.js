'use strict';

// ============================================================================
// Check-in controller.
// ----------------------------------------------------------------------------
// Handles the patient-facing monthly check-in flow: listing check-ins for a
// subscription and submitting a patient's answers for an open check-in.
// All PHI (answers) is encrypted before reaching the database.
// ============================================================================

const checkinModel = require('../models/monthly-checkin.model');
const subscriptionModel = require('../models/subscription.model');
const encryptionService = require('../services/encryption.service');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// GET /subscriptions/:subscriptionId/checkins
// Returns all check-ins for the given subscription. The caller must own the
// subscription or be an admin / support agent.
async function listBySubscription(req, res, next) {
  try {
    const subscriptionId = req.params.subscriptionId;

    const sub = await subscriptionModel.findById(subscriptionId);
    if (!sub) {
      return next(errors.notFound('Subscription Not Found.'));
    }

    const isOwner = sub.user_id === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'support';
    if (!isOwner && !isStaff) {
      return next(errors.forbidden('You Do Not Have Access To This Subscription.'));
    }

    const checkins = await checkinModel.findBySubscriptionId(subscriptionId);

    res.status(200).json({ checkins: checkins });
  } catch (err) {
    next(err);
  }
}

// POST /checkins/:checkinId/submit
// The patient submits their answers for an open ('due') check-in. Answers are
// encrypted before storage; the raw payload never touches the database.
async function submit(req, res, next) {
  try {
    const checkinId = req.params.checkinId;

    const checkin = await checkinModel.findById(checkinId);
    if (!checkin) {
      return next(errors.notFound('Check-In Not Found.'));
    }

    // Verify the check-in belongs to the authenticated patient.
    const sub = await subscriptionModel.findById(checkin.subscription_id);
    if (!sub || sub.user_id !== req.user.id) {
      return next(errors.forbidden('You Do Not Have Access To This Check-In.'));
    }

    if (checkin.status !== 'due') {
      return next(
        errors.conflict(
          'Check-In Cannot Be Submitted Because It Is Not In The Due State.'
        )
      );
    }

    const answersEncrypted = encryptionService.encryptJson(req.body.answers || null);

    const updated = await checkinModel.submit(checkinId, answersEncrypted);

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'checkin.submitted',
      entityType: 'monthly_checkin',
      entityId: checkinId,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ checkin: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBySubscription: listBySubscription,
  submit: submit,
};
