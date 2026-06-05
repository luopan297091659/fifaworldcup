const config = require("./backendConfig");

function getToken() {
  try {
    return wx.getStorageSync(config.tokenStorageKey);
  } catch (error) {
    console.warn("读取登录态失败:", error);
    return "";
  }
}

function setToken(token) {
  if (!token) return;
  try {
    wx.setStorageSync(config.tokenStorageKey, token);
  } catch (error) {
    console.warn("保存登录态失败:", error);
  }
}

function clearToken() {
  try {
    wx.removeStorageSync(config.tokenStorageKey);
    wx.removeStorageSync(config.userStorageKey);
  } catch (error) {
    console.warn("清除登录态失败:", error);
  }
}

function getCachedUser() {
  try {
    return wx.getStorageSync(config.userStorageKey) || null;
  } catch (error) {
    console.warn("读取用户信息失败:", error);
    return null;
  }
}

function setCachedUser(user) {
  if (!user) return;
  try {
    wx.setStorageSync(config.userStorageKey, user);
  } catch (error) {
    console.warn("保存用户信息失败:", error);
  }
}

function updateCurrentUser(user) {
  if (!user) return user;
  const app = getApp();
  app.globalData.user = user;
  setCachedUser(user);
  return user;
}

function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code);
          return;
        }
        reject(new Error("微信登录未返回 code"));
      },
      fail: reject
    });
  });
}

function getWxUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: "用于展示昵称头像和记录预测积分",
      success(res) {
        resolve(res.userInfo || {});
      },
      fail: reject
    });
  });
}

function normalizeRemoteResponse(response) {
  const body = response && response.data ? response.data : response;
  if (!body) return {};
  if (body.code && body.code !== 0) {
    throw new Error(body.message || "接口返回异常");
  }
  return body.data || body;
}

function request(endpointKey, data = {}, method = "POST") {
  const endpoint = config.endpoints[endpointKey];
  if (!config.baseUrl || !endpoint) {
    return Promise.reject(new Error(`正式版接口配置缺失: ${endpointKey}`));
  }

  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.baseUrl}${endpoint}`,
      method,
      timeout: config.timeout,
      data: {
        appKey: config.appKey,
        ...data
      },
      header: {
        "content-type": "application/json",
        "X-App-Key": config.appKey,
        Authorization: token ? `Bearer ${token}` : ""
      },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`接口请求失败: ${res.statusCode}`));
          return;
        }

        try {
          const result = normalizeRemoteResponse(res);
          if (result.token) {
            setToken(result.token);
          }
          if (result.user || result.me) {
            updateCurrentUser(result.user || result.me);
          }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
}

function login(options = {}) {
  return getWxLoginCode()
    .then((code) => request("login", {
      code,
      userInfo: options.userInfo || null,
      silent: Boolean(options.silent)
    }));
}

function loginWithWechatProfile() {
  return getWxUserProfile().then((userInfo) => login({ userInfo }));
}

function logout() {
  clearToken();
  const app = getApp();
  app.globalData.user = null;
  return Promise.resolve({ user: null });
}

function isLoggedIn() {
  return Boolean(getToken());
}

function getHome() {
  return request("home", {}, "GET");
}

function getMatchDetail(matchId, options = {}) {
  return request("matchDetail", { matchId, ...options }, "GET");
}

function submitPrediction(payload) {
  return request("submitPrediction", payload);
}

function getRooms() {
  return request("rooms", {}, "GET");
}

function cheerRoom(roomId) {
  return request("cheerRoom", { roomId });
}

function getRanking(scope) {
  return request("ranking", { scope }, "GET");
}

function getProfile() {
  return request("profile", {}, "GET");
}

module.exports = {
  login,
  loginWithWechatProfile,
  logout,
  isLoggedIn,
  getCachedUser,
  getHome,
  getMatchDetail,
  submitPrediction,
  getRooms,
  cheerRoom,
  getRanking,
  getProfile
};
