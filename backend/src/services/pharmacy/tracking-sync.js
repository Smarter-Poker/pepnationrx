'use strict';

// ============================================================================
// Pharmacy tracking sync.
// ----------------------------------------------------------------------------
// Applies a fulfillment or cold-chain shipping update delivered by the
// pharmacy webhook onto the local pharmacy_orders row.
// ============================================================================

const logger = require('../../utils/logger');
const pharmacyOrderModel = require('../../models/pharmacy-order.model');
const audit = require('../audit.service');
const notificationService = require('../notification');

// Order milestones a patient is notified about. Intermediate states
// (queued, submitted, accepted, compounding) are not emailed to avoid noise.
const NOTIFY_STATUSES = ['shipped', 'delivered', 'exception'];

// Valid pharmacy_order_status values, mirrored from database/schema.sql.
const ORDER_STATUSES = [
  'queued', 'submitted', 'accepted', 'compounding',
  'shipped', 'delivered', 'exception', 'canceled',
];

// Translate a pharmacy status string onto the pharmacy_order_status enum.
// Unknown values fall back to 'exception' so they are visible for review.
function normalizeStatus(rawStatus) {
  if (ORDER_STATUSES.indexOf(rawStatus) !== -1) return rawStatus;
  const aliases = {
    in_production: 'compounding',
    fulfilling: 'compounding',
    in_transit: 'shipped',
    out_for_delivery: 'shipped',
    complete: 'delivered',
    cancelled: 'canceled',
  };
  return aliases[rawStatus] || 'exception';
}

// Apply a tracking update. `payload` is the verified webhook body:
//   externalOrderId    the pharmacy's order id
//   status             a pharmacy status string
//   trackingCarrier    carrier name (optional, defaults preserved)
//   trackingNumber     carrier tracking number (optional)
//   estimatedDelivery  ISO date string YYYY-MM-DD (optional)
// Returns the updated order, or null when the order is unknown.
async function applyTrackingUpdate(payload) {
  const order = await pharmacyOrderModel.findByExternalOrderId(payload.externalOrderId);
  if (!order) {
    logger.warn('Tracking update for an unknown pharmacy order', {
      externalOrderId: payload.externalOrderId,
    });
    return null;
  }

  const status = normalizeStatus(payload.status);
  const updated = await pharmacyOrderModel.applyTrackingUpdate(order.id, {
    status: status,
    trackingCarrier: payload.trackingCarrier,
    trackingNumber: payload.trackingNumber,
    estimatedDelivery: payload.estimatedDelivery,
  });

  await audit.record({
    actorUserId: order.user_id,
    action: 'pharmacy_order.tracking_updated',
    entityType: 'pharmacy_order',
    entityId: order.id,
    metadata: { status: status },
  });

  // Notify the patient on meaningful shipping milestones only. The dedupe key
  // ties the email to this order and status, so a webhook replay - or a
  // repeated status - never sends a second email for the same milestone.
  if (NOTIFY_STATUSES.indexOf(status) !== -1) {
    await notificationService.send({
      userId: order.user_id,
      template: 'shipment_update',
      payload: {
        status: status,
        trackingNumber: payload.trackingNumber || '',
      },
      dedupeKey: 'shipment:' + order.id + ':' + status,
    });
  }

  return updated;
}

module.exports = {
  ORDER_STATUSES: ORDER_STATUSES,
  normalizeStatus: normalizeStatus,
  applyTrackingUpdate: applyTrackingUpdate,
};
