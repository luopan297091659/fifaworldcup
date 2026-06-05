const api = require("../../utils/api");
const { buildResultReview } = require("../../utils/fun");

Page({
  data: {
    match: null,
    prediction: null,
    resultTitle: "",
    review: null
  },

  onLoad(query) {
    api.getMatchDetail(query.id || "m3")
      .then(({ match, prediction }) => {
        if (!match) {
          wx.showToast({ title: "比赛不存在", icon: "none" });
          setTimeout(() => wx.navigateBack(), 1500);
          return;
        }

        this.setData({
          match,
          prediction,
          resultTitle: this.getResultTitle(match, prediction),
          review: buildResultReview(match, prediction)
        });
      })
      .catch((error) => {
        console.error("结果页加载错误:", error);
        wx.showToast({ title: "比赛不存在", icon: "none" });
        setTimeout(() => wx.navigateBack(), 1500);
      });
  },

  getResultTitle(match, prediction) {
    if (!match.finalScore) {
      return "比赛结果尚未公布";
    }

    const aiHit = match.aiScore === match.finalScore;
    const predictionHit = prediction && prediction.score === match.finalScore;

    if (predictionHit && aiHit) {
      return "你和 AI 都预测正确了";
    }
    if (predictionHit) {
      return "你的预测更接近";
    }
    if (aiHit) {
      return "AI 本场预测正确";
    }
    return "这场大家都没预测对";
  },

  onShareAppMessage() {
    const { prediction, review } = this.data;
    return {
      title: review ? review.shareLine : prediction ? `我本场拿到 ${prediction.earned} 分，一起看球` : "一起看球，记录赛果预测",
      path: "/pages/home/home"
    };
  }
});
