'use strict';

// ============================================================================
// Pharmacy order router.
// ----------------------------------------------------------------------------
// Routes an approved prescription to a 503A compounding pharmacy. A local
// pharmacy_orders row is always created first so the order is never lost; the
// external submission follows. If the pharmacy integration is not configured,
// the order is left queued for a later sweep rather than failing.
// ============================================================================

const logger = require('../../utils/logger');
const pharmacyOrderModel = require('../../models/pharmacy-order.model');
const audit = require('../audit.service');
const pharmacyClient = require('./client');

// Route an approved prescription. `input` carries:
//   prescription        the prescriptions row (id, user_id, drug_compound, ...)
//   pharmacyId          the pharmacies row id to fulfill through
//   shippingAddressId   the addresses row id to ship to (optional)
//   coldChain           boolean, defaults true
// Returns the pharmacy_orders row in its resulting state.
async function routeApprovedPrescription(input) {
  const prescription = input.prescription;

  // Idempotency: a prescription is routed to exactly one pharmacy order. If
  // one already exists (a webhook replay, or a re-run of routing), return it
  // unchanged rather than creating a duplicate fulfillment order.
  const existingOrder = await pharmacyOrderModel.findByPrescriptionId(prescription.id);
  if (existingOrder) {
    logger.info('Prescription already routed; returning the existing order', {
      prescriptionId: prescription.id,
      pharmacyOrderId: existingOrder.id,
    });
    return existingOrder;
  }

  // Always persist the order locally first.
  let order = await pharmacyOrderModel.create({
    prescriptionId: prescription.id,
    pharmacyId: input.pharmacyId,
    userId: prescription.user_id,
    shippingAddressId: input.shippingAddressId,
    coldChain: input.coldChain !== false,
  });

  // Submit to the pharmacy when the integration is live. A failure here does
  // not roll back the local row; the order stays queued for retry.
  if (pharmacyClient.isConfigured()) {
    try {
      const result = await pharmacyClient.submitOrder({
        externalOrderRef: order.id,
        prescription: {
          drugCompound: prescription.drug_compound,
          strength: prescription.strength,
          dosageProtocol: prescription.dosage_protocol,
          sigDirections: prescription.sig_directions,
          quantity: prescription.quantity,
          daysSupply: prescription.days_supply,
          refillsAuthorized: prescription.refills_authorized,
        },
        coldChain: order.cold_chain,
        shippingAddressId: input.shippingAddressId || null,
      });
      if (result && result.externalOrderId) {
        order = await pharmacyOrderModel.attachExternalOrderId(
          order.id,
          result.externalOrderId
        );
      }
    } catch (err) {
      logger.error('Pharmacy order submission failed; order left queued', {
        pharmacyOrderId: order.id,
        message: err.message,
      });
    }
  } else {
    logger.info('Pharmacy integration not configured; order left queued', {
      pharmacyOrderId: order.id,
    });
  }

  await audit.record({
    actorUserId: prescription.user_id,
    action: 'pharmacy_order.routed',
    entityType: 'pharmacy_order',
    entityId: order.id,
    metadata: { prescriptionId: prescription.id, status: order.status },
  });

  return order;
}

module.exports = {
  routeApprovedPrescription: routeApprovedPrescription,
};
