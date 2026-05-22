// ============================================================================
// checkout.service.js - the PepNationRX checkout API client.
// ----------------------------------------------------------------------------
// A thin wrapper over the api client for POST /api/checkout. It shapes the
// request body the backend checkout validator expects and returns the parsed
// { subscription, transaction, address, consents, pricing } envelope.
//
// The consent document version is exported so the checkout component and the
// backend stay aligned on which disclosure text the patient accepted.
// ============================================================================

'use strict';

import { api } from './api.js';

// The version tag stamped onto every consent row recorded at checkout. Bump
// this whenever the checkout disclosure text changes.
export const CHECKOUT_CONSENT_VERSION = '2026-05-checkout-v1';

// Place a treatment plan order. `order` carries the plan selection, the
// shipping address (an id or an inline address), the accepted consents, and an
// optional affiliate code. The price is NOT sent: the backend resolves the
// authoritative per-month price from the catalog by treatmentSlug and cadence.
// Resolves with the checkout result envelope.
export function placeCheckout(order) {
  const body = {
    protocolCategory: order.protocolCategory,
    treatmentSlug: order.treatmentSlug,
    cadenceMonths: order.cadenceMonths,
    consents: order.consents,
  };
  if (order.intakeSubmissionId) body.intakeSubmissionId = order.intakeSubmissionId;
  if (order.affiliateCode) body.affiliateCode = order.affiliateCode;
  if (order.shippingAddressId) {
    body.shippingAddressId = order.shippingAddressId;
  } else if (order.shippingAddress) {
    body.shippingAddress = order.shippingAddress;
  }
  return api.post('/api/checkout', body);
}
