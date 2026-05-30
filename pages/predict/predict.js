const { getMatch, calculatePredictionScore } = require("../../utils/mockData");
const { buildShareLine, getConfidenceTitle, getRoast } = require("../../utils/fun");

Page({
  data: {
    match: null,
    prediction: null,
    funCard: null,
    resultOptions: ["主胜", "平", "客胜"],
    goalOptions: ["0-1", "2-3", "4+"],
    form: {
      result: "主胜",
      homeGoals: "0",
      awayGoals: "0",
      totalGoals: "0-1",
      firstScorer: "",
      confidence: 50
    }
  },

  onLoad(query) {
    const state = getApp().globalData.state;
    const match = getMatch(state, query.id);
    const prediction = state.predictions[query.id] || null;

    if (!match) {
      wx.showToast({ title: "比赛不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const scoreParts = prediction ? prediction.score.split(":") : [this.data.form.homeGoals, this.data.form.awayGoals];

    this.setData({
      match,
      prediction,
      form: prediction
        ? {
            result: prediction.result,
            homeGoals: scoreParts[0],
            awayGoals: scoreParts[1],
            totalGoals: prediction.totalGoals,
            firstScorer: prediction.firstScorer,
            confidence: prediction.confidence || 50
          }
        : this.data.form
    });

    if (prediction) {
      this.refreshFunCard(prediction);
    }
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
    this.setData({ "form.firstScorer": value });
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
    
    if (isNaN(homeGoals) || isNaN(awayGoals)) {
      wx.showToast({ title: "比分字段不合法", icon: "none" });
      return;
    }

    const prediction = {
      matchId: match.id,
      result: form.result,
      score: `${homeGoals}:${awayGoals}`,
      totalGoals: form.totalGoals,
      firstScorer: form.firstScorer || "未填写",
      confidence: form.confidence,
      earned: calculatePredictionScore(match, {
        result: form.result,
        score: `${homeGoals}:${awayGoals}`,
        totalGoals: form.totalGoals,
        firstScorer: form.firstScorer
      }),
      beatAi: false
    };

    try {
      const app = getApp();
      app.globalData.state.predictions[match.id] = prediction;
      app.saveState();

      this.setData({ prediction });
      this.refreshFunCard(prediction);
      wx.showToast({ title: "预测已提交", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "提交失败，请重试", icon: "none" });
      console.error("预测提交错误:", error);
    }
  },

  refreshFunCard(prediction) {
    const seed = Number(prediction.score.replace(":", "")) + prediction.confidence;
    this.setData({
      funCard: {
        title: getConfidenceTitle(prediction.confidence),
        roast: getRoast(seed),
        shareLine: buildShareLine(this.data.match, prediction.score, prediction.confidence)
      }
    });
  },

  onShareAppMessage() {
    const { match, prediction, funCard } = this.data;
    const score = prediction ? prediction.score : `${this.data.form.homeGoals}:${this.data.form.awayGoals}`;

    return {
      title: funCard ? funCard.shareLine : `我预测${match.home} ${score} ${match.away}，来挑战 AI`,
      path: `/pages/predict/predict?id=${match.id}`
    };
  }
});
