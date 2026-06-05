const { badRequest } = require("./errors");

const RESULT_OPTIONS = new Set(["主胜", "平", "客胜"]);
const GOAL_OPTIONS = new Set(["0-1", "2-3", "4+"]);
const SCORER_SOURCES = new Set(["manual", "lineup"]);

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validateAppKey(req, res, next) {
  const expected = process.env.APP_KEY || "worldcup";
  const actual = req.headers["x-app-key"] || req.body.appKey || req.query.appKey;

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

function validatePredictionPayload(body = {}) {
  const matchId = validateMatchId(body.matchId);
  const result = asString(body.result);
  const score = asString(body.score);
  const totalGoals = asString(body.totalGoals);
  const firstScorer = asString(body.firstScorer).slice(0, 20);
  const firstScorerSource = SCORER_SOURCES.has(body.firstScorerSource) ? body.firstScorerSource : "manual";
  const confidence = Number(body.confidence);

  if (!RESULT_OPTIONS.has(result)) {
    throw badRequest("Invalid result");
  }
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
  validatePredictionPayload
};
