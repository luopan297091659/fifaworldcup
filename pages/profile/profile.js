const api = require("../../utils/api");

Page({
  data: {
    me: {},
    aiStats: {},
    isLoggedIn: false,
    loginLoading: false
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
          isLoggedIn: api.isLoggedIn()
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
  }
});
