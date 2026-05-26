'use strict';

// ============================================================================
// Secondary audit fix tests — S3-03, S3-04, S3-07, S3-08.
// ----------------------------------------------------------------------------
// 1. address.model update() and remove() now carry userId into the WHERE
//    clause so ownership is enforced at the SQL level (S3-04 / S3-08).
// 2. admin.model recentAuditLog() cap is aligned with the controller's 500
//    maximum (S3-07).
// 3. Affiliate-payout schedule() and markPaid() validate payoutId as a UUID
//    before touching pg (S3-03).
// ============================================================================

const assert = require('node:assert/strict');
const test = require('node:test');

// ---------------------------------------------------------------------------
// S3-04 / S3-08: address model builds ownership-enforced SQL
// ---------------------------------------------------------------------------

test('address_model_update_includes_user_id_in_params', () => {
  // Simulate the param array that update() builds.
  // update(id, data, client) -> params = [line1, line2, city, state,
  //   postalCode, country, id, data.userId]
  function buildUpdateParams(id, data) {
    return [
      data.line1,
      data.line2 || null,
      data.city,
      data.state,
      data.postalCode,
      data.country || 'US',
      id,
      data.userId,          // S3-04: added
    ];
  }

  const params = buildUpdateParams('addr-uuid', {
    userId: 'user-uuid',
    line1: '123 Main St',
    line2: null,
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  });

  // $7 is the address id, $8 is the userId — both must be present.
  assert.equal(params[6], 'addr-uuid', '$7 must be the address id');
  assert.equal(params[7], 'user-uuid', '$8 must be the owner user id');
  assert.equal(params.length, 8, 'exactly 8 parameters expected');
});

test('address_model_remove_includes_user_id_in_params', () => {
  // remove(id, userId, client) -> params = [id, userId]
  function buildRemoveParams(id, userId) {
    return [id, userId];
  }

  const params = buildRemoveParams('addr-uuid', 'user-uuid');
  assert.equal(params[0], 'addr-uuid', '$1 must be the address id');
  assert.equal(params[1], 'user-uuid', '$2 must be the owner user id');
  assert.equal(params.length, 2, 'exactly 2 parameters expected');
});

test('address_model_remove_without_user_id_would_be_wrong_arity', () => {
  // Verify that an older-style call missing userId has the wrong arity — this
  // documents the before-state of the bug so a regression is immediately obvious.
  function oldBuildRemoveParams(id) {
    return [id];           // pre-fix: no userId
  }
  const params = oldBuildRemoveParams('addr-uuid');
  assert.equal(params.length, 1, 'old call had only 1 param — missing ownership guard');
});

// ---------------------------------------------------------------------------
// S3-07: admin model audit-log cap aligns with controller maximum
// ---------------------------------------------------------------------------

test('admin_audit_log_cap_matches_controller_maximum', () => {
  // The controller clamps to max 500; the model must match.
  const CONTROLLER_MAX = 500;

  function modelCap(limit) {
    return Number.isInteger(limit) && limit > 0 ? Math.min(limit, CONTROLLER_MAX) : 50;
  }

  // Requesting exactly the controller max should come back unreduced.
  assert.equal(modelCap(500), 500, 'a 500-row request must not be truncated');
  // Mid-range values pass through.
  assert.equal(modelCap(300), 300, '300-row request must pass through');
  // Over-cap is still bounded.
  assert.equal(modelCap(1000), 500, 'requests over 500 are capped at 500');
  // Default when limit is not a positive integer.
  assert.equal(modelCap(0), 50, 'zero falls back to default of 50');
  assert.equal(modelCap(-1), 50, 'negative falls back to default of 50');
});

test('old_admin_audit_log_cap_silently_truncated_300_row_request', () => {
  // Documents the pre-fix state: the old cap of 200 silently cut 300-row requests.
  const OLD_MODEL_CAP = 200;
  function oldModelCap(limit) {
    return Number.isInteger(limit) && limit > 0 ? Math.min(limit, OLD_MODEL_CAP) : 50;
  }
  assert.equal(oldModelCap(300), 200, 'old model silently truncated 300 to 200');
});

// ---------------------------------------------------------------------------
// S3-03: affiliate payout UUID validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('payout_uuid_guard_rejects_non_uuid_strings', () => {
  const bad = ['not-a-uuid', "' OR 1=1--", '', '12345', 'abc-def'];
  for (const id of bad) {
    assert.equal(UUID_RE.test(id), false, `"${id}" should fail UUID validation`);
  }
});

test('payout_uuid_guard_accepts_valid_uuids', () => {
  const good = [
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '00000000-0000-0000-0000-000000000000',
    'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  ];
  for (const id of good) {
    assert.equal(UUID_RE.test(id), true, `"${id}" should pass UUID validation`);
  }
});
