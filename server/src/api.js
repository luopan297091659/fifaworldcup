const express = require("express");
const { createOrUpdateUser, getCurrentUser } = require("./auth");
const { badRequest, notFound, unauthorized } = require("./errors");
const { readStore, updateStore } = require("./store");
const {
  validateAppKey,
  validateMatchId,
  validatePredictionPayload,
  validateRoomId
} = require("./validators");

const router = express.Router();

router.use(validateAppKey);

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function ok(data) {
  return { code: 0, data };
}

function getFallbackUser() {
  return {
    id: "me",
    name: "我",
    displayName: "我",
    avatarUrl: "",
    score: 0,
    aiWins: 0,
    percentile: 68,
    predictions: 0,
    title: "稳健预言家",
    badges: ["首场预测", "和 AI 掰手腕"]
  };
}

async function userFor(req) {
  return (await getCurrentUser(req)) || getFallbackUser();
}

function userPredictions(data, userId) {
  return data.predictions[userId] || {};
}

function predictionMap(predictions) {
  return Object.keys(predictions).reduce((result, matchId) => {
    result[matchId] = predictions[matchId].score;
    return result;
  }, {});
}

function scorePrediction(match, prediction) {
  if (!match.finalScore || !prediction) return 0;
  if (prediction.score === match.finalScore) return 30;
  return prediction.result === resultFromScore(match.finalScore) ? 10 : 0;
}

function resultFromScore(score) {
  const [home, away] = score.split(":").map(Number);
  if (home > away) return "主胜";
  if (home < away) return "客胜";
  return "平";
}

function buildMe(data, user) {
  const predictions = userPredictions(data, user.id);
  const settledScore = data.matches.reduce((sum, match) => sum + scorePrediction(match, predictions[match.id]), 0);
  return {
    ...user,
    score: Math.max(user.score || 0, settledScore),
    predictions: Object.keys(predictions).length,
    percentile: user.percentile || 68,
    aiWins: user.aiWins || 0,
    badges: user.badges || []
  };
}

function roomsWithUser(data, me) {
  return data.rooms.map((room) => {
    const players = room.players.map((player) => (
      player.id === "me" ? { ...player, id: me.id, name: me.name, score: me.score } : player
    ));
    return { ...room, players };
  });
}

router.get("/health", asyncRoute(async (req, res) => {
  res.json(ok({ status: "ok", time: new Date().toISOString() }));
}));

router.post("/login", asyncRoute(async (req, res) => {
  const { code, userInfo } = req.body || {};
  if (!code && process.env.NODE_ENV === "production") {
    throw badRequest("Missing login code");
  }
  const result = await createOrUpdateUser({ code, userInfo });
  res.json(ok(result));
}));

router.get("/home", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  const predictions = userPredictions(data, me.id);
  const rooms = roomsWithUser(data, me);

  res.json(ok({
    me,
    matches: data.matches,
    rooms,
    topRoom: rooms[0],
    myRoomRank: rooms[0] ? rooms[0].players.findIndex((player) => player.id === me.id) + 1 : 0,
    predictions: predictionMap(predictions)
  }));
}));

router.get("/matches/detail", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = await userFor(req);
  const matchId = validateMatchId(req.query.matchId);
  const match = data.matches.find((item) => item.id === matchId);
  if (!match) {
    throw notFound("Match not found");
  }

  const predictions = userPredictions(data, me.id);
  res.json(ok({
    match,
    prediction: predictions[match.id] || null
  }));
}));

router.post("/predictions/submit", asyncRoute(async (req, res) => {
  const me = await getCurrentUser(req);
  if (!me) {
    throw unauthorized();
  }
  const payload = validatePredictionPayload(req.body || {});

  const result = await updateStore((data) => {
    const match = data.matches.find((item) => item.id === payload.matchId);
    if (!match) {
      throw notFound("Match not found");
    }
    if (match.status === "closed") {
      throw badRequest("Match is closed");
    }

    if (!data.predictions[me.id]) {
      data.predictions[me.id] = {};
    }

    const prediction = {
      id: `${me.id}_${payload.matchId}`,
      userId: me.id,
      matchId: payload.matchId,
      result: payload.result,
      score: payload.score,
      totalGoals: payload.totalGoals,
      firstScorer: payload.firstScorer || "",
      firstScorerSource: payload.firstScorerSource || "manual",
      confidence: payload.confidence,
      aiPick: match.aiPick,
      aiScore: match.aiScore,
      earned: scorePrediction(match, payload),
      submittedAt: new Date().toISOString()
    };

    data.predictions[me.id][payload.matchId] = prediction;
    if (data.users[me.id]) {
      data.users[me.id].predictions = Object.keys(data.predictions[me.id]).length;
    }
    return { prediction };
  });

  res.json(ok(result));
}));

router.get("/rooms", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  res.json(ok({ rooms: roomsWithUser(data, me) }));
}));

router.post("/rooms/cheer", asyncRoute(async (req, res) => {
  const roomId = validateRoomId((req.body || {}).roomId);
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  const me = buildMe(await readStore(), currentUser);
  const result = await updateStore((data) => {
    const room = data.rooms.find((item) => item.id === roomId);
    if (!room) {
      throw notFound("Room not found");
    }
    room.cheers += 1;
    return { rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.get("/rankings", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  const players = data.rankingPlayers
    .map((player) => (player.id === "me" ? { ...player, id: me.id, name: me.name, score: me.score } : player))
    .sort((a, b) => b.score - a.score);

  res.json(ok({ me, scope: req.query.scope || "friends", players }));
}));

router.get("/profile", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  res.json(ok({
    me,
    aiStats: {
      userWinRate: 42,
      aiWinRate: 58,
      totalCompared: me.predictions
    }
  }));
}));

module.exports = router;
