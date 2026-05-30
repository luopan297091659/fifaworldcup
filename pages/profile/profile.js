Page({
  data: {
    me: {},
    aiStats: {}
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.state) {
      wx.showToast({ title: "数据不可用", icon: "none" });
      return;
    }
    
    const state = app.globalData.state;
    this.setData({
      me: state.me || {},
      aiStats: state.aiStats || {}
    });
  }
});
