const openingKickoffAt = "2026-06-11T19:00:00.000Z";

const matches = [
  {
    id: "m1",
    group: "Group A",
    time: "06月12日 04:00",
    kickoffAt: openingKickoffAt,
    venue: "Mexico City Stadium",
    home: "墨西哥",
    away: "南非",
    status: "open",
    aiPick: "主胜",
    aiScore: "2:1",
    aiNote: "正式数据源未给出赛前模型结论前，仅展示基础参考。",
    finalScore: "",
    lineupUpdatedAt: "",
    lineupSyncStatus: "unavailable",
    lineups: { home: [], away: [] }
  }
];

module.exports = {
  appKey: "worldcup",
  tournament: {
    name: "FIFA World Cup 2026",
    openingKickoffAt,
    openingText: "2026 世界杯开幕战",
    openingMatch: "墨西哥 vs 南非",
    openingVenue: "Mexico City Stadium",
    heroImagePath: "/worldcup/assert/host.png"
  },
  users: {},
  sessions: {},
  predictions: {},
  matches,
  rooms: [],
  rankingPlayers: []
};
