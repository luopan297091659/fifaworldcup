const confidenceTitles = [
  { min: 90, title: "天台级自信" },
  { min: 75, title: "稳健预言家" },
  { min: 55, title: "理性看球派" },
  { min: 0, title: "玄学观察员" }
];

const roasts = [
  "AI 已记录你的答案，赛后见真章。",
  "这个比分有点大胆，群里应该会有人想反驳。",
  "AI 表示不同意，但它也不是每次都准。",
  "预测已封存，现在就差比赛给答案。"
];

const slogans = [
  "我先把话放这儿了",
  "这场我站这一边",
  "别问，问就是球感",
  "AI 可以算，我看球感"
];

const roomTitles = [
  "今日神预测候选",
  "对 AI 气氛组",
  "冷门观察席",
  "嘴硬不改神"
];

const reviewLabels = {
  perfect: {
    title: "本场封神",
    line: "比分完全命中，这张战报值得发到群里接受掌声。"
  },
  result: {
    title: "方向正确",
    line: "胜平负判断对了，离精准预测只差一点细节。"
  },
  goals: {
    title: "球感在线",
    line: "总进球区间猜中了，至少比赛节奏摸得很准。"
  },
  close: {
    title: "差一点封神",
    line: "比分只差一个球，赛后可以理直气壮地说自己看懂了。"
  },
  missed: {
    title: "赛后再议",
    line: "这场没有站上风口，下场继续把话放在开球前。"
  }
};

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
  return `${getSlogan(seed)}，${match.home} ${score} ${match.away}，${title}`;
}

function buildPredictionTags(prediction) {
  const [homeGoals, awayGoals] = prediction.score.split(":").map(Number);
  const totalGoals = homeGoals + awayGoals;
  const tags = [];

  if (prediction.confidence >= 85) {
    tags.push("高调立 Flag");
  } else if (prediction.confidence <= 35) {
    tags.push("谨慎观察");
  } else {
    tags.push("理性站队");
  }

  if (totalGoals >= 4) {
    tags.push("大比分剧本");
  } else if (totalGoals <= 1) {
    tags.push("防守局预警");
  } else {
    tags.push("常规节奏");
  }

  if (homeGoals === awayGoals) {
    tags.push("平局信仰");
  } else if (Math.abs(homeGoals - awayGoals) >= 2) {
    tags.push("胜负手很硬");
  }

  return tags;
}

function buildRoomHighlights(room) {
  const players = (room.players || []).slice().sort((a, b) => b.score - a.score);
  const leader = players[0] || {};
  const aiHunter = players.slice().sort((a, b) => (b.aiWins || 0) - (a.aiWins || 0))[0] || {};
  const seed = (room.heat || 0) + (room.cheers || 0) + (room.members || 0);

  return [
    {
      title: roomTitles[seed % roomTitles.length],
      value: leader.name || "等待上榜",
      note: leader.score ? `${leader.score} 分领跑小组` : "提交预测后开始产生榜单"
    },
    {
      title: "AI 对抗王",
      value: aiHunter.name || "暂无",
      note: `${aiHunter.aiWins || 0} 次赢过 AI 参考`
    },
    {
      title: "群内热度",
      value: `${room.heat || 0}%`,
      note: `${room.cheers || 0} 次助威，适合赛前拉人站队`
    }
  ];
}

function buildResultReview(match, prediction) {
  if (!match || !prediction || !match.finalScore) {
    return null;
  }

  const [finalHome, finalAway] = match.finalScore.split(":").map(Number);
  const [pickHome, pickAway] = prediction.score.split(":").map(Number);
  const finalResult = finalHome > finalAway ? "主胜" : finalHome < finalAway ? "客胜" : "平";
  const goalDiff = Math.abs(finalHome - pickHome) + Math.abs(finalAway - pickAway);
  const finalGoals = finalHome + finalAway;
  const finalBucket = finalGoals <= 1 ? "0-1" : finalGoals <= 3 ? "2-3" : "4+";

  let key = "missed";
  if (prediction.score === match.finalScore) {
    key = "perfect";
  } else if (prediction.result === finalResult) {
    key = "result";
  } else if (prediction.totalGoals === finalBucket) {
    key = "goals";
  } else if (goalDiff <= 1) {
    key = "close";
  }

  const label = reviewLabels[key];
  const aiText = match.aiScore === match.finalScore
    ? "AI 这场也猜中了比分。"
    : `AI 给的是 ${match.aiScore}，这次也没完全拿捏。`;

  return {
    title: label.title,
    line: label.line,
    aiText,
    shareLine: `${label.title}：我猜 ${match.home} ${prediction.score} ${match.away}，实际 ${match.finalScore}`
  };
}

module.exports = {
  buildPredictionTags,
  buildResultReview,
  buildRoomHighlights,
  buildShareLine,
  getConfidenceTitle,
  getRoast
};
