const api = require("../../utils/api");
const { buildRoomHighlights } = require("../../utils/fun");

Page({
  data: {
    rooms: []
  },

  onShow() {
    api.getRooms()
      .then(({ rooms }) => {
        if (!rooms) {
          wx.showToast({ title: "暂无小组数据", icon: "none" });
          return;
        }

        this.setData({ rooms: this.decorateRooms(rooms) });
      })
      .catch((error) => {
        console.error("小组加载错误:", error);
        wx.showToast({ title: "暂无小组数据", icon: "none" });
      });
  },

  cheerRoom(event) {
    const roomId = event.currentTarget.dataset.id;
    
    // 验证roomId是否存在
    if (!roomId) {
      wx.showToast({ title: "小组ID错误", icon: "none" });
      return;
    }
    
    api.cheerRoom(roomId)
      .then(({ rooms }) => {
        this.setData({ rooms: this.decorateRooms(rooms) });
        wx.showToast({ title: "已助威", icon: "success" });
      })
      .catch((error) => {
        wx.showToast({ title: "助威失败", icon: "none" });
        console.error("助威错误:", error);
      });
  },

  decorateRooms(rooms) {
    return (rooms || []).map((room) => ({
      ...room,
      highlights: buildRoomHighlights(room)
    }));
  },

  onShareAppMessage(event) {
    const room = event.target.dataset.room || "足球预测小组";
    return {
      title: `我在「${room}」记录赛果预测，一起看球`,
      path: "/pages/home/home"
    };
  }
});
