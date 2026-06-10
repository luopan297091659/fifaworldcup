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
  { id: "member-3", name: "林悦", role: "分析员", groupId: "group-2", groupName: "小组积分群", status: "离线" },
  { id: "member-4", name: "朵朵", role: "赛事播报", groupId: "group-1", groupName: "冠军押注群", status: "在线" },
  { id: "member-5", name: "陈星", role: "助理", groupId: "group-2", groupName: "小组积分群", status: "在线" }
];

const groups = [
  {
    id: "group-1",
    name: "冠军押注群",
    description: "关注冠军押注、首球与赛后战报，支持邀请好友或直接进入讨论。",
    memberCount: 42,
    heat: 92,
    status: "活跃",
    accessMode: "邀请好友 / 进入群聊",
    shareText: "冠军押注群已同步今日战报、积分推演与热度信息，欢迎随时进入讨论。",
    feedMessages: [
      "⚽ 赛前提醒：今日赛报与冠军押注趋势会实时更新。",
      "📣 群内入口：可直接进入群聊查看战报，也可邀请好友一同押注。"
    ]
  },
  {
    id: "group-2",
    name: "小组积分群",
    description: "同步小组积分、战况与讨论动态，成员规模保持在 35 人左右。",
    memberCount: 36,
    heat: 68,
    status: "热度中",
    accessMode: "邀请好友 / 进入群聊",
    shareText: "小组积分群实时推送小组赛结果、积分变化与文字战报。",
    feedMessages: [
      "🔥 积分更新：每场对阵后会同步最新积分与赛果说明。",
      "💬 讨论入口：可直接在群内查看动态、发言和赛前观点。"
    ]
  }
];

const systemRooms = groups.map((group) => ({
  id: group.id,
  name: group.name,
  type: "系统群",
  isPublic: true,
  topic: group.description,
  members: group.memberCount || 0,
  heat: group.heat || 0,
  cheers: 0,
  ownerId: "system",
  players: [],
  feedMessages: Array.isArray(group.feedMessages) ? group.feedMessages.slice() : [],
  shareText: group.shareText || "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

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
  rooms: systemRooms,
  latestMatches
};
