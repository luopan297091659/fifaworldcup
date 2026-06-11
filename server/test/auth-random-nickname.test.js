const assert = require("node:assert/strict");

async function main() {
  const storePath = require.resolve("../src/store");
  const originalStore = require.cache[storePath];
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ openid: "openid-random-nick-test" })
  });

  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
      normalizeStoreData: (data) => data,
      readStore: async () => ({ users: {}, sessions: {}, predictions: {}, matches: [], rooms: [], rankingPlayers: [] }),
      updateStore: async (mutator) => mutator({
        users: {},
        sessions: {},
        predictions: {},
        matches: [],
        rooms: [],
        rankingPlayers: []
      })
    }
  };

  delete require.cache[require.resolve("../src/auth")];
  const { createOrUpdateUser } = require("../src/auth");

  const result = await createOrUpdateUser({
    code: "test-code",
    userInfo: {
      nickName: "微信用户",
      avatar: "https://example.com/avatar.png"
    }
  });

  assert.ok(result.user.name, "应生成昵称");
  assert.ok(result.user.nickName, "应生成昵称");
  assert.ok(result.user.displayName, "应生成昵称");
  assert.notEqual(result.user.name, "我");
  assert.notEqual(result.user.name, "微信用户");

  require.cache[storePath] = originalStore;
  global.fetch = originalFetch;
  console.log("auth-random-nickname test ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
