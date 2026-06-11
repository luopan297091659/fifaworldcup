const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createOrUpdateUser, getCurrentUser } = require("./auth");
const { badRequest, notFound, unauthorized } = require("./errors");
const { readStore, updateStore } = require("./store");
const {
  normalizeVisibilityFlag,
  validateAppKey,
  validateMatchId,
  validatePredictionPayload,
  validateRoomId,
  validateRoomPayload
} = require("./validators");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "assert", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

function uploadExtension(file) {
  const mimeType = file.mimetype || "";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/heic") return ".heic";
  if (mimeType === "image/heif") return ".heif";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";

  const originalExt = path.extname(file.originalname || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].includes(originalExt)) {
    return originalExt === ".jpeg" ? ".jpg" : originalExt;
  }
  return ".jpg";
}

const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const safeName = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${uploadExtension(file)}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const mimeType = file.mimetype || "";
    const originalExt = path.extname(file.originalname || "").toLowerCase();
    const isWechatAvatarUpload = !mimeType || mimeType === "application/octet-stream";
    const hasImageExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].includes(originalExt);
    if (!/^image\//.test(mimeType) && !isWechatAvatarUpload && !hasImageExt) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  }
});

router.use(validateAppKey);

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function ok(data) {
  return { code: 0, data };
}

function getGuestUser() {
  return {
    id: "guest",
    name: "未登录用户",
    displayName: "未登录用户",
    avatarUrl: "",
    score: 0,
    aiWins: 0,
    percentile: 0,
    predictions: 0,
    title: "待登录",
    badges: []
  };
}

async function userFor(req) {
  return (await getCurrentUser(req)) || getGuestUser();
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

function resultFromScore(score) {
  const [home, away] = score.split(":").map(Number);
  if (home > away) return "主胜";
  if (home < away) return "客胜";
  return "平";
}

function scorePrediction(match, prediction) {
  if (!match.finalScore || !prediction) return 0;
  if (prediction.score === match.finalScore) return 30;
  return prediction.result === resultFromScore(match.finalScore) ? 10 : 0;
}

function buildMe(data, user) {
  const predictions = userPredictions(data, user.id);
  const settledScore = data.matches.reduce((sum, match) => sum + scorePrediction(match, predictions[match.id]), 0);
  return {
    ...user,
    score: Math.max(user.score || 0, settledScore),
    predictions: Object.keys(predictions).length,
    percentile: user.percentile || 0,
    aiWins: user.aiWins || 0,
    badges: user.badges || []
  };
}

function buildPublicGroupFeed(data, rooms) {
  const seedGroups = Array.isArray(data.groups) ? data.groups : [];
  const publicRooms = (Array.isArray(rooms) ? rooms : [])
    .filter((room) => roomIsPublic(room))
    .map((room) => ({
      ...room,
      id: room.id,
      name: room.name || "公开群",
      description: room.topic || room.description || "公开群已同步到服务端，所有登录用户都可查看群内预测数据、战报与热度信息。",
      memberCount: Number(room.members || room.memberCount || 0),
      heat: Number(room.heat || 0),
      status: room.joined ? "已加入" : (room.status || "活跃"),
      accessMode: room.type || "公开群 · 查看所有人预测数据",
      shareText: room.shareText || "公开群已同步到服务端，所有登录用户都可查看群内预测数据、热度与战报。",
      feedMessages: Array.isArray(room.feedMessages) ? room.feedMessages.slice() : [],
      isPublic: true,
      ownerId: room.ownerId || ""
    }));

  const merged = [...seedGroups, ...publicRooms].filter((item) => item && item.id);
  const deduped = new Map();

  merged.forEach((item) => {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
      return;
    }

    deduped.set(item.id, {
      ...deduped.get(item.id),
      ...item,
      memberCount: Number(item.memberCount || item.members || deduped.get(item.id).memberCount || 0),
      heat: Number(item.heat || deduped.get(item.id).heat || 0),
      isPublic: true
    });
  });

  return Array.from(deduped.values());
}

function roomIsPublic(room) {
  if (typeof room.isPublic !== "undefined") {
    return normalizeVisibilityFlag(room.isPublic);
  }
  return String(room.type || "").trim() !== "私密";
}

function roomsWithUser(data, me, options = {}) {
  const requestedRoomId = options.requestedRoomId || "";

  return (data.rooms || [])
    .filter((room) => {
      const players = getRoomPlayers(room, data).filter((player) => player.id !== "guest");
      const joined = players.some((player) => player.id === me.id);
      if (roomIsPublic(room)) {
        return true;
      }
      return joined || Boolean(requestedRoomId && room.id === requestedRoomId);
    })
    .map((room) => {
      const players = getRoomPlayers(room, data).filter((player) => player.id !== "guest");
      const joined = players.some((player) => player.id === me.id);
      return {
        ...room,
        isPublic: roomIsPublic(room),
        members: Math.max(room.members || 0, players.length),
        ownerId: room.ownerId || "",
        joined,
        canManage: Boolean(room.ownerId && room.ownerId === me.id),
        players: players.map((player) => ({ ...player, isMe: player.id === me.id }))
      };
    });
}

