const api = require("../../utils/api");

const DEFAULT_NAME = "我";
const WECHAT_DEFAULT_NAME = "微信用户";
const GUEST_NAME = "未登录用户";

function isMeaningfulName(name) {
  return typeof name === "string"
    && name.trim()
    && name.trim() !== DEFAULT_NAME
    && name.trim() !== WECHAT_DEFAULT_NAME
    && name.trim() !== GUEST_NAME;
}

Page({
  data: {
    me: {},
    aiStats: {},
    isLoggedIn: false,
    loginLoading: false,
    profileSaving: false,
    profileNeedsSync: false,
    profileForm: {
      name: "",
      avatarUrl: ""
    },
    selectedAvatarPath: ""
  },

  onShow() {
    this.refreshProfile();
  },

  refreshProfile() {
    api.getProfile()
      .then((payload = {}) => {
        const { me = {}, aiStats = {} } = payload;
        const cachedUser = api.getCachedUser && api.getCachedUser();
        const serverUser = me || {};

        const cachedName = cachedUser?.name || cachedUser?.nickName || cachedUser?.displayName || "";
        const serverName = serverUser.name || serverUser.nickName || serverUser.displayName || "";
        const displayName = isMeaningfulName(cachedName)
          ? cachedName
          : isMeaningfulName(serverName)
            ? serverName
            : DEFAULT_NAME;

        const cachedAvatar = cachedUser?.avatarUrl || cachedUser?.avatar || "";
        const serverAvatar = serverUser.avatarUrl || serverUser.avatar || "";
        const avatarUrl = cachedAvatar || serverAvatar || "";
        const hasValidLogin = api.isLoggedIn() && serverUser.id !== "guest";
        const currentUser = {
          ...serverUser,
          ...(isMeaningfulName(cachedName) || cachedAvatar ? cachedUser : {}),
          name: displayName,
          displayName,
          avatarUrl,
          avatar: avatarUrl
        };

        this.setData({
          me: currentUser,
          aiStats,
          isLoggedIn: hasValidLogin,
          profileNeedsSync: hasValidLogin && (!isMeaningfulName(displayName) || !avatarUrl),
          profileForm: {
            name: isMeaningfulName(displayName) ? displayName : "",
            avatarUrl
          },
          selectedAvatarPath: ""
        });
      })
      .catch((error) => {
        console.error("个人页加载错误:", error);
        wx.showToast({ title: "资料加载失败", icon: "none" });
      });
  },

  handleWechatLogin() {
    if (this.data.loginLoading) return;

    this.setData({ loginLoading: true });
    api.loginWithWechatProfile()
      .then(() => {
        wx.showToast({ title: "登录成功", icon: "success" });
        this.refreshProfile();
      })
      .catch((error) => {
        console.error("微信登录失败:", error);
        wx.showToast({ title: "微信登录失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loginLoading: false });
      });
  },

  handleLogout() {
    api.logout()
      .then(() => {
        wx.showToast({ title: "已退出登录", icon: "none" });
        this.refreshProfile();
      });
  },

  handleChooseAvatar(event) {
    const avatarUrl = event.detail?.avatarUrl || "";
    if (!avatarUrl) return;

    this.setData({
      selectedAvatarPath: avatarUrl,
      "profileForm.avatarUrl": avatarUrl
    });
  },

  handleNicknameInput(event) {
    const name = event.detail.value || "";
    this.setData({
      "profileForm.name": name
    });
  },

  handleSyncWechatProfile() {
    if (this.data.profileSaving) return;
    if (!api.isLoggedIn()) {
      wx.showToast({ title: "请先微信登录", icon: "none" });
      return;
    }

    const name = (this.data.profileForm.name || "").trim();
    const avatarUrl = this.data.profileForm.avatarUrl || "";
    const selectedAvatarPath = this.data.selectedAvatarPath || "";

    if (!isMeaningfulName(name)) {
      wx.showToast({ title: "请先选择微信昵称", icon: "none" });
      return;
    }
    if (!avatarUrl && !selectedAvatarPath) {
      wx.showToast({ title: "请先选择微信头像", icon: "none" });
      return;
    }

    this.setData({ profileSaving: true });
    const avatarTask = selectedAvatarPath
      ? api.uploadAvatar(selectedAvatarPath)
      : Promise.resolve(avatarUrl);

    avatarTask
      .then((uploadedAvatarUrl) => api.updateProfile({
        name,
        avatarUrl: uploadedAvatarUrl || avatarUrl
      }))
      .then(() => {
        wx.showToast({ title: "资料已同步", icon: "success" });
        this.refreshProfile();
      })
      .catch((error) => {
        console.error("同步微信资料失败:", error);
        wx.showToast({ title: error.message || "资料同步失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ profileSaving: false });
      });
  }
});
