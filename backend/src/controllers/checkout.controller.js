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
const referralModel = require('../models/affiliate-referral.model');
const treatmentModel = require('../models/treatment.model');
const subscriptionModel = require('../models/subscription.model');
const transactionModel = require('../models/transaction.model');
const couponModel = require('../models/coupon.model');
const membershipService = require('../services/membership');
const couponService = require('../services/coupon');
const { withTransaction } = require('../db/query');

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
async function resolveShippingAddress(req, input, client) {
  if (input.shippingAddressId) {
    const existing = await addressModel.findById(input.shippingAddressId);
    if (!existing || existing.user_id !== req.user.id) {
      throw errors.notFound('Shipping address not found.');
    }
    return existing;
  }
  if (input.shippingAddress) {
    const a = input.shippingAddress;
    return addressModel.create(
      {
        userId: req.user.id,
        addressType: 'shipping',
        line1: a.line1,
        line2: a.line2 || null,
        city: a.city,
        state: a.state.toUpperCase(),
        postalCode: a.postalCode,
        country: (a.country || 'US').toUpperCase(),
        isDefault: false,
      },
      client
    );
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

    // The protocol category comes from the catalog, not the request: when the
    // treatment maps to a triage protocol that protocol is authoritative, so a
    // client cannot mis-route the subscription into the wrong clinical queue.
    // Treatments with no triage protocol (OTC items) keep the validated
    // request value, since the catalog has none to override it with.
    const protocolCategory = plan.protocol_category || input.protocolCategory;

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
    // B-09: pg returns NUMERIC columns as JS strings; coerce to integer before
    // multiplying so computeSplit always receives a whole-number gross.
    const basePriceCentsInt = Math.round(Number(plan.price_cents));
    // PepNationRX Plus member pricing: an active member is charged the
    // discounted per-month price on this order and on every renewal (the
    // discounted value is stored as the subscription's mrr_cents). The price
    // is resolved server-side from the member's record, never the request.
    const memberPricing = await membershipService.resolvePlanPriceForUser(
      basePriceCentsInt,
      req.user.id
    );
    const priceCentsInt = memberPricing.effectiveCents;
    const subtotalCents = priceCentsInt * input.cadenceMonths;
    const consultFeeCents = constants.FEE_SPLIT.consultFeeCents;

    // Coupon discount: an optional code is a one-time discount on this order.
    // It comes off the order subtotal; the discounted amount is what the
    // patient is charged and what the transaction records. The provider's flat
    // consult fee is unaffected - the provider is paid in full - the platform
    // management fee is recomputed on the discounted gross, and the medical
    // practice absorbs the discount from its medical revenue. The subscription
    // mrr is unchanged, so renewals continue to bill the full plan price.
    let coupon = null;
    let couponDiscountCents = 0;
    if (input.couponCode) {
      coupon = await couponService.validateCoupon(
        input.couponCode,
        req.user.id
      );
      if (subtotalCents < coupon.min_subtotal_cents) {
        throw errors.unprocessable(
          'Your order does not meet the minimum for that coupon code.'
        );
      }
      const rawDiscount = couponService.computeDiscountCents(
        coupon,
        subtotalCents
      );
      // The discounted gross must still cover the provider consult fee and the
      // management fee. Cap the discount at a floor that keeps the tri-party
      // split valid: discounted gross * (1 - managementFeePct/100) must stay
      // at or above the flat consult fee.
      const minNetGross = Math.ceil(
        consultFeeCents / (1 - constants.FEE_SPLIT.managementFeePct / 100)
      );
      const maxDiscount = Math.max(0, subtotalCents - minNetGross);
      couponDiscountCents = Math.min(rawDiscount, maxDiscount);
      if (rawDiscount > 0 && couponDiscountCents === 0) {
        throw errors.unprocessable(
          'That coupon cannot be applied to an order this small.'
        );
      }
    }

    // The gross billed for this order: the subtotal less any coupon discount.
    const grossAmountCents = subtotalCents - couponDiscountCents;
    const managementFeeCents = Math.round(
      (grossAmountCents * constants.FEE_SPLIT.managementFeePct) / 100
    );
    const split = connect.computeSplit({
      grossAmountCents: grossAmountCents,
      consultFeeCents: consultFeeCents,
      managementFeeCents: managementFeeCents,
    });

    const stripe = config.integrations.stripe;
    // N-01: 'unconfigured' would be silently stored in production. Fail
    // fast at request time instead of committing a garbage value to the DB.
    const merchantOfRecord =
      stripe.medicalPracticeAccountId || stripe.platformAccountId;
    if (!merchantOfRecord) {
      throw errors.unprocessable(
        'Payment processing is not yet configured. Please contact support.'
      );
    }

    // Persist the consent rows, the shipping address, the subscription, and
    // the transaction as one unit. A failure partway through rolls every write
    // back rather than leaving, for example, a subscription with no
    // transaction or orphaned consent rows.
    const placed = await withTransaction(async function (client) {
      const consentRows = [];
      for (let i = 0; i < input.consents.length; i += 1) {
        const c = input.consents[i];
        const row = await consentModel.record(
          {
            userId: req.user.id,
            consentType: c.consentType,
            documentVersion: c.documentVersion,
            accepted: c.accepted,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
          client
        );
        consentRows.push(row);
      }

      const address = await resolveShippingAddress(req, input, client);

      // The subscription is not live revenue until a provider has reviewed the
      // intake, so it starts in 'pending_clinical_review'.
      const subscription = await subscriptionModel.create(
        {
          userId: req.user.id,
          protocolCategory: protocolCategory,
          planName: plan.plan_name,
          mrrCents: priceCentsInt,
          currency: 'USD',
          affiliateId: affiliateId,
          treatmentPlanId: plan.plan_id,
          // W-05: link the subscription to the intake that preceded it so the
          // clinical audit trail from intake → subscription is preserved.
          intakeSubmissionId: input.intakeSubmissionId || null,
        },
        client
      );

      // Record the pending tri-party transaction. The medical practice is the
      // Merchant of Record; the platform account collects the management fee.
      const transaction = await transactionModel.create(
        {
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
        },
        client
      );

      // When a coupon was applied, record the redemption inside this same
      // transaction so the discount, the subscription, and the charge commit
      // as one unit. recordRedemption claims a slot with a guarded UPDATE; a
      // null result means the code was exhausted or deactivated since it was
      // validated, so the whole checkout is rolled back.
      let couponRedemption = null;
      if (coupon && couponDiscountCents > 0) {
        couponRedemption = await couponModel.recordRedemption(
          {
            couponId: coupon.id,
            userId: req.user.id,
            subscriptionId: subscription.id,
            transactionId: transaction.id,
            discountCents: couponDiscountCents,
          },
          client
        );
        if (!couponRedemption) {
          throw errors.conflict(
            'That coupon code is no longer available. Please remove it and try again.'
          );
        }
      }

      // When the checkout is attributed to an affiliate, record the referral
      // conversion on this same transaction so it commits with the
      // subscription. A referralId from a tracked /?ref= landing marks that
      // exact referral converted; without one - the patient entered the code
      // directly - a direct conversion row is recorded instead.
      if (affiliateId) {
        if (input.referralId) {
          await referralModel.markConverted(
            input.referralId,
            {
              referredUserId: req.user.id,
              subscriptionId: subscription.id,
              affiliateId: affiliateId,
            },
            client
          );
        } else {
          await referralModel.recordDirectConversion(
            {
              affiliateId: affiliateId,
              referredUserId: req.user.id,
              subscriptionId: subscription.id,
              referralLinkSlug: input.affiliateCode,
            },
            client
          );
        }
      }

      return {
        consentRows: consentRows,
        address: address,
        subscription: subscription,
        transaction: transaction,
        couponRedemption: couponRedemption,
      };
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'checkout.placed',
      entityType: 'subscription',
      entityId: placed.subscription.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Record the coupon redemption separately so the discount is traceable in
    // the audit log against the coupon entity, not just the subscription.
    if (placed.couponRedemption) {
      await audit.record({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'coupon.redeemed',
        entityType: 'coupon',
        entityId: coupon.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    res.status(201).json({
      subscription: placed.subscription,
      transaction: placed.transaction,
      address: placed.address,
      consents: placed.consentRows,
      pricing: {
        grossAmountCents: split.grossAmountCents,
        consultFeeCents: split.consultFeeCents,
        managementFeeCents: split.managementFeeCents,
        medicalRevenueCents: split.medicalRevenueCents,
        cadenceMonths: input.cadenceMonths,
        pricePerMonthCents: priceCentsInt,
        basePricePerMonthCents: basePriceCentsInt,
        memberDiscountApplied: memberPricing.memberDiscountApplied,
        subtotalCents: subtotalCents,
        couponCode: coupon ? coupon.code : null,
        couponDiscountCents: couponDiscountCents,
        couponApplied: couponDiscountCents > 0,
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
