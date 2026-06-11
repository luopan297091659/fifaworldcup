const api = require("../../utils/api");

Page({
  data: {
    me: {},
    matches: [],
    members: [],
    groups: [],
    latestMatches: [],
    topRoom: null,
    myRoomRank: 0,
    opening: {},
    heroImageUrl: "",
    countdown: {
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
      finished: false
    }
  },

  onShow() {
    this.loadHome();
  },

  onHide() {
    this.stopCountdown();
  },

  onUnload() {
    this.stopCountdown();
  },

  loadHome() {
    api.getHome()
      .then((homeData) => {
        if (!homeData || !homeData.me || !Array.isArray(homeData.matches)) {
          wx.showToast({ title: "线上数据不可用", icon: "none" });
          return;
        }

        const predictions = homeData.predictions || {};
        const topRoom = homeData.topRoom || null;
        const myRoomRank = typeof homeData.myRoomRank === "number"
          ? homeData.myRoomRank
          : this.getMyRoomRank(topRoom, homeData.me.id);

        const latestMatches = Array.isArray(homeData.latestMatches) && homeData.latestMatches.length
          ? homeData.latestMatches
          : (Array.isArray(homeData.matches) ? homeData.matches.slice(0, 3) : []);

        const publicGroups = Array.isArray(homeData.publicGroups)
          ? homeData.publicGroups
          : (Array.isArray(homeData.groups) ? homeData.groups : []);

        this.setData({
          me: homeData.me,
          matches: homeData.matches.map((match) => ({
            ...match,
            statusText: match.status === "closed" ? "已公布" : predictions[match.id] ? "已预测" : "去预测",
            aiSummary: predictions[match.id] || match.status === "closed"
              ? `AI：${match.aiPick} ${match.aiScore}`
              : "提交后显示 AI 参考"
          })),
          members: Array.isArray(homeData.members) ? homeData.members : [],
          groups: publicGroups,
          latestMatches,
          topRoom,
          myRoomRank,
          opening: homeData.opening || {},
          heroImageUrl: (homeData.opening && homeData.opening.heroImageUrl) || ""
        }, () => {
          this.startCountdown(this.data.opening.openingKickoffAt);
        });
      })
      .catch((error) => {
        console.error("首页加载错误:", error);
        wx.showToast({ title: "线上数据不可用", icon: "none" });
      });
  },

  startCountdown(openingKickoffAt) {
    this.stopCountdown();
    this.updateCountdown(openingKickoffAt);
    this.countdownTimer = setInterval(() => {
      this.updateCountdown(openingKickoffAt);
    }, 1000);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  updateCountdown(openingKickoffAt) {
    const target = openingKickoffAt ? new Date(openingKickoffAt).getTime() : 0;
    const diff = target - Date.now();
    if (!target || diff <= 0) {
      this.setData({
        countdown: {
          days: "00",
          hours: "00",
          minutes: "00",
          seconds: "00",
          finished: true
        }
      });
      this.stopCountdown();
      return;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const minuteMs = 60 * 1000;
    const days = Math.floor(diff / dayMs);
    const hours = Math.floor((diff % dayMs) / hourMs);
    const minutes = Math.floor((diff % hourMs) / minuteMs);
    const seconds = Math.floor((diff % minuteMs) / 1000);

    this.setData({
      countdown: {
        days: this.pad(days),
        hours: this.pad(hours),
        minutes: this.pad(minutes),
        seconds: this.pad(seconds),
        finished: false
      }
    });
  },

  pad(value) {
    return String(value).padStart(2, "0");
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
      wx.showToast({ title: "比赛 ID 错误", icon: "none" });
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

  joinPublicGroup(event) {
    const roomId = event.currentTarget.dataset.roomId || "";
    if (!roomId) {
      wx.showToast({ title: "群组信息缺失", icon: "none" });
      return;
    }

    api.joinRoom(roomId)
      .then(() => {
        wx.showToast({ title: "已加入该群", icon: "success" });
        this.loadHome();
      })
      .catch((error) => {
        console.error("加入公开群失败:", error);
        wx.showToast({ title: "加入失败", icon: "none" });
      });
  },

  goRanking() {
    wx.navigateTo({ url: "/pages/ranking/ranking" });
  },

  goLive(event) {
    const roomId = event.currentTarget.dataset.roomId || "";
    const roomName = event.currentTarget.dataset.name || "群内预测实况";

    if (!roomId) {
      wx.showToast({ title: "群组信息缺失", icon: "none" });
      return;
    }

    wx.navigateTo({
      url: `/pages/chat/chat?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`
    });
  },

  goRoom() {
    wx.switchTab({
      url: "/pages/room/room"
    });
  }
});
