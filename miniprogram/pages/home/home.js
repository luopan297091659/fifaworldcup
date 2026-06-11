const api = require("../../utils/api");

Page({
  data: {
    me: {},
    matches: [],
    members: [],
    groups: [],
    latestMatches: [],
    latestResult: null,
    topRoom: null,
    myRoomRank: 0,
    opening: {},
    heroImageUrl: ""
  },

  onShow() {
    this.loadHome();
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
        const decoratedLatestMatches = latestMatches.map((match) => this.decorateLatestMatch(match));
        const latestResult = this.pickLatestResult(decoratedLatestMatches);

        const publicGroups = (Array.isArray(homeData.publicGroups)
          ? homeData.publicGroups
          : (Array.isArray(homeData.groups) ? homeData.groups : []))
          .map((group) => {
            const joined = this.isGroupJoined(group, homeData.me && homeData.me.id);

            return {
              ...group,
              joined,
              memberCount: Number(group.memberCount || group.members || 0),
              heat: Number(group.heat || 0),
              accessMode: group.accessMode || (group.isPublic ? "公开群" : "私密群")
            };
          });

        this.setData({
          me: homeData.me,
          matches: homeData.matches.map((match) => ({
            ...match,
            myPrediction: this.normalizePredictionSummary(predictions[match.id]),
            statusText: this.getPredictionStatusText(match, predictions[match.id]),
            aiSummary: predictions[match.id] || match.status === "closed"
              ? `AI：${match.aiPick} ${match.aiScore}`
              : "提交后显示 AI 参考"
          })),
          members: Array.isArray(homeData.members) ? homeData.members : [],
          groups: publicGroups,
          latestMatches: decoratedLatestMatches,
          latestResult,
          topRoom,
          myRoomRank,
          opening: homeData.opening || {},
          heroImageUrl: (homeData.opening && homeData.opening.heroImageUrl) || ""
        });
      })
      .catch((error) => {
        console.error("首页加载错误:", error);
        wx.showToast({ title: "线上数据不可用", icon: "none" });
      });
  },

  getPredictionStatusText(match, prediction) {
    if (match.status === "closed") {
      return "已公布";
    }
    if (prediction) {
      return "已预测";
    }
    if (match.predictionOpen === false) {
      return match.predictionLockedReason === "started" ? "已开赛" : "暂未开放";
    }
    return "去预测";
  },

  decorateLatestMatch(match) {
    const score = match.finalScore || match.liveScore || "";
    const statusText = match.status === "closed"
      ? "已完赛"
      : match.status === "live"
        ? (match.minute ? `进行中 ${match.minute}` : "进行中")
        : "待开赛";

    return {
      ...match,
      displayScore: score || "VS",
      statusText,
      reportText: match.report || match.latestReport || (score ? "比分已同步" : "等待战报同步")
    };
  },

  pickLatestResult(latestMatches) {
    if (!Array.isArray(latestMatches) || !latestMatches.length) {
      return null;
    }
    return latestMatches.find((match) => match.status === "live")
      || latestMatches.find((match) => match.finalScore || match.liveScore)
      || latestMatches[0];
  },

  normalizePredictionSummary(prediction) {
    if (!prediction) {
      return null;
    }
    if (typeof prediction === "string") {
      return {
        result: "",
        score: prediction,
        text: `我的预测 ${prediction}`
      };
    }

    const result = prediction.result || "";
    const score = prediction.score || "";
    return {
      ...prediction,
      result,
      score,
      text: result && score ? `我的预测 ${result} ${score}` : `我的预测 ${score || result}`
    };
  },

  isGroupJoined(group, userId) {
    if (!group || !userId) {
      return Boolean(group && group.joined);
    }

    const explicitJoined = Boolean(
      group.joined
      || group.isJoined
      || group.memberStatus === "joined"
      || group.memberStatus === "已加入"
      || String(group.status || "").includes("已加入")
      || String(group.accessMode || "").includes("已加入")
    );

    if (explicitJoined) {
      return true;
    }

    return Array.isArray(group.players)
      ? group.players.some((player) => player && (player.id === userId || player.userId === userId))
      : false;
  },

  getMyRoomRank(room, userId) {
    const rankIndex = room && room.players
      ? room.players.findIndex((player) => player.id === userId)
      : -1;
    return rankIndex >= 0 ? rankIndex + 1 : 0;
  },

  requireLogin() {
    if (api.isLoggedIn()) {
      return Promise.resolve();
    }

    wx.showToast({ title: "请先微信登录", icon: "none" });
    return api.login({ userInfo: null }).then(() => {
      wx.showToast({ title: "登录成功", icon: "success" });
    });
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

    this.requireLogin()
      .then(() => api.joinRoom(roomId))
      .then(() => {
        wx.showToast({ title: "已加入该群", icon: "success" });
        this.loadHome();
      })
      .catch((error) => {
        console.error("加入公开群失败:", error);
        wx.showToast({ title: "加入失败", icon: "none" });
      });
  },

  goRanking(event) {
    const roomId = event.currentTarget.dataset.roomId || "";
    const roomName = event.currentTarget.dataset.roomName || "";

    wx.navigateTo({
      url: roomId
        ? `/pages/ranking/ranking?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`
        : "/pages/ranking/ranking"
    });
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
