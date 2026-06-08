const api = require("./utils/api");

App({
  globalData: {
    user: null
  },

  onLaunch() {
    this.globalData.user = api.getCachedUser();
    api.login({ silent: true }).catch((error) => {
      console.warn("微信登录初始化失败:", error);
    });
  }
});
