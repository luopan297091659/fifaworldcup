const { badRequest } = require("./errors");

const GOAL_OPTIONS = new Set(["0-1", "2-3", "4+"]);
const SCORER_SOURCES = new Set(["manual", "lineup"]);

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validateAppKey(req, res, next) {
  const expected = process.env.APP_KEY || "worldcup";
  const body = req.body || {};
  const query = req.query || {};
  const actual = req.headers["x-app-key"] || body.appKey || query.appKey;

  if (actual && actual !== expected) {
    res.status(403).json({ code: 403, message: "Invalid app key" });
    return;
  }
  next();
}

function validateMatchId(value) {
  const matchId = asString(value);
  if (!/^m[\w-]{1,32}$/.test(matchId)) {
    throw badRequest("Invalid matchId");
  }
  return matchId;
}

function validateRoomId(value) {
  const roomId = asString(value);
  if (!/^r[\w-]{1,32}$/.test(roomId)) {
    throw badRequest("Invalid roomId");
  }
  return roomId;
}

function validateRoomName(value) {
  const name = asString(value);
  if (!name || name.length > 24 || /[<>{}[\]\\]/.test(name)) {
    throw badRequest("Invalid room name");
  }
  return name;
}

function validateRoomPayload(body = {}) {
  const name = validateRoomName(body.name);
  const topic = asString(body.topic || "一起预测世界杯赛果").slice(0, 60);
  const type = asString(body.type || "好友").slice(0, 12);

  return { name, topic, type };
}

function validateResult(value) {
  const result = asString(value);
  if (!result || result.length > 12 || /[<>{}[\]\\]/.test(result)) {
    throw badRequest("Invalid result");
  }
  return result;
}

function validatePredictionPayload(body = {}) {
  const matchId = validateMatchId(body.matchId);
  const result = validateResult(body.result);
  const score = asString(body.score);
  const totalGoals = asString(body.totalGoals);
  const firstScorer = asString(body.firstScorer).slice(0, 20);
  const firstScorerSource = SCORER_SOURCES.has(body.firstScorerSource) ? body.firstScorerSource : "manual";
  const confidence = Number(body.confidence);

  if (!/^\d{1,2}:\d{1,2}$/.test(score)) {
    throw badRequest("Invalid score");
  }

  const [homeGoals, awayGoals] = score.split(":").map(Number);
  if (homeGoals > 20 || awayGoals > 20) {
    throw badRequest("Score is out of range");
  }
  if (!GOAL_OPTIONS.has(totalGoals)) {
    throw badRequest("Invalid totalGoals");
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    throw badRequest("Invalid confidence");
  }

  return {
    matchId,
    result,
    score,
    totalGoals,
    firstScorer,
    firstScorerSource,
    confidence
  };
}

module.exports = {
  validateAppKey,
  validateMatchId,
  validateRoomId,
  validateRoomName,
  validateRoomPayload,
  validatePredictionPayload
};
