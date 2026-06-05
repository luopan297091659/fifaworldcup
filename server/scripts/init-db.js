const loadEnv = require("../src/env");
const { readStore } = require("../src/store");

loadEnv();

async function main() {
  if ((process.env.STORE_DRIVER || "file").toLowerCase() !== "mysql") {
    console.log("STORE_DRIVER is not mysql, skip database init.");
    return;
  }

  const mysql = require("mysql2/promise");
  const database = process.env.DB_NAME || "worldcup";
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "worldcup",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: false
  });

  try {
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, "``")}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }

  const data = await readStore();
  console.log(`database ready: ${data.matches.length} matches, ${data.rooms.length} rooms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
