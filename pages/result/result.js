const { getMatch } = require("../../utils/mockData");

Page({
  data: {
    match: null,
    prediction: null,
    resultTitle: ""
  },

  onLoad(query) {
    const state = getApp().globalData.state;
    const match = getMatch(state, query.id || "m3");
    const prediction = state.predictions[match.id];
    
    let resultTitle = "";
    if (!match.finalScore) {
      resultTitle = "比赛尚未开奖";
    } else {
      const aiHit = match.aiScore === match.finalScore;
      const predictionHit = prediction && prediction.score === match.finalScore;
      
      if (predictionHit && aiHit) {
        resultTitle = "你和 AI 都预测正确了";
      } else if (predictionHit) {
        resultTitle = "你击败了 AI";
      } else if (aiHit) {
        resultTitle = "AI 本场预测正确";
      } else {
        resultTitle = "这场大家都没预测对";
      }
    }

    this.setData({
      match,
      prediction,
      resultTitle
    });
  },

  onShareAppMessage() {
    return {
      title: `我本场拿到 ${this.data.prediction.earned} 分，来挑战 AI`,
      path: "/pages/home/home"
    };
  }
});
