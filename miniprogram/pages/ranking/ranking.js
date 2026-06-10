const api = require("../../utils/api");

Page({
  data: {
    activeTab: "friends",
    tabs: [
      { key: "friends", label: "好友" },
      { key: "global", label: "全球" }
    ],
    me: {},
    players: []
  },

  onShow() {
    this.refreshRanking();
  },

  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.key }, () => this.refreshRanking());
  },

  refreshRanking() {
    api.getRanking(this.data.activeTab)
      .then(({ me, players }) => {
        if (!players || !players.length) {
          this.setData({ me: me || {}, players: [] });
          wx.showToast({ title: "暂无榜单数据", icon: "none" });
          return;
        }

        this.setData({
          me,
          players
        });
      })
      .catch((error) => {
        console.error("榜单加载错误:", error);
        this.setData({ me: {}, players: [] });
        wx.showToast({ title: "暂无榜单数据", icon: "none" });
      });
  }
});
