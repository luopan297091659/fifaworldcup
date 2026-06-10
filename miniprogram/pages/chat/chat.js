const api = require("../../utils/api");

Page({
  data: {
    roomId: "",
    roomName: "群内讨论",
    room: null,
    members: [],
    messages: [],
    draft: "",
    loading: false,
    quickPhrases: ["👍 加油", "⚽ 赛况", "🎉 期待", "🔥 这场必须看"]
  },

  onLoad(options = {}) {
    this.setData({
      roomId: options.roomId || "",
      roomName: options.roomName || "群内讨论"
    });
    this.loadRoom();
  },

  loadRoom() {
    if (!this.data.roomId) {
      wx.showToast({ title: "房间信息缺失", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    api.getRooms({ roomId: this.data.roomId })
      .then(({ rooms }) => {
        const room = (rooms || []).find((item) => item.id === this.data.roomId) || null;
        const members = Array.isArray(room && room.players) ? room.players : [];
        this.setData({
          room,
          roomName: room && room.name ? room.name : this.data.roomName,
          members,
          messages: this.buildMessages(room)
        });
      })
      .catch((error) => {
        console.error("聊天页加载错误:", error);
        wx.showToast({ title: "聊天页数据不可用", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  buildMessages(room) {
    const feedMessages = Array.isArray(room && room.feedMessages) ? room.feedMessages : [];
    if (feedMessages.length) {
      return feedMessages.map((text, index) => ({
        id: `feed-${index}`,
        text,
        time: index === 0 ? "实时赛况" : "群消息",
        type: "system"
      }));
    }

    return [
      {
        id: "welcome",
        text: `${room && room.name ? room.name : this.data.roomName} 已开启群内讨论，成员可直接在这里交流。`,
        time: "系统",
        type: "system"
      }
    ];
  },

  onDraftInput(event) {
    this.setData({ draft: event.detail.value || "" });
  },

  insertQuickText(event) {
    const text = (event.currentTarget.dataset.text || "").trim();
    if (!text) {
      return;
    }

    this.setData({
      draft: `${(this.data.draft || "").trim()} ${text}`.trim()
    });
  },

  sendMessage(event) {
    const rawText =
      typeof event === "string"
        ? event
        : event && event.detail && typeof event.detail.value === "string"
          ? event.detail.value
          : (this.data.draft || "");

    const content = (rawText || "").trim();
    if (!content) {
      wx.showToast({ title: "请输入讨论内容", icon: "none" });
      return;
    }

    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    this.setData({
      draft: "",
      messages: [
        ...(this.data.messages || []),
        { id: `${Date.now()}`, text: content, time, type: "me", sender: "我" }
      ]
    }, () => {
      this.scrollToBottom();
    });

    wx.showToast({ title: "已发送", icon: "success" });
  },

  onTextareaConfirm(event) {
    this.sendMessage(event);
  },

  scrollToBottom() {
    setTimeout(() => {
      wx.createSelectorQuery()
        .select(".message-list")
        .boundingClientRect((rect) => {
          if (rect) {
            wx.pageScrollTo({ scrollTop: rect.bottom + 120, duration: 120 });
          }
        })
        .exec();
    }, 60);
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }

    wx.switchTab({ url: "/pages/room/room" });
  }
});
