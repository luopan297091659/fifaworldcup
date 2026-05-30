const matches = [
  {
    id: "m1",
    group: "A组",
    time: "06月12日 20:00",
    home: "日本",
    away: "德国",
    status: "open",
    aiScore: "1:1",
    aiPick: "平",
    oddsText: "AI认为日本防守反击会压低比分"
  },
  {
    id: "m2",
    group: "B组",
    time: "06月13日 03:00",
    home: "阿根廷",
    away: "法国",
    status: "open",
    aiScore: "2:1",
    aiPick: "主胜",
    oddsText: "AI看好阿根廷中前场创造力"
  },
  {
    id: "m3",
    group: "C组",
    time: "06月13日 23:00",
    home: "巴西",
    away: "英格兰",
    status: "closed",
    finalScore: "2:2",
    firstScorer: "维尼修斯",
    aiScore: "2:1",
    aiPick: "主胜",
    oddsText: "AI赛前看好巴西边路优势"
  }
];

const rooms = [
  {
    id: "r1",
    name: "世界杯大阪留学生群",
    type: "留学生榜",
    members: 38,
    heat: 76,
    cheers: 128,
    topic: "今晚德国会不会又被亚洲队教育？",
    sponsor: "Osaka Goal Bar",
    players: [
      { id: "u1", name: "Tom", score: 320, aiWins: 5 },
      { id: "u2", name: "Alex", score: 280, aiWins: 4 },
      { id: "me", name: "我", score: 260, aiWins: 4 },
      { id: "u3", name: "Pan", score: 240, aiWins: 3 }
    ]
  },
  {
    id: "r2",
    name: "公司午休看球局",
    type: "公司榜",
    members: 24,
    heat: 61,
    cheers: 83,
    topic: "午休群押阿根廷的人已经开始紧张了",
    sponsor: "",
    players: [
      { id: "me", name: "我", score: 210, aiWins: 3 },
      { id: "u4", name: "Lina", score: 190, aiWins: 2 },
      { id: "u5", name: "Ken", score: 170, aiWins: 2 }
    ]
  }
];

function createInitialState() {
  return {
    me: {
      id: "me",
      name: "我",
      score: 260,
      aiWins: 4,
      predictions: 7,
      percentile: 86,
      title: "稳健预言家",
      badges: ["AI 挑战者", "比分命中过", "群内前三"]
    },
    matches,
    rooms,
    predictions: {
      m3: {
        matchId: "m3",
        result: "平",
        score: "2:2",
        totalGoals: "4+",
        firstScorer: "维尼修斯",
        earned: 160,
        beatAi: true
      }
    },
    aiStats: {
      aiWinRate: 58,
      userWinRate: 42
    }
  };
}

function getMatch(state, matchId) {
  if (!state || !state.matches || !matchId) {
    console.warn("查询比赛参数不正常:", { state, matchId });
    return null;
  }
  return state.matches.find((match) => match.id === matchId);
}

function calculatePredictionScore(match, prediction) {
  if (!match || !match.finalScore) {
    return 0;
  }

  const scoreParts = match.finalScore.split(":");
  if (scoreParts.length !== 2) {
    console.warn("最终比分格式不正常:", match.finalScore);
    return 0;
  }
  
  const [homeGoals, awayGoals] = scoreParts.map(Number);
  const finalResult = homeGoals > awayGoals ? "主胜" : homeGoals < awayGoals ? "客胜" : "平";
  const totalGoals = homeGoals + awayGoals;
  const totalBucket = totalGoals <= 1 ? "0-1" : totalGoals <= 3 ? "2-3" : "4+";

  let earned = 0;
  if (prediction.result === finalResult) earned += 10;
  if (prediction.totalGoals === totalBucket) earned += 15;
  if (prediction.score === match.finalScore) earned += 50;
  if (prediction.firstScorer && prediction.firstScorer === match.firstScorer) earned += 100;

  return earned;
}}

module.exports = {
  createInitialState,
  getMatch,
  calculatePredictionScore
};
