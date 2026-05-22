'use strict';

// ============================================================================
// Checkout controller.
// ----------------------------------------------------------------------------
// Turns a chosen treatment plan into a pending subscription and a pending
// tri-party transaction. Checkout never activates a subscription on its own:
// a recurring protocol stays in 'pending_clinical_review' until a licensed
// provider has reviewed the patient's intake. The transaction records the
// Stripe Connect split (medical practice as Merchant of Record, provider
// consult fee, PepNationRX management fee) and starts in 'requires_payment'.
// ============================================================================

const config = require('../config/env');
const constants = require('../config/constants');
const errors = require('../utils/errors');
const connect = require('../services/stripe/connect');
const audit = require('../services/audit.service');
const consentModel = require('../models/consent.model');
const addressModel = require('../models/address.model');
const affiliateModel = require('../models/affiliate.model');
const treatmentModel = require('../models/treatment.model');
const subscriptionModel = require('../models/subscription.model');
const transactionModel = require('../models/transaction.model');

// Consent types the patient must accept on the checkout screen. The MSO
// billing-agent disclosure and the telehealth informed-consent are the
// checkout layer of the mandatory consent gate.
const REQUIRED_CONSENTS = [
  constants.CONSENT_TYPES.MSO_BILLING_AGENT,
  constants.CONSENT_TYPES.TELEHEALTH_INFORMED_CONSENT,
];

// Collect the non-PHI request metadata recorded on consent rows and audit_log.
function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// Confirm every required consent is present and accepted in the request body.
function assertRequiredConsents(submitted) {
  const acceptedTypes = submitted
    .filter(function (c) {
      return c.accepted === true;
    })
    .map(function (c) {
      return c.consentType;
    });
  const missing = REQUIRED_CONSENTS.filter(function (type) {
    return acceptedTypes.indexOf(type) === -1;
  });
  if (missing.length > 0) {
    throw errors.unprocessable(
      'All checkout consents must be accepted to proceed.',
      { missingConsents: missing }
    );
  }
}

// Resolve the shipping address: an existing address the patient owns, or a new
// address supplied inline. Cold-chain pharmacy shipments require one.
async function resolveShippingAddress(req, input) {
  if (input.shippingAddressId) {
    const existing = await addressModel.findById(input.shippingAddressId);
    if (!existing || existing.user_id !== req.user.id) {
      throw errors.notFound('Shipping address not found.');
    }
    return existing;
  }
  if (input.shippingAddress) {
    const a = input.shippingAddress;
    return addressModel.create({
      userId: req.user.id,
      addressType: 'shipping',
      line1: a.line1,
      line2: a.line2 || null,
      city: a.city,
      state: a.state.toUpperCase(),
      postalCode: a.postalCode,
      country: (a.country || 'US').toUpperCase(),
      isDefault: false,
    });
  }
  throw errors.unprocessable('A shipping address is required to check out.');
}

// POST /api/checkout - place a treatment plan order.
async function place(req, res, next) {
  try {
    const input = req.body;
    const meta = requestMeta(req);

    assertRequiredConsents(input.consents);

    // Resolve the authoritative plan and price from the catalog. The client
    // sends only the treatment slug and cadence; the per-month price is never
    // trusted from the request.
    const plan = await treatmentModel.findActivePlan(
      input.treatmentSlug,
      input.cadenceMonths
    );
    if (!plan) {
      throw errors.unprocessable('That treatment plan is not available.');
    }
    if (plan.availability !== 'available') {
      throw errors.unprocessable(
        'That treatment is not currently available for purchase.'
      );
    }

    // Persist every consent acknowledgement the patient submitted.
    const consentRows = [];
    for (let i = 0; i < input.consents.length; i += 1) {
      const c = input.consents[i];
      const row = await consentModel.record({
        userId: req.user.id,
        consentType: c.consentType,
        documentVersion: c.documentVersion,
        accepted: c.accepted,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      consentRows.push(row);
    }

    const address = await resolveShippingAddress(req, input);

    // Resolve the referring affiliate when a code was supplied. An unknown or
    // inactive code is ignored rather than failing the checkout.
    let affiliateId = null;
    if (input.affiliateCode) {
      const affiliate = await affiliateModel.findByCode(input.affiliateCode);
      if (affiliate && affiliate.is_active === true) {
        affiliateId = affiliate.id;
      }
    }

    // Compute the tri-party split. The gross is the full plan price (the
    // catalog per-month price times the cadence); the consult fee is flat per
    // charge and the management fee is a percent of the gross.
    const grossAmountCents = plan.price_cents * input.cadenceMonths;
    const consultFeeCents = constants.FEE_SPLIT.consultFeeCents;
    const managementFeeCents = Math.round(
      (grossAmountCents * constants.FEE_SPLIT.managementFeePct) / 100
    );
    const split = connect.computeSplit({
      grossAmountCents: grossAmountCents,
      consultFeeCents: consultFeeCents,
      managementFeeCents: managementFeeCents,
    });

    // Create the subscription. It is not live revenue until a provider has
    // reviewed the intake, so it starts in 'pending_clinical_review'.
    const subscription = await subscriptionModel.create({
      userId: req.user.id,
      protocolCategory: input.protocolCategory,
      planName: plan.plan_name,
      mrrCents: plan.price_cents,
      currency: 'USD',
      affiliateId: affiliateId,
      treatmentPlanId: plan.plan_id,
    });

    // Record the pending tri-party transaction. The medical practice is the
    // Merchant of Record; the platform account collects the management fee.
    const stripe = config.integrations.stripe;
    const merchantOfRecord =
      stripe.medicalPracticeAccountId || stripe.platformAccountId || 'unconfigured';
    const transaction = await transactionModel.create({
      userId: req.user.id,
      subscriptionId: subscription.id,
      merchantOfRecord: merchantOfRecord,
      providerAccountId: stripe.providerAccountId || null,
      platformAccountId: stripe.platformAccountId || null,
      grossAmountCents: split.grossAmountCents,
      consultFeeCents: split.consultFeeCents,
      managementFeeCents: split.managementFeeCents,
      currency: 'USD',
      status: 'requires_payment',
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'checkout.placed',
      entityType: 'subscription',
      entityId: subscription.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(201).json({
      subscription: subscription,
      transaction: transaction,
      address: address,
      consents: consentRows,
      pricing: {
        grossAmountCents: split.grossAmountCents,
        consultFeeCents: split.consultFeeCents,
        managementFeeCents: split.managementFeeCents,
        medicalRevenueCents: split.medicalRevenueCents,
        cadenceMonths: input.cadenceMonths,
        pricePerMonthCents: plan.price_cents,
        currency: 'USD',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  place: place,
};
