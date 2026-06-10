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
    quickPhrases: ["👍 这场值得看", "⚽ 这场必须看", "📣 赛前提醒", "🔥 热度很高", "🎉 期待精彩", "💬 我来跟进"]
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
    const userMessages = Array.isArray(room && room.messages) ? room.messages : [];
    const feedMessages = Array.isArray(room && room.feedMessages) ? room.feedMessages : [];
    const seenTexts = new Set(userMessages.map((item) => `${item.text || ""}|${item.userId || ""}`));

    const messages = [
      ...userMessages.map((item) => ({
        ...item,
        sender: item.sender || (item.userId === "me" ? "我" : "群成员"),
        type: item.type || "member"
      })),
      ...feedMessages
        .filter((item) => typeof item === "string" && !seenTexts.has(`${item}|system`))
        .map((text, index) => ({
          id: `feed-${index}`,
          text,
          time: index === 0 ? "实时赛况" : "群消息",
          type: "system"
        }))
    ];

    if (messages.length) {
      return messages;
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

    if (!this.data.roomId) {
      wx.showToast({ title: "房间信息缺失", icon: "none" });
      return;
    }

    api.sendRoomMessage(this.data.roomId, content)
      .then(() => {
        this.setData({ draft: "" });
        this.loadRoom();
        wx.showToast({ title: "已发送", icon: "success" });
      })
      .catch((error) => {
        console.error("发送群内消息失败:", error);
        wx.showToast({ title: "发送失败，请稍后重试", icon: "none" });
      });
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
