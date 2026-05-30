const { createInitialState } = require("./utils/mockData");

App({
  globalData: {
    state: null
  },

  onLaunch() {
    try {
      const savedState = wx.getStorageSync("worldcup_state");
      this.globalData.state = savedState || createInitialState();
      console.log("应用启动，状态已加载");
    } catch (error) {
      console.error("串上将化错误:", error);
      this.globalData.state = createInitialState();
    }
  },

  saveState() {
    try {
      wx.setStorageSync("worldcup_state", this.globalData.state);
    } catch (error) {
      console.error("应用函数都超旗了:")
    }
  }
});
