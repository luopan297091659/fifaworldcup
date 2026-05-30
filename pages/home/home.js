Page({
  data: {
    me: {},
    matches: [],
    topRoom: {},
    myRoomRank: 0
  },

  onShow() {
    try {
      const app = getApp();
      const state = app.globalData.state;
      
      if (!state || !state.me || !state.rooms || !state.matches) {
        wx.showToast({ title: "数据不可用", icon: "none" });
        return;
      }
      
      const topRoom = state.rooms[0];
      const rankIndex = topRoom && topRoom.players 
        ? topRoom.players.findIndex((player) => player.id === state.me.id)
        : -1;
      const myRoomRank = rankIndex >= 0 ? rankIndex + 1 : 0;

      this.setData({
        me: state.me,
        matches: state.matches.map((match) => ({
          ...match,
          statusText: match.status === "closed" ? "已开奖" : state.predictions[match.id] ? "已预测" : "去预测"
        })),
        topRoom: topRoom || {},
        myRoomRank
      });
    } catch (error) {
      console.error("首页加载错误:", error);
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  goPredict(event) {
    const id = event.currentTarget.dataset.id;
    
    if (!id) {
      wx.showToast({ title: "比赛ID错误", icon: "none" });
      return;
    }
    
    try {
      const state = getApp().globalData.state;
      const match = state.matches.find((item) => item.id === id);

      if (!match) {
        wx.showToast({ title: "比赛不存在", icon: "none" });
        return;
      }
      
      if (match.status === "closed") {
        wx.navigateTo({
          url: `/pages/result/result?id=${id}`
        });
        return;
      }

      wx.navigateTo({
        url: `/pages/predict/predict?id=${id}`
      });
    } catch (error) {
      console.error("导航错误:", error);
      wx.showToast({ title: "导航失败", icon: "none" });
    }
  },

  goRoom() {
    wx.switchTab({
      url: "/pages/room/room"
    });
  }
});
