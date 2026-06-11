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

function normalizeAvatarUrl(avatarUrl) {
  if (typeof avatarUrl !== "string") return "";
  const trimmed = avatarUrl.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|wxfile:\/\/|http:\/\/tmp\/|https:\/\/tmp\/)/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/") && config.baseUrl) {
    return `${config.baseUrl.replace(/\/$/, "")}${trimmed}`;
  }
  return trimmed;
}

function updateCurrentUser(user) {
  if (!user) return user;
  const app = getApp();
  const cachedUser = getCachedUser() || {};
  const nextUser = {
    ...cachedUser,
    ...(user || {})
  };
  const incomingName = user.name || user.nickName || user.displayName || "";
  const cachedName = cachedUser.name || cachedUser.nickName || cachedUser.displayName || "";
  if (!isMeaningfulNickName(incomingName) && isMeaningfulNickName(cachedName)) {
    nextUser.name = cachedName;
    nextUser.displayName = cachedName;
    nextUser.nickName = cachedName;
  }
  const avatarUrl = normalizeAvatarUrl(nextUser.avatarUrl || nextUser.avatar || "");
  if (avatarUrl) {
    nextUser.avatarUrl = avatarUrl;
    nextUser.avatar = avatarUrl;
  }
  if (!nextUser.nickName && (nextUser.name || nextUser.displayName)) {
    nextUser.nickName = nextUser.name || nextUser.displayName;
  }

  app.globalData.user = nextUser;
  setCachedUser(nextUser);
  return nextUser;
}

function isMeaningfulNickName(name) {
  return typeof name === "string"
    && name.trim()
    && name.trim() !== "我"
    && name.trim() !== "微信用户"
    && name.trim() !== "未登录用户";
}

function normalizeWechatUserInfo(userInfo) {
  if (!userInfo || typeof userInfo !== "object") return null;

  const nickName = isMeaningfulNickName(userInfo.nickName)
    ? userInfo.nickName.trim()
    : isMeaningfulNickName(userInfo.name)
      ? userInfo.name.trim()
      : "";
  const avatarUrl = normalizeAvatarUrl(userInfo.avatarUrl || userInfo.avatar || "");

  if (!nickName && !avatarUrl) return null;
  return {
    ...userInfo,
    nickName,
    avatarUrl
  };
}

function mergeUserWithWeChatInfo(user, userInfo) {
  if (!user || typeof user !== "object") return user;
  if (!userInfo || typeof userInfo !== "object") return user;

  const nickName = isMeaningfulNickName(userInfo.nickName)
    ? userInfo.nickName.trim()
    : isMeaningfulNickName(userInfo.name)
      ? userInfo.name.trim()
      : user.nickName || user.name || user.displayName || "我";
  const name = nickName;
  const avatar = normalizeAvatarUrl(userInfo.avatarUrl || userInfo.avatar || user.avatarUrl || user.avatar || "");

  return {
    ...user,
    nickName,
    name,
    displayName: name,
    avatarUrl: avatar,
    avatar
  };
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

function sanitizeRequestPayload(data = {}) {
  return Object.entries(data || {}).reduce((result, [key, value]) => {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
    return result;
  }, {});
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
      data: sanitizeRequestPayload({
        appKey: config.appKey,
        ...data
      }),
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
      formData: sanitizeRequestPayload({
        appKey: config.appKey,
        ...formData
      }),
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

function getWechatUserInfo() {
  return new Promise((resolve, reject) => {
    if (typeof wx.getUserProfile === "function") {
      wx.getUserProfile({
        desc: "用于同步昵称和头像",
        lang: "zh_CN",
        success: (res) => resolve(res.userInfo || null),
        fail: reject
      });
      return;
    }

    if (typeof wx.getUserInfo === "function") {
      wx.getUserInfo({
        success: (res) => resolve(res.userInfo || null),
        fail: reject
      });
      return;
    }

    reject(new Error("当前微信环境不支持获取用户资料"));
  });
}

function login(options = {}) {
  return getWxLoginCode()
    .then((code) => request("login", {
      code,
      userInfo: options.userInfo || null,
      silent: Boolean(options.silent)
    }))
    .then((result) => {
      const userInfo = options.userInfo || null;
      if (!userInfo) return result;

      const mergedUser = mergeUserWithWeChatInfo(result.user || result.me || {}, userInfo);
      if (mergedUser) {
        updateCurrentUser(mergedUser);
        return {
          ...result,
          user: mergedUser,
          me: mergedUser
        };
      }
      return result;
    });
}

function syncWechatProfileToCache(userInfo) {
  if (!userInfo || typeof userInfo !== "object") return null;

  const currentUser = getCachedUser() || {};
  const nickName = isMeaningfulNickName(userInfo.nickName)
    ? userInfo.nickName.trim()
    : "";
  const nextUser = {
    ...currentUser,
    name: nickName || currentUser.name || currentUser.displayName || "我",
    displayName: nickName || currentUser.displayName || currentUser.name || "我",
    avatarUrl: normalizeAvatarUrl(userInfo.avatarUrl || currentUser.avatarUrl || currentUser.avatar || ""),
    avatar: normalizeAvatarUrl(userInfo.avatarUrl || currentUser.avatarUrl || currentUser.avatar || "")
  };

  updateCurrentUser(nextUser);
  return nextUser;
}

function loginWithWechatProfile() {
  return getWechatUserInfo()
    .then((userInfo) => {
      const normalizedUserInfo = normalizeWechatUserInfo(userInfo);
      if (!normalizedUserInfo) {
        return login({ userInfo: null });
      }
      syncWechatProfileToCache(normalizedUserInfo);
      return login({ userInfo: normalizedUserInfo });
    })
    .catch((error) => {
      console.warn("获取微信用户资料失败，回退到静默登录:", error);
      return login({ userInfo: null });
    });
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
    const avatarUrl = normalizeAvatarUrl(data.avatarUrl || data.url || "");
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

function getRooms(options = {}) {
  return request("rooms", sanitizeRequestPayload(options), "GET");
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

function sendRoomMessage(roomId, text) {
  return request("sendRoomMessage", { roomId, text });
}

function cheerRoom(roomId) {
  return request("cheerRoom", { roomId });
}

function getRanking(scope, roomId) {
  return request("ranking", { scope, roomId }, "GET");
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
  sendRoomMessage,
  cheerRoom,
  getRanking,
  getProfile,
  sanitizeRequestPayload
};
