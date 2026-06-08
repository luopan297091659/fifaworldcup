const fs = require("fs");
const path = require("path");
const seed = require("./seed");

const dataDir = path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");
let mysqlPool = null;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(cloneSeed(), null, 2));
  }
}

function cloneSeed() {
  return JSON.parse(JSON.stringify(seed));
}

function normalizeStoreData(data = {}) {
  const base = cloneSeed();
  return {
    ...base,
    ...data,
    users: isObject(data.users) ? data.users : {},
    sessions: isObject(data.sessions) ? data.sessions : {},
    predictions: isObject(data.predictions) ? data.predictions : {},
    matches: Array.isArray(data.matches) ? data.matches : base.matches,
    rooms: Array.isArray(data.rooms) ? data.rooms : base.rooms,
    rankingPlayers: Array.isArray(data.rankingPlayers) ? data.rankingPlayers : base.rankingPlayers,
    tournament: isObject(data.tournament) ? data.tournament : base.tournament,
    appKey: data.appKey || base.appKey
  };
}

function readFileStore() {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  return normalizeStoreData(JSON.parse(raw));
}

function writeFileStore(data) {
  ensureStore();
  const tempPath = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, storePath);
}

function updateFileStore(mutator) {
  const data = readFileStore();
  const result = mutator(data);
  writeFileStore(data);
  return result;
}

function useMysql() {
  return (process.env.STORE_DRIVER || "file").toLowerCase() === "mysql";
}

async function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  const mysql = require("mysql2/promise");
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "worldcup",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "worldcup",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    namedPlaceholders: true,
    charset: "utf8mb4"
  });
  await ensureMysqlStore();
  return mysqlPool;
}

async function ensureMysqlStore() {
  const pool = mysqlPool;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS worldcup_app_state (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      data JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [rows] = await pool.execute("SELECT id FROM worldcup_app_state WHERE id = ?", ["main"]);
  if (!rows.length) {
    await pool.execute("INSERT INTO worldcup_app_state (id, data) VALUES (?, ?)", [
      "main",
      JSON.stringify(cloneSeed())
    ]);
  }
}

async function readMysqlStore() {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute("SELECT data FROM worldcup_app_state WHERE id = ?", ["main"]);
  if (!rows.length) return cloneSeed();
  const raw = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
  return normalizeStoreData(raw);
}

async function updateMysqlStore(mutator) {
  const pool = await getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT data FROM worldcup_app_state WHERE id = ? FOR UPDATE", ["main"]);
    const data = normalizeStoreData(rows.length
      ? (typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data)
      : cloneSeed());
    const result = mutator(data);
    await connection.execute("REPLACE INTO worldcup_app_state (id, data) VALUES (?, ?)", [
      "main",
      JSON.stringify(data)
    ]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function readStore() {
  return useMysql() ? readMysqlStore() : readFileStore();
}

async function writeStore(data) {
  if (useMysql()) {
    const pool = await getMysqlPool();
    await pool.execute("REPLACE INTO worldcup_app_state (id, data) VALUES (?, ?)", [
      "main",
      JSON.stringify(data)
    ]);
    return;
  }
  writeFileStore(data);
}

async function updateStore(mutator) {
  return useMysql() ? updateMysqlStore(mutator) : updateFileStore(mutator);
}

module.exports = {
  normalizeStoreData,
  readStore,
  writeStore,
  updateStore
};
