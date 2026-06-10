const assert = require("node:assert/strict");

const api = require("../../miniprogram/utils/api");

async function main() {
  const cleaned = api.sanitizeRequestPayload({
    appKey: "worldcup",
    roomId: undefined,
    scope: "friends",
    empty: null
  });

  assert.deepEqual(cleaned, { appKey: "worldcup", scope: "friends" });
  console.log("request-payload test ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
