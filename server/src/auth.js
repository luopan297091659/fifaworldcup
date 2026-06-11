const crypto = require("crypto");
const { normalizeStoreData, readStore, updateStore } = require("./store");

const DEFAULT_SECRET = "dev-secret-change-me";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signingSecret() {
  return process.env.JWT_SECRET || DEFAULT_SECRET;
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", signingSecret())
    .update(body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${body}.${signature}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", signingSecret())
    .update(body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function getCurrentUser(req) {
  const payload = verify(getTokenFromRequest(req));
  if (!payload || !payload.userId) return null;
  const data = normalizeStoreData(await readStore());
  return data.users?.[payload.userId] || null;
}

async function requireUser(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ code: 401, message: "Unauthorized" });
    return;
  }
  req.currentUser = user;
  next();
}

function resolveWechatCredentials() {
  return {
    appid: process.env.WECHAT_APPID || process.env.WX_APPID || process.env.APPID || "",
    secret: process.env.WECHAT_SECRET
      || process.env.WECHAT_APPSECRET
      || process.env.WECHAT_APP_SECRET
      || process.env.WX_SECRET
      || process.env.APP_SECRET
      || ""
  };
}

async function exchangeWechatOpenid(code) {
  const { appid, secret } = resolveWechatCredentials();
  if (!appid || !secret || !code) return null;

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.errcode) {
    throw new Error(body.errmsg || "WeChat login exchange failed");
  }
  return body.openid;
}

function isMeaningfulName(name) {
  return typeof name === "string"
    && name.trim()
    && name.trim() !== "我"
    && name.trim() !== "微信用户"
    && name.trim() !== "未登录用户";
}

function generateRandomNickName() {
  const prefixes = ["球迷", "战术家", "热血", "看台", "冠军", "预测员"];
  const suffix = `${Math.floor(Math.random() * 900) + 100}`;
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffix}`;
}

function pickMeaningfulName(...candidates) {
  return candidates.find((name) => isMeaningfulName(name)) || "";
}

async function createOrUpdateUser({ code, userInfo = {} }) {
  const safeUserInfo = userInfo && typeof userInfo === "object" && !Array.isArray(userInfo)
    ? userInfo
    : {};
  const openid = await exchangeWechatOpenid(code);
  const providerOpenid = openid || (code
    ? `dev_${crypto.createHash("sha1").update(code).digest("hex").slice(0, 16)}`
    : "dev_guest");
  const userId = `u_${providerOpenid}`;

  return updateStore((data) => {
    const normalizedData = normalizeStoreData(data);
    const existing = normalizedData.users?.[userId] || {};
    const profileName = pickMeaningfulName(
      safeUserInfo?.nickName,
      safeUserInfo?.name
    ).trim();
    const fallbackName = pickMeaningfulName(
      existing?.nickName,
      existing?.name,
      existing?.displayName
    ) || generateRandomNickName();
    const name = profileName || fallbackName;
    const avatarUrl = typeof safeUserInfo?.avatarUrl === "string" && safeUserInfo.avatarUrl.trim()
      ? safeUserInfo.avatarUrl.trim()
      : typeof safeUserInfo?.avatar === "string" && safeUserInfo.avatar.trim()
        ? safeUserInfo.avatar.trim()
        : typeof existing?.avatarUrl === "string" && existing.avatarUrl.trim()
          ? existing.avatarUrl.trim()
          : typeof existing?.avatar === "string" && existing.avatar.trim()
            ? existing.avatar.trim()
            : "";
    const user = {
      id: userId,
      name,
      nickName: profileName || fallbackName,
      displayName: profileName || fallbackName,
      avatarUrl,
      avatar: avatarUrl,
      score: existing?.score || 0,
      aiWins: existing?.aiWins || 0,
      percentile: existing?.percentile || 0,
      predictions: existing?.predictions || 0,
      title: existing?.title || "新晋预测员",
      badges: existing?.badges || [],
      providerOpenid,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    Object.assign(data, normalizedData, {
      users: normalizedData.users,
      sessions: normalizedData.sessions,
      predictions: normalizedData.predictions,
      matches: normalizedData.matches,
      rooms: normalizedData.rooms,
      rankingPlayers: normalizedData.rankingPlayers
    });
    data.users[userId] = user;
    return {
      token: sign({ userId, providerOpenid, iat: Date.now() }),
      user
    };
  });
}

module.exports = {
  createOrUpdateUser,
  getCurrentUser,
  requireUser
};
