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
    liveScore: "0:0",
    minute: "1'",
    latestReport: "Match has started. Waiting for the live report source to update the score.",
    lineupUpdatedAt: "",
    lineupSyncStatus: "unavailable",
    lineups: { home: [], away: [] }
  },
  {
    id: "m2",
    group: "Group A",
    time: "06月13日 19:00",
    kickoffAt: "2026-06-13T10:00:00.000Z",
    venue: "Guadalajara Stadium",
    home: "加拿大",
    away: "新西兰",
    status: "open",
    aiPick: "主胜",
    aiScore: "1:0",
    aiNote: "赛前模型会在阵容和伤停同步后更新。",
    finalScore: "",
    liveScore: "",
    lineupUpdatedAt: "",
    lineupSyncStatus: "unavailable",
    lineups: { home: [], away: [] }
  },
  {
    id: "m3",
    group: "Group B",
    time: "06月13日 22:00",
    kickoffAt: "2026-06-13T13:00:00.000Z",
    venue: "Toronto Stadium",
    home: "美国",
    away: "威尔士",
    status: "open",
    aiPick: "平",
    aiScore: "1:1",
    aiNote: "赛前模型会在阵容和伤停同步后更新。",
    finalScore: "",
    liveScore: "",
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
    description: "公开群已同步到服务端，所有登录用户都可进入查看冠军押注、首球与赛后战报，并查看群内所有人预测数据。",
    memberCount: 42,
    heat: 92,
    status: "活跃",
    accessMode: "公开群 · 查看所有人预测数据",
    shareText: "冠军押注群已同步到服务端，所有登录用户都可查看群内预测数据、热度与赛报。",
    feedMessages: [
      "⚽ 赛前提醒：今日赛报、冠军押注趋势与群内预测数据会持续更新。",
      "📊 群内支持查看所有人预测数据，便于对比赛果与押注思路。"
    ]
  },
  {
    id: "group-2",
    name: "小组积分群",
    description: "公开群实时同步小组积分、战况与讨论动态，成员均可查看群内所有人预测数据与赛果参考。",
    memberCount: 36,
    heat: 68,
    status: "热度中",
    accessMode: "公开群 · 查看所有人预测数据",
    shareText: "小组积分群实时推送小组赛结果、积分变化、文字战报与群内所有人预测数据。",
    feedMessages: [
      "🔥 积分更新：每场对阵后会同步最新积分与赛果说明。",
      "💬 讨论入口：可直接在群内查看动态、发言、赛前观点与所有人预测数据。"
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
