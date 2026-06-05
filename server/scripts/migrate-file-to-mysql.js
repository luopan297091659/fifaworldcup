const fs = require("fs");
const path = require("path");
const loadEnv = require("../src/env");
const { writeStore } = require("../src/store");

loadEnv();

async function main() {
  if ((process.env.STORE_DRIVER || "file").toLowerCase() !== "mysql") {
    throw new Error("Set STORE_DRIVER=mysql before running this migration.");
  }

  const filePath = path.join(__dirname, "..", "data", "store.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`File store not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  await writeStore(data);
  console.log(`migrated file store to mysql: ${data.matches.length} matches, ${data.rooms.length} rooms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
