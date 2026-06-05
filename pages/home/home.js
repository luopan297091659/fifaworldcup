const api = require("../../utils/api");

Page({
  data: {
    me: {},
    matches: [],
    topRoom: {},
    myRoomRank: 0
  },

  onShow() {
    api.getHome()
      .then((homeData) => {
        if (!homeData || !homeData.me || !homeData.rooms || !homeData.matches) {
          wx.showToast({ title: "数据不可用", icon: "none" });
          return;
        }

        const predictions = homeData.predictions || {};
        const topRoom = homeData.topRoom || homeData.rooms[0];
        const myRoomRank = typeof homeData.myRoomRank === "number"
          ? homeData.myRoomRank
          : this.getMyRoomRank(topRoom, homeData.me.id);

        this.setData({
          me: homeData.me,
          matches: homeData.matches.map((match) => ({
            ...match,
            statusText: match.status === "closed" ? "已公布" : predictions[match.id] ? "已预测" : "去预测",
            aiSummary: predictions[match.id] || match.status === "closed"
              ? `AI：${match.aiPick} ${match.aiScore}`
              : "提交后显示 AI 参考"
          })),
          topRoom: topRoom || {},
          myRoomRank
        });
      })
      .catch((error) => {
        console.error("首页加载错误:", error);
        wx.showToast({ title: "数据不可用", icon: "none" });
      });
  },

  getMyRoomRank(room, userId) {
    const rankIndex = room && room.players
      ? room.players.findIndex((player) => player.id === userId)
      : -1;
    return rankIndex >= 0 ? rankIndex + 1 : 0;
  },

  goPredict(event) {
    const id = event.currentTarget.dataset.id;
    
    if (!id) {
      wx.showToast({ title: "比赛ID错误", icon: "none" });
      return;
    }
    
    api.getMatchDetail(id)
      .then(({ match }) => {
        if (!match) {
          wx.showToast({ title: "比赛不存在", icon: "none" });
          return;
        }

        wx.navigateTo({
          url: match.status === "closed"
            ? `/pages/result/result?id=${id}`
            : `/pages/predict/predict?id=${id}`
        });
      })
      .catch((error) => {
        console.error("导航错误:", error);
        wx.showToast({ title: "导航失败", icon: "none" });
      });
  },

  goRoom() {
    wx.switchTab({
      url: "/pages/room/room"
    });
  }
});
