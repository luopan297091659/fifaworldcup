const assert = require('node:assert/strict');
const test = require('node:test');

const { createOrUpdateUser } = require('../src/auth');

function resetEnv() {
  delete process.env.WECHAT_APPID;
  delete process.env.WECHAT_SECRET;
  delete process.env.WECHAT_APPSECRET;
  delete process.env.WECHAT_APP_SECRET;
  delete process.env.JWT_SECRET;
}

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