function getRoomPlayers(room, data) {
  const explicitPlayers = Array.isArray(room.players) && room.players.length
    ? room.players
    : [];

  if (explicitPlayers.length) {
    return explicitPlayers;
  }

  const members = Array.isArray(data.members) ? data.members : [];
  return members
    .filter((member) => member.groupId === room.id || member.groupName === room.name)
    .map((member) => ({
      id: member.id,
      name: member.name || member.displayName || "",
      score: Number(member.score || member.points || 0),
      role: member.role || "",
      status: member.status || "在线",
      avatarUrl: member.avatarUrl || member.avatar || "",
      groupId: member.groupId || room.id,
      groupName: member.groupName || room.name || ""
    }));
}

function roomPlayerFromUser(me) {
  return {
    id: me.id,
    name: me.name || me.displayName || "我",
    score: me.score || 0
  };
}

function isMeaningfulProfileName(name) {
  return typeof name === "string"
    && name.trim()
    && name.trim() !== "我"
    && name.trim() !== "微信用户"
    && name.trim() !== "未登录用户";
}

function makeRoomId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function publicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function tournamentInfo(data, req) {
  const tournament = data.tournament || {};
  const heroImagePath = tournament.heroImagePath || "/worldcup/assert/host.png";
  return {
    name: tournament.name || "FIFA World Cup 2026",
    openingKickoffAt: tournament.openingKickoffAt || "2026-06-11T19:00:00.000Z",
    openingText: tournament.openingText || "2026 世界杯开幕战",
    openingMatch: tournament.openingMatch || "墨西哥 vs 南非",
    openingVenue: tournament.openingVenue || "Mexico City Stadium",
    heroImageUrl: /^https?:\/\//.test(heroImagePath)
      ? heroImagePath
      : `${publicBaseUrl(req)}${heroImagePath}`
  };
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
  const publicGroups = buildPublicGroupFeed(data, rooms);

  res.json(ok({
    me,
    matches: data.matches,
    rooms,
    publicGroups,
    topRoom: rooms[0] || null,
    myRoomRank: rooms[0] ? rooms[0].players.findIndex((player) => player.id === me.id) + 1 : 0,
    predictions: predictionMap(predictions),
    members: Array.isArray(data.members) ? data.members : [],
    groups: publicGroups,
    latestMatches: Array.isArray(data.latestMatches) ? data.latestMatches : (Array.isArray(data.matches) ? data.matches.slice(0, 3) : []),
    opening: tournamentInfo(data, req)
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
  const rawRoomId = typeof req.query.roomId === "string" ? req.query.roomId.trim() : "";
  const requestedRoomId = rawRoomId && rawRoomId !== "undefined" ? rawRoomId : "";
  const sinceValue = typeof req.query.since === "string" ? req.query.since.trim() : "";
  const rooms = roomsWithUser(data, me, { requestedRoomId });

  if (!sinceValue) {
    res.json(ok({ rooms }));
    return;
  }

  const sinceTime = Date.parse(sinceValue);
  const filteredRooms = Number.isFinite(sinceTime)
    ? rooms.filter((room) => {
        const updatedAt = room.updatedAt ? Date.parse(room.updatedAt) : Number.NaN;
        return Number.isFinite(updatedAt) && updatedAt > sinceTime;
      })
    : rooms;

  res.json(ok({ rooms: filteredRooms }));
}));

router.post("/rooms/create", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  const payload = validateRoomPayload(req.body || {});
  const me = buildMe(await readStore(), currentUser);

  const result = await updateStore((data) => {
    const room = {
      id: makeRoomId(),
      name: payload.name,
      type: payload.type,
      isPublic: payload.isPublic,
      topic: payload.topic,
      members: 1,
      heat: 50,
      cheers: 0,
      ownerId: me.id,
      players: [roomPlayerFromUser(me)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.rooms.unshift(room);
    return { room, rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.post("/rooms/update", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  const roomId = validateRoomId((req.body || {}).roomId);
  const payload = validateRoomPayload(req.body || {});
  const me = buildMe(await readStore(), currentUser);

  const result = await updateStore((data) => {
    const room = data.rooms.find((item) => item.id === roomId);
    if (!room) {
      throw notFound("Room not found");
    }
    if (room.ownerId !== me.id) {
      throw badRequest("Only the room creator can update it");
    }
    room.name = payload.name;
    room.topic = payload.topic;
    room.type = payload.type;
    room.isPublic = typeof payload.isPublic === "boolean" ? payload.isPublic : room.isPublic !== false;
    room.updatedAt = new Date().toISOString();
    return { room, rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.post("/rooms/delete", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  const roomId = validateRoomId((req.body || {}).roomId);
  const me = buildMe(await readStore(), currentUser);

  const result = await updateStore((data) => {
    const roomIndex = data.rooms.findIndex((item) => item.id === roomId);
    if (roomIndex < 0) {
      throw notFound("Room not found");
    }
    if (data.rooms[roomIndex].ownerId !== me.id) {
      throw badRequest("Only the room creator can delete it");
    }
    data.rooms.splice(roomIndex, 1);
    return { rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.post("/rooms/join", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  const roomId = validateRoomId((req.body || {}).roomId);
  const me = buildMe(await readStore(), currentUser);

  const result = await updateStore((data) => {
    const room = data.rooms.find((item) => item.id === roomId);
    if (!room) {
      throw notFound("Room not found");
    }
    if (!room.players.some((player) => player.id === me.id)) {
      room.players.push(roomPlayerFromUser(me));
      room.members = Math.max(room.members || 0, room.players.length);
      room.heat = Math.min(100, Math.max(room.heat || 50, 50) + 3);
      room.updatedAt = new Date().toISOString();
    }
    return { room, rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.post("/rooms/messages", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }

  const roomId = validateRoomId((req.body || {}).roomId);
  const text = String((req.body || {}).text || "").trim();
  if (!text) {
    throw badRequest("Message text is required");
  }

  const me = buildMe(await readStore(), currentUser);
  const result = await updateStore((data) => {
    const room = data.rooms.find((item) => item.id === roomId);
    if (!room) {
      throw notFound("Room not found");
    }

    const message = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      sender: me.name || me.displayName || "我",
      userId: me.id,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      type: "member"
    };

    room.messages = Array.isArray(room.messages) ? [...room.messages, message] : [message];
    room.feedMessages = Array.isArray(room.feedMessages) ? [...room.feedMessages, text] : [text];
    room.updatedAt = new Date().toISOString();

    return { room, rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
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
    room.cheers = (room.cheers || 0) + 1;
    return { rooms: roomsWithUser(data, me) };
  });

  res.json(ok(result));
}));

router.get("/rankings", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  const roomId = typeof req.query.roomId === "string" ? req.query.roomId.trim() : "";
  const room = roomId
    ? (data.rooms || []).find((item) => item.id === roomId)
    : null;

  const players = (roomId && room)
    ? getRoomPlayers(room, data)
        .filter((player) => player.id !== "guest")
        .map((player) => {
          const user = data.users[player.id] || {};
          return buildMe(data, {
            ...user,
            id: player.id,
            name: player.name || user.name || user.displayName || "",
            displayName: player.name || user.displayName || user.name || "",
            avatarUrl: player.avatarUrl || user.avatarUrl || user.avatar || "",
            avatar: player.avatarUrl || user.avatarUrl || user.avatar || "",
            score: Number(player.score || user.score || 0),
            predictions: Number(user.predictions || 0),
            aiWins: Number(user.aiWins || 0),
            percentile: Number(user.percentile || 0),
            badges: Array.isArray(user.badges) ? user.badges : []
          });
        })
        .sort((a, b) => b.score - a.score)
    : Object.values(data.users || {})
        .map((user) => buildMe(data, user))
        .sort((a, b) => b.score - a.score);

  res.json(ok({
    me,
    scope: req.query.scope || "friends",
    roomId: room ? room.id : "",
    roomName: room ? room.name : "",
    players
  }));
}));

router.get("/profile", asyncRoute(async (req, res) => {
  const data = await readStore();
  const me = buildMe(data, await userFor(req));
  const totalCompared = me.predictions || 0;
  res.json(ok({
    me,
    aiStats: {
      userWinRate: totalCompared ? Math.round((me.aiWins || 0) / totalCompared * 100) : 0,
      aiWinRate: totalCompared ? Math.max(0, 100 - Math.round((me.aiWins || 0) / totalCompared * 100)) : 0,
      totalCompared
    }
  }));
}));

router.post("/profile/update", asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }

  const { name, avatarUrl } = req.body || {};
  const nextName = isMeaningfulProfileName(name) ? name.trim() : "";
  const nextAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";

  const result = await updateStore((data) => {
    const user = data.users[currentUser.id];
    if (!user) {
      throw notFound("User not found");
    }
    if (nextName) {
      user.name = nextName;
      user.displayName = nextName;
      user.nickName = nextName;
    }
    if (nextAvatarUrl) {
      user.avatarUrl = nextAvatarUrl;
      user.avatar = nextAvatarUrl;
    }
    user.updatedAt = new Date().toISOString();
    return { user };
  });

  res.json(ok(result));
}));

router.post("/profile/avatar", upload.single("file"), asyncRoute(async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    throw unauthorized();
  }
  if (!req.file) {
    throw badRequest("Missing uploaded file");
  }

  const avatarUrl = `/worldcup/assert/uploads/${req.file.filename}`;
  const result = await updateStore((data) => {
    const user = data.users[currentUser.id];
    if (!user) {
      throw notFound("User not found");
    }
    user.avatarUrl = avatarUrl;
    user.updatedAt = new Date().toISOString();
    return { avatarUrl, user };
  });

  res.json(ok(result));
}));

module.exports = router;
