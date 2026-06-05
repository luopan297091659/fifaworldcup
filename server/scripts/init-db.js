const loadEnv = require("../src/env");
const { readStore } = require("../src/store");

loadEnv();

async function main() {
  if ((process.env.STORE_DRIVER || "file").toLowerCase() !== "mysql") {
    console.log("STORE_DRIVER is not mysql, skip database init.");
    return;
  }

  const data = await readStore();
  console.log(`database ready: ${data.matches.length} matches, ${data.rooms.length} rooms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
