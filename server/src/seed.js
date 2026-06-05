const matches = [
  {
    id: "m1",
    group: "Group A",
    time: "06月12日 03:00",
    home: "墨西哥",
    away: "南非",
    status: "open",
    aiPick: "主胜",
    aiScore: "2:1",
    finalScore: "",
    lineupUpdatedAt: "",
    lineupSyncStatus: "unavailable",
    lineups: { home: [], away: [] }
  },
  {
    id: "m2",
    group: "Group B",
    time: "06月13日 00:00",
    home: "巴西",
    away: "日本",
    status: "open",
    aiPick: "主胜",
    aiScore: "3:1",
    finalScore: "",
    lineupUpdatedAt: "",
    lineupSyncStatus: "unavailable",
    lineups: { home: [], away: [] }
  },
  {
    id: "m3",
    group: "Group C",
    time: "已结束",
    home: "法国",
    away: "加拿大",
    status: "closed",
    aiPick: "主胜",
    aiScore: "2:0",
    finalScore: "2:0",
    lineupUpdatedAt: "06月01日 02:55",
    lineupSyncStatus: "fresh",
    lineups: {
      home: [
        { id: "fra-1", name: "姆巴佩", position: "前锋", status: "starter" },
        { id: "fra-2", name: "格列兹曼", position: "中场", status: "starter" }
      ],
      away: [
        { id: "can-1", name: "戴维", position: "前锋", status: "starter" },
        { id: "can-2", name: "戴维斯", position: "后卫", status: "starter" }
      ]
    }
  }
];

const rooms = [
  {
    id: "r1",
    name: "熬夜看球组",
    type: "好友",
    topic: "谁能猜中第一粒进球",
    members: 12,
    heat: 86,
    cheers: 31,
    players: [
      { id: "u_demo_2", name: "阿森", score: 128 },
      { id: "me", name: "我", score: 96 },
      { id: "u_demo_3", name: "小林", score: 88 }
    ]
  },
  {
    id: "r2",
    name: "公司午休球局",
    type: "公司",
    topic: "比分猜准就请咖啡",
    members: 24,
    heat: 72,
    cheers: 18,
    players: [
      { id: "u_demo_4", name: "产品同学", score: 115 },
      { id: "me", name: "我", score: 96 },
      { id: "u_demo_5", name: "前端同学", score: 76 }
    ]
  }
];

const rankingPlayers = [
  { id: "u_demo_2", name: "阿森", score: 128 },
  { id: "u_demo_4", name: "产品同学", score: 115 },
  { id: "me", name: "我", score: 96 },
  { id: "u_demo_3", name: "小林", score: 88 },
  { id: "u_demo_5", name: "前端同学", score: 76 }
];

module.exports = {
  appKey: "worldcup",
  users: {},
  sessions: {},
  predictions: {},
  matches,
  rooms,
  rankingPlayers
};
