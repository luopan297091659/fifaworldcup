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
    showQuickPhrases: false,
    showEmojiPicker: false,
    emojiList: ["😀", "😂", "😍", "👍", "🔥", "⚽", "🎉", "💬", "🤝", "👏"],
    quickPhrases: ["👍 这场值得看", "⚽ 这场必须看", "📣 赛前提醒", "🔥 热度很高", "🎉 期待精彩", "💬 我来跟进"],
    syncTimer: null,
    lastSyncedAt: ""
  },

  onLoad(options = {}) {
    this.setData({
      roomId: options.roomId || "",
      roomName: options.roomName || "群内讨论"
    });
    this.loadRoom();
  },

  onShow() {
    this.startRealtimeSync();
  },

  onHide() {
    this.stopRealtimeSync();
  },

  onUnload() {
    this.stopRealtimeSync();
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
        const messages = this.buildMessages(room);
        const nextUpdatedAt = room && room.updatedAt ? room.updatedAt : new Date().toISOString();

        this.setData({
          room,
          roomName: room && room.name ? room.name : this.data.roomName,
          members,
          messages,
          lastSyncedAt: nextUpdatedAt
        }, () => {
          this.scrollToBottom();
          this.startRealtimeSync();
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
    const members = Array.isArray(room && room.players) ? room.players : [];
    const memberMap = new Map(members.map((member) => [String(member.id || ""), member]));
    const userMessageTexts = new Set(
      userMessages
        .map((item) => String(item && item.text ? item.text : "").trim())
        .filter(Boolean)
    );
    const seenTexts = new Set(
      userMessages.map((item) => `${String(item.text || "").trim()}|${String(item.userId || item.sender || "").trim()}`)
    );

    const messages = [
      ...userMessages.map((item) => {
        const matchedMember = memberMap.get(String(item.userId || ""))
          || members.find((member) => member.name === item.sender || member.name === item.userName || member.id === item.sender)
          || null;

        return {
          ...item,
          sender: item.sender
            || (item.userId === "me" ? "我" : (matchedMember && matchedMember.name) || "群成员"),
          type: item.type || "member"
        };
      }),
      ...feedMessages
        .filter((item) => {
          if (typeof item !== "string") {
            return false;
          }
          const text = item.trim();
          if (!text || userMessageTexts.has(text)) {
            return false;
          }
          return !seenTexts.has(`${text}|system`);
        })
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

  toggleQuickPhrases() {
    this.setData({ showQuickPhrases: !this.data.showQuickPhrases });
  },

  toggleEmojiPicker() {
    this.setData({ showEmojiPicker: !this.data.showEmojiPicker });
  },

  insertEmoji(event) {
    const emoji = (event.currentTarget.dataset.emoji || "").trim();
    if (!emoji) {
      return;
    }

    this.setData({
      draft: `${(this.data.draft || "").trim()} ${emoji}`.trim(),
      showEmojiPicker: false
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

  startRealtimeSync() {
    this.stopRealtimeSync();
    if (!this.data.roomId) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.pollRoom();
    }, 4000);
  },

  stopRealtimeSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  },

  pollRoom() {
    if (!this.data.roomId) {
      return;
    }

    api.getRooms({ roomId: this.data.roomId, since: this.data.lastSyncedAt || "" })
      .then(({ rooms }) => {
        const room = (rooms || []).find((item) => item.id === this.data.roomId) || null;
        if (!room) {
          return;
        }

        const messages = this.buildMessages(room);
        this.setData({
          room,
          roomName: room && room.name ? room.name : this.data.roomName,
          members: Array.isArray(room && room.players) ? room.players : [],
          messages,
          lastSyncedAt: room.updatedAt || this.data.lastSyncedAt
        }, () => {
          this.scrollToBottom();
        });
      })
      .catch((error) => {
        console.warn("聊天实时同步失败:", error);
      });
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
