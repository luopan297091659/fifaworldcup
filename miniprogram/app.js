const api = require("./utils/api");

App({
  globalData: {
    user: null
  },

  onLaunch() {
    this.globalData.user = api.getCachedUser();
  }
});
