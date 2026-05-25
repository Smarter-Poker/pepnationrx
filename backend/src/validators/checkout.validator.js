'use strict';

// ============================================================================
// Checkout request schema (Zod).
// ----------------------------------------------------------------------------
// Validates the body posted to POST /api/checkout. A checkout turns a chosen
// treatment plan into a pending subscription plus a pending tri-party
// transaction. The patient must record the checkout-stage consents (the MSO
// billing-agent disclosure and the telehealth informed-consent) for the
// request to be accepted; the controller enforces which consent types are
// required, this schema only validates their shape.
// ============================================================================

const { z } = require('zod');

// Mirror of the protocol_category enum in database/schema.sql.
const protocolCategory = z.enum([
  'mens_optimization',
  'womens_wellness',
  'peptide_therapy',
  'trt',
  'longevity',
  'weight_management',
  'sexual_health',
]);

// Mirror of the consent_type enum in database/schema.sql.
const consentType = z.enum([
  'mso_billing_agent',
  'telehealth_informed_consent',
  'hipaa_authorization',
  'terms_of_service',
  'privacy_policy',
]);

// One acknowledgement the patient made on the checkout screen. `accepted` is
// pinned to the literal true: a consent the patient declined must not be
// submitted at all, so an accepted:false row can never reach the consents
// table and contaminate the legal record.
const consentAcknowledgement = z.object({
  consentType: consentType,
  documentVersion: z.string().trim().min(1).max(64),
  accepted: z.literal(true),
});

// A new shipping address supplied inline at checkout. Mutually exclusive with
// shippingAddressId; the controller resolves which one was given.
const shippingAddress = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().length(2),
  postalCode: z.string().trim().min(3).max(12),
  country: z.string().trim().length(2).optional(),
});

const checkoutSchema = z
  .object({
    protocolCategory: protocolCategory,
    // The catalog slug being purchased. Required: the controller resolves the
    // plan, its name, and the authoritative per-month price from the catalog
    // by this slug and the cadence. The client never supplies the price.
    treatmentSlug: z.string().trim().min(1).max(64),
    // Supported plan cadences, in months. Mirrors the catalog cadence set.
    cadenceMonths: z.union([
      z.literal(1),
      z.literal(3),
      z.literal(6),
      z.literal(12),
    ]),
    // Optional references that link the checkout to the rest of the record.
    intakeSubmissionId: z.string().uuid().optional(),
    affiliateCode: z.string().trim().min(1).max(64).optional(),
    // An optional discount code applied to this order. The controller resolves
    // and validates the code and computes the discount; this schema only
    // checks its shape.
    couponCode: z.string().trim().min(1).max(64).optional(),
    // The id returned by POST /api/affiliate/track-referral when the visitor
    // arrived through a /?ref= link. Carried back here so the checkout marks
    // that exact referral converted rather than recording a direct one.
    referralId: z.string().uuid().optional(),
    // Shipping address: an existing id, or a new address, or neither.
    shippingAddressId: z.string().uuid().optional(),
    shippingAddress: shippingAddress.optional(),
    // The consents the patient acknowledged on the checkout screen.
    consents: z.array(consentAcknowledgement).min(1).max(10),
  })
  .strict()
  .refine(
    function (data) {
      return !(data.shippingAddressId && data.shippingAddress);
    },
    {
      message: 'Provide either shippingAddressId or shippingAddress, not both.',
      path: ['shippingAddress'],
    }
  );

module.exports = {
  checkoutSchema: checkoutSchema,
};
