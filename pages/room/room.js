Page({
  data: {
    rooms: []
  },

  onShow() {
    this.setData({
      rooms: getApp().globalData.state.rooms
    });
  },

  cheerRoom(event) {
    const roomId = event.currentTarget.dataset.id;
    
    // 验证roomId是否存在
    if (!roomId) {
      wx.showToast({ title: "民间ID错误", icon: "none" });
      return;
    }
    
    const app = getApp();
    const rooms = app.globalData.state.rooms.map((room) => {
      if (room.id !== roomId) return room;
      return {
        ...room,
        cheers: room.cheers + 1,
        heat: Math.min(100, room.heat + 1)
      };
    });

    try {
      app.globalData.state.rooms = rooms;
      app.saveState();
      this.setData({ rooms });
      wx.showToast({ title: "已助威", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "助威失败", icon: "none" });
      console.error("助威错误:", error);
    }
  },

  onShareAppMessage(event) {
    const room = event.target.dataset.room || "世界杯预测房间";
    return {
      title: `我在「${room}」预测世界杯，来挑战 AI`,
      path: "/pages/home/home"
    };
  }
});
