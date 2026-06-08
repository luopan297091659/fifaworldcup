const api = require("../../utils/api");

Page({
  data: {
    me: {},
    aiStats: {},
    isLoggedIn: false,
    loginLoading: false,
    profileSaving: false,
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
      .then(({ me, aiStats }) => {
        this.setData({
          me: me || {},
          aiStats: aiStats || {},
          isLoggedIn: api.isLoggedIn(),
          profileForm: {
            name: (me && (me.name || me.nickName)) || "",
            avatarUrl: (me && me.avatarUrl) || ""
          },
          selectedAvatarPath: ""
        });
      })
      .catch((error) => {
        console.error("个人页加载错误:", error);
        wx.showToast({ title: "数据不可用", icon: "none" });
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
    const avatarUrl = event.detail && event.detail.avatarUrl;
    if (!avatarUrl) return;

    this.setData({
      selectedAvatarPath: avatarUrl,
      "profileForm.avatarUrl": avatarUrl
    });
  },

  handleNicknameInput(event) {
    this.setData({
      "profileForm.name": (event.detail.value || "").trim()
    });
  },

  handleSyncWechatProfile() {
    if (this.data.profileSaving) return;

    const name = (this.data.profileForm.name || "").trim();
    const currentAvatar = this.data.profileForm.avatarUrl || "";

    if (!name) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    this.setData({ profileSaving: true });

    const avatarTask = this.data.selectedAvatarPath
      ? api.uploadAvatar(this.data.selectedAvatarPath)
      : Promise.resolve(currentAvatar);

    avatarTask
      .then((avatarUrl) => api.updateProfile({ name, avatarUrl }))
      .then(() => {
        wx.showToast({ title: "已同步", icon: "success" });
        this.refreshProfile();
      })
      .catch((error) => {
        console.error("同步微信资料失败:", error);
        wx.showToast({ title: "同步失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ profileSaving: false });
      });
  }
});
