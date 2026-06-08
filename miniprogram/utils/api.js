const config = require("./backendConfig");

function getToken() {
  try {
    return wx.getStorageSync(config.tokenStorageKey);
  } catch (error) {
    console.warn("读取登录态失败", error);
    return "";
  }
}

function setToken(token) {
  if (!token) return;
  try {
    wx.setStorageSync(config.tokenStorageKey, token);
  } catch (error) {
    console.warn("保存登录态失败", error);
  }
}

function clearToken() {
  try {
    wx.removeStorageSync(config.tokenStorageKey);
    wx.removeStorageSync(config.userStorageKey);
  } catch (error) {
    console.warn("清除登录态失败", error);
  }
}

function getCachedUser() {
  try {
    return wx.getStorageSync(config.userStorageKey) || null;
  } catch (error) {
    console.warn("读取用户信息失败", error);
    return null;
  }
}

function setCachedUser(user) {
  if (!user) return;
  try {
    wx.setStorageSync(config.userStorageKey, user);
  } catch (error) {
    console.warn("保存用户信息失败", error);
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
    return Promise.reject(new Error(`正式接口配置缺失: ${endpointKey}`));
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

function upload(endpointKey, filePath, formData = {}) {
  const endpoint = config.endpoints[endpointKey];
  if (!config.baseUrl || !endpoint) {
    return Promise.reject(new Error(`正式接口配置缺失: ${endpointKey}`));
  }

  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${config.baseUrl}${endpoint}`,
      filePath,
      name: "file",
      timeout: config.timeout,
      formData: {
        appKey: config.appKey,
        ...formData
      },
      header: {
        "X-App-Key": config.appKey,
        Authorization: token ? `Bearer ${token}` : ""
      },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`文件上传失败: ${res.statusCode}`));
          return;
        }

        try {
          const parsed = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          resolve(normalizeRemoteResponse({ data: parsed }));
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
  return login();
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

function uploadAvatar(filePath) {
  return upload("uploadAvatar", filePath).then((data) => {
    const avatarUrl = data.avatarUrl || data.url || "";
    if (!avatarUrl) {
      throw new Error("头像上传接口未返回 avatarUrl");
    }
    return avatarUrl;
  });
}

function updateProfile(profile) {
  return request("updateProfile", profile).then((data) => {
    if (data.user || data.me) {
      updateCurrentUser(data.user || data.me);
    }
    return data;
  });
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

function createRoom(payload) {
  return request("createRoom", payload);
}

function updateRoom(payload) {
  return request("updateRoom", payload);
}

function deleteRoom(roomId) {
  return request("deleteRoom", { roomId });
}

function joinRoom(roomId) {
  return request("joinRoom", { roomId });
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
  uploadAvatar,
  updateProfile,
  getHome,
  getMatchDetail,
  submitPrediction,
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  joinRoom,
  cheerRoom,
  getRanking,
  getProfile
};
