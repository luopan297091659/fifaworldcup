const express = require("express");
const path = require("path");
const loadEnv = require("./env");
const apiRouter = require("./api");
const { HttpError } = require("./errors");
const createRateLimit = require("./rateLimit");

loadEnv();

const app = express();
const port = Number(process.env.PORT || 8005);
const host = process.env.HOST || "127.0.0.1";

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-App-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(createRateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  message: "Too many requests"
}));

app.use("/worldcup/assert", express.static(path.join(__dirname, "..", "assert"), {
  maxAge: "7d",
  fallthrough: false
}));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use("/worldcup", apiRouter);

app.use((req, res) => {
  res.status(404).json({ code: 404, message: "Not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof HttpError) {
    res.status(error.status).json({ code: error.status, message: error.message });
    return;
  }
  res.status(500).json({ code: 500, message: "Internal server error" });
});

if (require.main === module) {
  const server = app.listen(port, host, () => {
    console.log(`WorldCup API listening on http://${host}:${port}`);
  });

  function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
