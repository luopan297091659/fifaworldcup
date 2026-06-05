const api = require("../../utils/api");
const { buildPredictionTags, buildShareLine, getConfidenceTitle, getRoast } = require("../../utils/fun");

Page({
  data: {
    matchId: "",
    match: null,
    prediction: null,
    funCard: null,
    lineupPlayers: [],
    lineupStatusText: "正在同步首发阵容",
    resultOptions: ["主胜", "平", "客胜"],
    goalOptions: ["0-1", "2-3", "4+"],
    form: {
      result: "主胜",
      homeGoals: "0",
      awayGoals: "0",
      totalGoals: "0-1",
      firstScorer: "",
      firstScorerSource: "manual",
      confidence: 50
    }
  },

  onLoad(query) {
    this.setData({ matchId: query.id || "" });
    this.loadMatchDetail(query.id);
  },

  loadMatchDetail(matchId, options = {}) {
    if (!matchId) {
      wx.showToast({ title: "比赛ID错误", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return Promise.reject(new Error("match id missing"));
    }

    if (!options.silent) {
      this.setData({ lineupStatusText: "正在同步首发阵容" });
    }

    return api.getMatchDetail(matchId, { refreshLineup: Boolean(options.refreshLineup) })
      .then(({ match, prediction }) => {
        if (!match) {
          wx.showToast({ title: "比赛不存在", icon: "none" });
          setTimeout(() => wx.navigateBack(), 1500);
          return;
        }

        const scoreParts = prediction ? prediction.score.split(":") : [this.data.form.homeGoals, this.data.form.awayGoals];
        const nextMatch = this.decorateMatch(match);

        this.setData({
          match: nextMatch,
          prediction,
          lineupPlayers: this.getLineupPlayers(nextMatch),
          lineupStatusText: this.getLineupStatusText(nextMatch),
          form: prediction
            ? {
                result: prediction.result,
                homeGoals: scoreParts[0],
                awayGoals: scoreParts[1],
                totalGoals: prediction.totalGoals,
                firstScorer: prediction.firstScorer || "",
                firstScorerSource: prediction.firstScorerSource || "manual",
                confidence: prediction.confidence || 50
              }
            : this.data.form
        });

        if (prediction) {
          this.refreshFunCard(prediction);
        }

        if (options.toast) {
          wx.showToast({ title: "首发阵容已同步", icon: "success" });
        }

        return { match: nextMatch, prediction };
      })
      .catch((error) => {
        console.error("预测页加载错误:", error);
        if (!options.keepOnError) {
          wx.showToast({ title: "数据加载失败", icon: "none" });
          setTimeout(() => wx.navigateBack(), 1500);
        }
        throw error;
      });
  },

  decorateMatch(match) {
    return {
      ...match,
      lineups: {
        home: match.lineups && match.lineups.home ? match.lineups.home : [],
        away: match.lineups && match.lineups.away ? match.lineups.away : []
      }
    };
  },

  getLineupPlayers(match) {
    const homePlayers = (match.lineups.home || []).map((player) => ({
      ...player,
      team: match.home,
      side: "home"
    }));
    const awayPlayers = (match.lineups.away || []).map((player) => ({
      ...player,
      team: match.away,
      side: "away"
    }));
    return homePlayers.concat(awayPlayers);
  },

  getLineupStatusText(match) {
    const total = (match.lineups.home || []).length + (match.lineups.away || []).length;
    if (!total) {
      return "首发阵容待服务端同步，可先手动填写";
    }
    if (match.lineupSyncStatus === "stale") {
      return match.lineupUpdatedAt
        ? `阵容同步延迟 · 上次更新 ${match.lineupUpdatedAt}`
        : "阵容同步延迟，可手动填写";
    }
    if (match.lineupSyncStatus === "unavailable") {
      return "暂未获取到官方阵容，可手动填写";
    }
    return match.lineupUpdatedAt
      ? `已同步首发阵容 · ${match.lineupUpdatedAt}`
      : "已同步首发阵容";
  },

  refreshLineups() {
    this.loadMatchDetail(this.data.matchId, { refreshLineup: true, toast: true });
  },

  selectResult(event) {
    this.setData({ "form.result": event.currentTarget.dataset.value });
  },

  selectGoals(event) {
    this.setData({ "form.totalGoals": event.currentTarget.dataset.value });
  },

  setHomeGoals(event) {
    const value = String(event.detail.value).trim();
    if (!/^\d+$/.test(value) && value !== "") {
      wx.showToast({ title: "请输入整数", icon: "none" });
      return;
    }
    this.setData({ "form.homeGoals": value });
  },

  setAwayGoals(event) {
    const value = String(event.detail.value).trim();
    if (!/^\d+$/.test(value) && value !== "") {
      wx.showToast({ title: "请输入整数", icon: "none" });
      return;
    }
    this.setData({ "form.awayGoals": value });
  },

  setFirstScorer(event) {
    const value = event.detail.value.trim();
    if (value.length > 20) {
      wx.showToast({ title: "球员名字不超过20个字符", icon: "none" });
      return;
    }
    this.setData({
      "form.firstScorer": value,
      "form.firstScorerSource": "manual"
    });
  },

  selectFirstScorer(event) {
    const name = event.currentTarget.dataset.name;
    if (!name) return;
    this.setData({
      "form.firstScorer": name,
      "form.firstScorerSource": "lineup"
    });
  },

  setConfidence(event) {
    const value = Number(event.detail.value);
    if (value < 0 || value > 100) {
      wx.showToast({ title: "信心值应该在0-100之间", icon: "none" });
      return;
    }
    this.setData({ "form.confidence": value });
  },

  submitPrediction() {
    const { match, form } = this.data;
    
    // 防止已结束比赛的预测修改
    if (match.status === "closed") {
      wx.showToast({ title: "比赛已结束，无法修改预测", icon: "none" });
      return;
    }
    
    if (form.homeGoals === "" || form.awayGoals === "") {
      wx.showToast({ title: "请填写比分", icon: "none" });
      return;
    }
    
    const homeGoals = Number(form.homeGoals);
    const awayGoals = Number(form.awayGoals);
    
    if (isNaN(homeGoals) || isNaN(awayGoals) || homeGoals < 0 || awayGoals < 0 || homeGoals > 20 || awayGoals > 20) {
      wx.showToast({ title: "比分需在0-20之间", icon: "none" });
      return;
    }

    this.loadMatchDetail(match.id, { refreshLineup: true, silent: true, keepOnError: true })
      .then(({ match: latestMatch }) => {
        this.submitPredictionWithMatch(latestMatch || match);
      })
      .catch(() => {
        this.submitPredictionWithMatch(match);
      });
  },

  submitPredictionWithMatch(match) {
    const { form } = this.data;
    const homeGoals = Number(form.homeGoals);
    const awayGoals = Number(form.awayGoals);

    const predictionPayload = {
      matchId: match.id,
      result: form.result,
      score: `${homeGoals}:${awayGoals}`,
      totalGoals: form.totalGoals,
      firstScorer: form.firstScorer,
      firstScorerSource: form.firstScorerSource || "manual",
      confidence: form.confidence
    };

    api.submitPrediction(predictionPayload)
      .then(({ prediction }) => {
        this.setData({ prediction });
        this.refreshFunCard(prediction);
        wx.showToast({ title: "预测已提交", icon: "success" });
      })
      .catch((error) => {
        wx.showToast({ title: "提交失败，请重试", icon: "none" });
        console.error("预测提交错误:", error);
      });
  },

  refreshFunCard(prediction) {
    const seed = Number(prediction.score.replace(":", "")) + prediction.confidence;
    this.setData({
      funCard: {
        title: getConfidenceTitle(prediction.confidence),
        roast: getRoast(seed),
        shareLine: buildShareLine(this.data.match, prediction.score, prediction.confidence),
        tags: buildPredictionTags(prediction)
      }
    });
  },

  onShareAppMessage() {
    const { match, prediction, funCard } = this.data;
    const score = prediction ? prediction.score : `${this.data.form.homeGoals}:${this.data.form.awayGoals}`;

    return {
      title: funCard ? funCard.shareLine : `我预测${match.home} ${score} ${match.away}，一起看球`,
      path: `/pages/predict/predict?id=${match.id}`
    };
  }
});
