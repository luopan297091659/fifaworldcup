const crypto = require("crypto");
const { readStore, updateStore } = require("./store");

const DEFAULT_SECRET = "dev-secret-change-me";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload) {
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
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
    .createHmac("sha256", process.env.JWT_SECRET || DEFAULT_SECRET)
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
  const data = await readStore();
  return data.users[payload.userId] || null;
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

async function exchangeWechatOpenid(code) {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
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

async function createOrUpdateUser({ code, userInfo = {} }) {
  const openid = await exchangeWechatOpenid(code);
  const providerOpenid = openid || (code
    ? `dev_${crypto.createHash("sha1").update(code).digest("hex").slice(0, 16)}`
    : "dev_guest");
  const userId = `u_${providerOpenid}`;

  return updateStore((data) => {
    const existing = data.users[userId] || {};
    const user = {
      id: userId,
      name: userInfo.nickName || userInfo.name || existing.name || "我",
      displayName: userInfo.nickName || userInfo.name || existing.displayName || "我",
      avatarUrl: userInfo.avatarUrl || existing.avatarUrl || "",
      score: existing.score || 0,
      aiWins: existing.aiWins || 0,
      percentile: existing.percentile || 68,
      predictions: existing.predictions || 0,
      title: existing.title || "稳健预言家",
      badges: existing.badges || ["首场预测", "和 AI 掰手腕"],
      providerOpenid,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString()
    };

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
