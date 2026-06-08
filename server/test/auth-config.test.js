const assert = require('node:assert/strict');
const test = require('node:test');

const { createOrUpdateUser } = require('../src/auth');
const { normalizeStoreData } = require('../src/store');

function resetEnv() {
  delete process.env.WECHAT_APPID;
  delete process.env.WECHAT_SECRET;
  delete process.env.WECHAT_APPSECRET;
  delete process.env.WECHAT_APP_SECRET;
  delete process.env.JWT_SECRET;
}

test('normalizeStoreData repairs null collections to safe defaults', () => {
  const normalized = normalizeStoreData({
    users: null,
    sessions: null,
    predictions: null,
    matches: null,
    rooms: null,
    rankingPlayers: null
  });

  assert.deepEqual(normalized.users, {});
  assert.deepEqual(normalized.sessions, {});
  assert.deepEqual(normalized.predictions, {});
  assert.ok(Array.isArray(normalized.matches));
  assert.ok(Array.isArray(normalized.rooms));
  assert.ok(Array.isArray(normalized.rankingPlayers));
});

test('createOrUpdateUser uses WeChat app secret aliases when exchanging login code', async () => {
  resetEnv();
  process.env.WECHAT_APPID = 'wx-test-app';
  process.env.WECHAT_APPSECRET = 'alias-secret';

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (input) => {
    calls.push(String(input));
    return {
      ok: true,
      json: async () => ({ openid: 'openid-from-alias' })
    };
  };

  try {
    const result = await createOrUpdateUser({ code: 'test-code' });

    assert.equal(calls.length, 1);
    assert.match(calls[0], /appid=wx-test-app/);
    assert.match(calls[0], /secret=alias-secret/);
    assert.ok(result && result.token);
    assert.equal(result.user.providerOpenid, 'openid-from-alias');
  } finally {
    global.fetch = originalFetch;
    resetEnv();
  }
});
