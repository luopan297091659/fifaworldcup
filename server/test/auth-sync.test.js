const assert = require("node:assert/strict");

async function main() {
  const storePath = require.resolve("../src/store");
  const originalStore = require.cache[storePath];
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ openid: "openid-sync-test" })
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
      nickName: "阿明",
      avatar: "https://example.com/avatar.png"
    }
  });

  assert.equal(result.user.name, "阿明");
  assert.equal(result.user.displayName, "阿明");
  assert.equal(result.user.avatarUrl, "https://example.com/avatar.png");
  assert.equal(result.user.avatar, "https://example.com/avatar.png");
  assert.equal(result.user.nickName, "阿明");

  require.cache[storePath] = originalStore;
  global.fetch = originalFetch;
  console.log("auth-sync test ok");
}

main().catch((error) => {
  if (global.fetch) {
    // no-op
  }
  console.error(error);
  process.exit(1);
});
