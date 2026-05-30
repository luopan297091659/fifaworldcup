const confidenceTitles = [
  { min: 90, title: "天台级自信" },
  { min: 75, title: "稳健预言家" },
  { min: 55, title: "理性看球派" },
  { min: 0, title: "玄学观察员" }
];

const roasts = [
  "AI 已记录你的答案，赛后见真章。",
  "这比分有点大胆，群里应该会有人想反驳。",
  "AI 表示不同意，但它也不是每次都准。",
  "预测已封存，现在就差比赛给答案。"
];

const slogans = [
  "我先把话放这儿了",
  "这场我站这一边",
  "别问，问就是球感",
  "AI 可以算，我可以赌气"
];

function getConfidenceTitle(confidence) {
  return confidenceTitles.find((item) => confidence >= item.min).title;
}

function getRoast(seed) {
  return roasts[seed % roasts.length];
}

function getSlogan(seed) {
  return slogans[seed % slogans.length];
}

function buildShareLine(match, score, confidence) {
  const title = getConfidenceTitle(confidence);
  const seed = Number(score.replace(":", "")) + confidence;
  return `${getSlogan(seed)}：${match.home} ${score} ${match.away}，${title}`;
}

module.exports = {
  buildShareLine,
  getConfidenceTitle,
  getRoast
};
