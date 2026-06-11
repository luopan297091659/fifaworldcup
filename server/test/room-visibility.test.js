const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCreatePublicState } = require('../../miniprogram/utils/roomVisibility');

test('checkbox state should treat empty arrays as false and non-empty arrays as true', () => {
  assert.equal(normalizeCreatePublicState(true), true);
  assert.equal(normalizeCreatePublicState(false), false);
  assert.equal(normalizeCreatePublicState([]), false);
  assert.equal(normalizeCreatePublicState(['on']), true);
  assert.equal(normalizeCreatePublicState('true'), true);
  assert.equal(normalizeCreatePublicState('false'), false);
});
