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

const members = [
  { id: "member-1", name: "阿宁", role: "队长", groupId: "group-1", groupName: "冠军押注群", status: "在线" },
  { id: "member-2", name: "小周", role: "助理", groupId: "group-1", groupName: "冠军押注群", status: "在线" },
  { id: "member-3", name: "林悦", role: "分析员", groupId: "group-2", groupName: "小组积分群", status: "离线" }
];

const groups = [
  { id: "group-1", name: "冠军押注群", description: "关注冠军、首球和小组积分", memberCount: 18, heat: 86, status: "活跃" },
  { id: "group-2", name: "小组积分群", description: "同步小组赛结果和最新战报", memberCount: 12, heat: 64, status: "热度中" }
];

const latestMatches = matches.slice(0, 3).map((match) => ({
  id: `latest-${match.id}`,
  matchId: match.id,
  home: match.home,
  away: match.away,
  group: match.group || "A组",
  time: match.time,
  venue: match.venue,
  status: match.status,
  kickoffAt: match.kickoffAt,
  finalScore: match.finalScore || ""
}));

module.exports = {
  appKey: process.env.APP_KEY || "worldcup",
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
  rankingPlayers: [],
  members,
  groups,
  latestMatches
};
