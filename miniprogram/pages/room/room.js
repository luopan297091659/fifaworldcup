const api = require("../../utils/api");
const { buildRoomHighlights } = require("../../utils/fun");

Page({
  data: {
    rooms: [],
    loading: false,
    actionRoomId: "",
    invitedRoomId: ""
  },

  onLoad(options = {}) {
    this.setData({ invitedRoomId: options.roomId || "" });
  },

  onShow() {
    this.loadRooms();
  },

  loadRooms() {
    this.setData({ loading: true });
    api.getRooms({ roomId: this.data.invitedRoomId || undefined })
      .then(({ rooms }) => {
        this.setData({ rooms: this.decorateRooms(rooms || []) });
      })
      .catch((error) => {
        console.error("小组加载错误:", error);
        wx.showToast({ title: "线上小组数据不可用", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  promptRoomName(title, defaultValue = "") {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        editable: true,
        placeholderText: "输入小组名称",
        content: defaultValue,
        success: (res) => {
          const name = (res.content || "").trim();
          resolve(res.confirm ? name : "");
        },
        fail: () => resolve("")
      });
    });
  },

  requireLogin() {
    if (api.isLoggedIn()) {
      return Promise.resolve();
    }

    wx.showToast({ title: "请先微信登录", icon: "none" });
    return api.loginWithWechatProfile().then(() => {
      wx.showToast({ title: "登录成功", icon: "success" });
    });
  },

  createRoom() {
    this.requireLogin()
      .then(() => this.promptRoomName("创建小组"))
      .then((name) => {
        if (!name) return null;
        return new Promise((resolve) => {
          wx.showActionSheet({
            itemList: ["公开小组", "私密小组"],
            success: (res) => resolve({
              name,
              type: res.tapIndex === 1 ? "私密" : "公开",
              isPublic: res.tapIndex !== 1
            }),
            fail: () => resolve(null)
          });
        });
      })
      .then((payload) => {
        if (!payload) return null;
        return api.createRoom({
          name: payload.name,
          type: payload.type,
          isPublic: payload.isPublic,
          topic: "一起预测世界杯赛果"
        });
      })
      .then((result) => {
        if (!result) return;
        this.setData({ rooms: this.decorateRooms(result.rooms || []) });
        wx.showToast({ title: "已创建", icon: "success" });
      })
      .catch((error) => {
        console.error("创建小组错误:", error);
        wx.showToast({ title: "创建失败", icon: "none" });
      });
  },

  editRoom(event) {
    const { id, name, topic, type } = event.currentTarget.dataset;
    if (!id) return;

    this.promptRoomName("修改小组名", name)
      .then((nextName) => {
        if (!nextName || nextName === name) return null;
        return api.updateRoom({
          roomId: id,
          name: nextName,
          topic,
          type
        });
      })
      .then((result) => {
        if (!result) return;
        this.setData({ rooms: this.decorateRooms(result.rooms || []) });
        wx.showToast({ title: "已更新", icon: "success" });
      })
      .catch((error) => {
        console.error("修改小组错误:", error);
        wx.showToast({ title: "修改失败", icon: "none" });
      });
  },

  deleteRoom(event) {
    const roomId = event.currentTarget.dataset.id;
    if (!roomId) return;

    wx.showModal({
      title: "删除小组",
      content: "删除后成员列表会一起移除，确定继续吗？",
      confirmText: "删除",
      confirmColor: "#b64128",
      success: (res) => {
        if (!res.confirm) return;
        api.deleteRoom(roomId)
          .then(({ rooms }) => {
            this.setData({ rooms: this.decorateRooms(rooms || []) });
            wx.showToast({ title: "已删除", icon: "success" });
          })
          .catch((error) => {
            console.error("删除小组错误:", error);
            wx.showToast({ title: "删除失败", icon: "none" });
          });
      }
    });
  },

  joinRoom(event) {
    const roomId = event.currentTarget.dataset.id;
    if (!roomId || this.data.actionRoomId) return;

    this.setData({ actionRoomId: roomId });
    this.requireLogin()
      .then(() => api.joinRoom(roomId))
      .then(({ rooms }) => {
        this.setData({ rooms: this.decorateRooms(rooms || []) });
        wx.showToast({ title: "已加入小组", icon: "success" });
        wx.switchTab({ url: "/pages/home/home" });
      })
      .catch((error) => {
        console.error("加入小组错误:", error);
        wx.showToast({ title: "加入失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ actionRoomId: "" });
      });
  },

  cheerRoom(event) {
    const roomId = event.currentTarget.dataset.id;
    if (!roomId) {
      wx.showToast({ title: "小组 ID 错误", icon: "none" });
      return;
    }

    this.requireLogin()
      .then(() => api.cheerRoom(roomId))
      .then(({ rooms }) => {
        this.setData({ rooms: this.decorateRooms(rooms || []) });
        wx.showToast({ title: "已助威", icon: "success" });
      })
      .catch((error) => {
        wx.showToast({ title: "助威失败", icon: "none" });
        console.error("助威错误:", error);
      });
  },

  decorateRooms(rooms) {
    const decorated = (rooms || []).map((room) => ({
      ...room,
      actionLoading: this.data.actionRoomId === room.id,
      highlights: buildRoomHighlights(room)
    }));
    if (!this.data.invitedRoomId) return decorated;
    return decorated.sort((left, right) => {
      if (left.id === this.data.invitedRoomId) return -1;
      if (right.id === this.data.invitedRoomId) return 1;
      return 0;
    });
  },

  onShareAppMessage(event) {
    const room = event.target.dataset.room || "足球预测小组";
    const roomId = event.target.dataset.id || "";
    return {
      title: `我在「${room}」记录赛果预测，一起看球`,
      path: roomId ? `/pages/room/room?roomId=${roomId}` : "/pages/room/room"
    };
  }
});
