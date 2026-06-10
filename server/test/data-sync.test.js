const assert = require("node:assert/strict");
const { normalizeStoreData } = require("../src/store");

async function main() {
  const data = normalizeStoreData({});

  assert.ok(Array.isArray(data.members), "members should be provided");
  assert.ok(Array.isArray(data.groups), "groups should be provided");
  assert.ok(Array.isArray(data.latestMatches), "latestMatches should be provided");

  console.log("data-sync test ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
