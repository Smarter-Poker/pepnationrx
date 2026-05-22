'use strict';

// ============================================================================
// Pharmacy order model - data-access layer for the pharmacy_orders table.
// ----------------------------------------------------------------------------
// A pharmacy order is created when an approved prescription is routed to a
// 503A compounding pharmacy. Cold-chain FedEx tracking is synced back onto the
// row from pharmacy webhook events.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, prescription_id, pharmacy_id, user_id, shipping_address_id, status, ' +
  'external_order_id, tracking_carrier, tracking_number, cold_chain, ' +
  'estimated_delivery, shipped_at, delivered_at, created_at, updated_at';

// Insert a pharmacy order in the queued state.
async function create(data) {
  return queryOne(
    'INSERT INTO pharmacy_orders ' +
      '(prescription_id, pharmacy_id, user_id, shipping_address_id, ' +
      ' status, cold_chain) ' +
      "VALUES ($1, $2, $3, $4, 'queued', $5) " +
      'RETURNING ' + COLUMNS,
    [
      data.prescriptionId,
      data.pharmacyId,
      data.userId,
      data.shippingAddressId || null,
      data.coldChain !== false,
    ]
  );
}

// Find an order by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM pharmacy_orders WHERE id = $1', [id]);
}

// Find an order by the id the pharmacy assigned it.
async function findByExternalOrderId(externalOrderId) {
  return queryOne(
    'SELECT ' + COLUMNS + ' FROM pharmacy_orders WHERE external_order_id = $1',
    [externalOrderId]
  );
}

// All pharmacy orders for a patient, newest first. Backs the patient
// dashboard's shipment history.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM pharmacy_orders WHERE user_id = $1 ' +
      'ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// Record the pharmacy's order id once the order has been accepted, and move
// the order into the submitted state.
async function attachExternalOrderId(id, externalOrderId) {
  return queryOne(
    'UPDATE pharmacy_orders ' +
      "SET external_order_id = $2, status = 'submitted' " +
      'WHERE id = $1 RETURNING ' + COLUMNS,
    [id, externalOrderId]
  );
}

// Apply a tracking update from a pharmacy webhook. shipped_at / delivered_at
// are stamped automatically when the status crosses those milestones.
async function applyTrackingUpdate(id, update) {
  const status = update.status;
  const setShipped = status === 'shipped' ? ', shipped_at = now()' : '';
  const setDelivered = status === 'delivered' ? ', delivered_at = now()' : '';
  return queryOne(
    'UPDATE pharmacy_orders SET ' +
      'status = $2, ' +
      'tracking_carrier = COALESCE($3, tracking_carrier), ' +
      'tracking_number = COALESCE($4, tracking_number), ' +
      'estimated_delivery = COALESCE($5, estimated_delivery)' +
      setShipped +
      setDelivered +
      ' WHERE id = $1 RETURNING ' + COLUMNS,
    [
      id,
      status,
      update.trackingCarrier || null,
      update.trackingNumber || null,
      update.estimatedDelivery || null,
    ]
  );
}

module.exports = {
  create: create,
  findById: findById,
  findByExternalOrderId: findByExternalOrderId,
  findByUserId: findByUserId,
  attachExternalOrderId: attachExternalOrderId,
  applyTrackingUpdate: applyTrackingUpdate,
};
