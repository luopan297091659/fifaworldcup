const api = require("../../utils/api");

Page({
  data: {
    me: {},
    matches: [],
    members: [],
    latestMatches: [],
    latestResult: null,
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

        const latestMatches = Array.isArray(homeData.latestMatches) && homeData.latestMatches.length
          ? homeData.latestMatches
          : (Array.isArray(homeData.matches) ? homeData.matches.slice(0, 3) : []);
        const decoratedLatestMatches = latestMatches.map((match) => this.decorateLatestMatch(match));
        const latestResult = this.pickLatestResult(decoratedLatestMatches);

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
          latestMatches: decoratedLatestMatches,
          latestResult,
          opening: homeData.opening || {},
          heroImageUrl: (homeData.opening && homeData.opening.heroImageUrl) || ""
        });
      })
      .catch((error) => {
        console.error("首页加载错误:", error);
        wx.showToast({ title: "线上数据不可用", icon: "none" });
      });
  },

  isFinishedMatch(match) {
    const text = [
      match && match.status,
      match && match.minute,
      match && match.report,
      match && match.latestReport,
      match && match.finalScore,
      match && match.liveScore
    ].filter(Boolean).join(" ").toLowerCase();

    return Boolean(
      match && (
        match.status === "closed"
        || match.finalScore
        || match.liveScore
        || /(ft|aet|pen|full_time|match finished|match ended|已完|已结束|完赛|完场)/.test(text)
      )
    );
  },

  getPredictionStatusText(match, prediction) {
    if (this.isFinishedMatch(match) || match.status === "closed") {
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
    const isFinished = this.isFinishedMatch(match);
    const statusText = isFinished
      ? "已完赛"
      : match.status === "live"
        ? (match.minute ? `进行中 ${match.minute}` : "进行中")
        : "待开赛";

    return {
      ...match,
      displayScore: score || "VS",
      statusText,
      reportText: isFinished
        ? (match.report || match.latestReport || (score ? "比分已同步" : "等待战报同步"))
        : (match.report || match.latestReport || (score ? "比分已同步" : "等待战报同步"))
    };
  },

  pickLatestResult(latestMatches) {
    if (!Array.isArray(latestMatches) || !latestMatches.length) {
      return null;
    }
    return latestMatches.find((match) => this.isFinishedMatch(match) || match.status === "closed")
      || latestMatches.find((match) => match.status === "live")
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

  goRanking(event) {
    const roomId = event.currentTarget.dataset.roomId || "";
    const roomName = event.currentTarget.dataset.roomName || "";

    wx.navigateTo({
      url: roomId
        ? `/pages/ranking/ranking?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`
        : "/pages/ranking/ranking"
    });
  },

  goRoom() {
    wx.switchTab({
      url: "/pages/room/room"
    });
  }
});
