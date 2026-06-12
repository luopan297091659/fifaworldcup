const fs = require("fs");
const path = require("path");
const { readStore, updateStore } = require("./store");

const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_DAILY_BUDGET = 85;
const BUDGET_FILE = path.join(__dirname, "..", "data", "live-sync-budget.json");
let timer = null;
let inFlight = false;

const TEAM_NAME_ALIASES = new Map([
  ["墨西哥", "mexico"],
  ["mexico", "mexico"],
  ["南非", "southafrica"],
  ["southafrica", "southafrica"],
  ["加拿大", "canada"],
  ["canada", "canada"],
  ["美国", "usa"],
  ["unitedstates", "usa"],
  ["usa", "usa"],
  ["威尔士", "wales"],
  ["wales", "wales"],
  ["新西兰", "newzealand"],
  ["newzealand", "newzealand"]
]);

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function normalizeTeamName(teamName) {
  const normalized = normalizeToken(teamName);
  return TEAM_NAME_ALIASES.get(normalized) || TEAM_NAME_ALIASES.get(teamName) || normalized;
}

function todayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function ensureBudgetFile() {
  fs.mkdirSync(path.dirname(BUDGET_FILE), { recursive: true });
}

function getSyncBudgetConfig() {
  const dailyLimit = Number(process.env.LIVE_SYNC_DAILY_BUDGET || DEFAULT_DAILY_BUDGET);
  return {
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : DEFAULT_DAILY_BUDGET,
    baseUrl: process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io",
    apiKey: process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_API_KEY || ""
  };
}

function readBudgetState() {
  ensureBudgetFile();
  if (!fs.existsSync(BUDGET_FILE)) {
    return { dayKey: todayKey(), used: 0, lastUpdatedAt: "" };
  }

  try {
    const state = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"));
    const currentDay = todayKey();
    if (state.dayKey !== currentDay) {
      return { dayKey: currentDay, used: 0, lastUpdatedAt: "" };
    }
    return {
      dayKey: state.dayKey || currentDay,
      used: Number(state.used || 0),
      lastUpdatedAt: state.lastUpdatedAt || "",
      lastSuccessfulFetchAt: Number(state.lastSuccessfulFetchAt || 0)
    };
  } catch (error) {
    return { dayKey: todayKey(), used: 0, lastUpdatedAt: "" };
  }
}

function saveBudgetState(state) {
  ensureBudgetFile();
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(state, null, 2));
}

function getBudgetStatus() {
  const config = getSyncBudgetConfig();
  const state = readBudgetState();
  const budgetRemaining = Math.max(config.dailyLimit - (state.used || 0), 0);
  return {
    ...state,
    ...config,
    budgetRemaining,
    used: state.used || 0
  };
}

function consumeBudgetRequest() {
  const status = getBudgetStatus();
  if (status.budgetRemaining <= 0) {
    return { allowed: false, ...status };
  }

  const nextState = {
    dayKey: status.dayKey || todayKey(),
    used: (status.used || 0) + 1,
    lastUpdatedAt: new Date().toISOString(),
    lastSuccessfulFetchAt: Date.now()
  };
  saveBudgetState(nextState);

  return {
    allowed: true,
    ...status,
    ...nextState,
    budgetRemaining: Math.max(status.dailyLimit - nextState.used, 0)
  };
}

function selectSyncMode(matches = []) {
  const liveMatches = (Array.isArray(matches) ? matches : []).filter((match) => match.status === "live" || Boolean(match.liveScore));
  const upcomingMatches = (Array.isArray(matches) ? matches : []).filter((match) => {
    if (match.status === "closed") return false;
    if (!match.kickoffAt) return false;
    return new Date(match.kickoffAt).getTime() - Date.now() < 6 * 60 * 60 * 1000;
  });

  if (liveMatches.length) {
    return { mode: "high", intervalMs: 5 * 60 * 1000, liveMatches: liveMatches.length, upcomingMatches: upcomingMatches.length };
  }
  if (upcomingMatches.length) {
    return { mode: "medium", intervalMs: 10 * 60 * 1000, liveMatches: 0, upcomingMatches: upcomingMatches.length };
  }
  return { mode: "low", intervalMs: 15 * 60 * 1000, liveMatches: 0, upcomingMatches: 0 };
}

function shouldFetchLiveData(matches = [], budgetStatus = {}) {
  if (!budgetStatus || Number(budgetStatus.budgetRemaining || 0) <= 0) {
    return false;
  }

  const liveMatches = (Array.isArray(matches) ? matches : []).filter((match) => match.status === "live" || Boolean(match.liveScore));
  if (liveMatches.length) {
    return true;
  }

  const upcomingMatches = (Array.isArray(matches) ? matches : []).filter((match) => {
    if (match.status === "closed") return false;
    if (!match.kickoffAt) return false;
    return new Date(match.kickoffAt).getTime() - Date.now() < 6 * 60 * 60 * 1000;
  });

  return upcomingMatches.length > 0 && (!budgetStatus.lastSuccessfulFetchAt || Date.now() - Number(budgetStatus.lastSuccessfulFetchAt) >= 30 * 60 * 1000);
}

function normalizeStatus(status, finalScore) {
  const value = String(status || "").toLowerCase();
  if (["closed", "finished", "ended", "full_time", "ft"].includes(value)) return "closed";
  if (["live", "playing", "in_progress", "running", "half_time", "ht"].includes(value)) return "live";
  if (finalScore) return "closed";
  return status || "open";
}

function normalizeReportItem(item = {}) {
  const matchId = item.matchId || item.id || item.match_id || "";
  if (!matchId) return null;

  const finalScore = item.finalScore || item.score || item.liveScore || "";
  const liveScore = item.liveScore || item.currentScore || item.score || finalScore || "";

  return {
    matchId,
    status: normalizeStatus(item.status || item.matchStatus, finalScore),
    finalScore,
    liveScore,
    minute: item.minute || item.matchMinute || "",
    report: item.report || item.summary || item.text || "",
    updatedAt: item.updatedAt || item.reportedAt || new Date().toISOString(),
    lineups: item.lineups || null,
    lineupUpdatedAt: item.lineupUpdatedAt || "",
    lineupSyncStatus: item.lineupSyncStatus || ""
  };
}

function normalizeReportPayload(payload) {
  const source = payload && payload.data ? payload.data : payload;
  const list = Array.isArray(source)
    ? source
    : Array.isArray(source && source.matches)
      ? source.matches
      : Array.isArray(source && source.reports)
        ? source.reports
        : [];

  return list.map(normalizeReportItem).filter(Boolean);
}

function latestItemFromMatch(match) {
  return {
    id: `latest-${match.id}`,
    matchId: match.id,
    home: match.home,
    away: match.away,
    group: match.group || "",
    time: match.time || "",
    venue: match.venue || "",
    status: match.status || "open",
    kickoffAt: match.kickoffAt || "",
    finalScore: match.finalScore || "",
    liveScore: match.liveScore || "",
    minute: match.minute || "",
    report: match.report || match.latestReport || "",
    updatedAt: match.scoreUpdatedAt || match.updatedAt || ""
  };
}

function mapFixtureToMatch(fixture, dataMatches) {
  const home = normalizeTeamName(fixture?.teams?.home?.name || "");
  const away = normalizeTeamName(fixture?.teams?.away?.name || "");

  return (Array.isArray(dataMatches) ? dataMatches : []).find((match) => {
    const candidateHome = normalizeTeamName(match.home || "");
    const candidateAway = normalizeTeamName(match.away || "");
    return candidateHome === home && candidateAway === away;
  }) || null;
}

function filterWorldCupFixtures(fixtures = [], dataMatches = []) {
  const matches = Array.isArray(dataMatches) ? dataMatches : [];

  return fixtures.filter((fixture) => {
    const match = mapFixtureToMatch(fixture, matches);
    if (match) {
      return true;
    }

    const competitionName = String(
      fixture?.league?.name || fixture?.competition?.name || ""
    ).toLowerCase();
    return /world cup|fifa/i.test(competitionName);
  });
}

function normalizeApiFootballFixture(fixture, dataMatches) {
  const match = mapFixtureToMatch(fixture, dataMatches);
  if (!match) return null;

  const status = String(fixture?.fixture?.status?.short || "").toUpperCase();
  const statusLabel = /FT|AET|PEN|CANC|WO|ABD|INT/.test(status)
    ? "closed"
    : /1H|2H|HT|ET|BT|LIVE|P/.test(status)
      ? "live"
      : (fixture?.fixture?.status?.long || match.status || "open");

  const homeGoals = fixture?.goals?.home ?? fixture?.score?.fulltime?.home ?? null;
  const awayGoals = fixture?.goals?.away ?? fixture?.score?.fulltime?.away ?? null;
  const finalScore = homeGoals !== null && awayGoals !== null ? `${homeGoals}:${awayGoals}` : match.finalScore || "";
  const liveScore = fixture?.score?.fulltime ? `${fixture.score.fulltime.home}:${fixture.score.fulltime.away}` : finalScore;
  const minute = fixture?.fixture?.status?.elapsed || match.minute || "";
  const report = fixture?.fixture?.status?.long
    ? `${match.home} ${finalScore || "VS"} ${match.away}，${fixture.fixture.status.long}`
    : match.latestReport || "";

  return {
    matchId: match.id,
    status: statusLabel === "LIVE" || statusLabel === "IN_PLAY" ? "live" : (statusLabel === "FINISHED" ? "closed" : statusLabel),
    finalScore,
    liveScore,
    minute,
    report,
    updatedAt: fixture?.fixture?.date || new Date().toISOString(),
    lineups: match.lineups || null,
    lineupUpdatedAt: match.lineupUpdatedAt || "",
    lineupSyncStatus: match.lineupSyncStatus || "synced"
  };
}

async function fetchReports() {
  const config = getSyncBudgetConfig();
  const legacyUrl = process.env.MATCH_REPORT_URL || process.env.WORLD_CUP_REPORT_URL || "";

  if (config.apiKey) {
    const url = new URL("/fixtures", config.baseUrl);
    url.searchParams.set("live", "all");
    url.searchParams.set("timezone", process.env.API_FOOTBALL_TIMEZONE || "Asia/Shanghai");

    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "x-apisports-key": config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`api-football sync failed: ${response.status}`);
    }

    const payload = await response.json();
    const fixtures = Array.isArray(payload?.response) ? payload.response : [];
    const data = readStore();
    const worldCupFixtures = filterWorldCupFixtures(fixtures, data.matches || []);

    return worldCupFixtures
      .map((fixture) => normalizeApiFootballFixture(fixture, data.matches || []))
      .filter(Boolean);
  }

  if (!legacyUrl) return [];

  const response = await fetch(legacyUrl, {
    headers: {
      accept: "application/json",
      authorization: process.env.MATCH_REPORT_TOKEN ? `Bearer ${process.env.MATCH_REPORT_TOKEN}` : ""
    }
  });
  if (!response.ok) {
    throw new Error(`match report sync failed: ${response.status}`);
  }
  return normalizeReportPayload(await response.json());
}

async function applyReports(reports) {
  if (!reports.length) return { updated: 0 };

  return updateStore((data) => {
    let updated = 0;
    const reportByMatchId = new Map(reports.map((report) => [report.matchId, report]));

    data.matches = (Array.isArray(data.matches) ? data.matches : []).map((match) => {
      const report = reportByMatchId.get(match.id);
      if (!report) return match;
      updated += 1;
      return {
        ...match,
        status: report.status || match.status,
        finalScore: report.finalScore || match.finalScore || "",
        liveScore: report.liveScore || report.finalScore || match.liveScore || "",
        minute: report.minute || match.minute || "",
        latestReport: report.report || match.latestReport || "",
        scoreUpdatedAt: report.updatedAt,
        lineups: report.lineups || match.lineups,
        lineupUpdatedAt: report.lineupUpdatedAt || match.lineupUpdatedAt,
        lineupSyncStatus: report.lineupSyncStatus || match.lineupSyncStatus
      };
    });

    data.latestMatches = data.matches
      .filter((match) => match.status === "live" || match.finalScore || match.liveScore)
      .map(latestItemFromMatch);

    if (!data.latestMatches.length) {
      data.latestMatches = data.matches.slice(0, 3).map(latestItemFromMatch);
    }

    return { updated };
  });
}

async function syncMatchReports() {
  if (inFlight) return { skipped: true };

  const store = readStore();
  const budgetStatus = getBudgetStatus();
  if (!shouldFetchLiveData(store.matches || [], budgetStatus)) {
    return { skipped: true, reason: "budget or idle" };
  }

  inFlight = true;
  try {
    const reports = await fetchReports();
    if (!reports.length) {
      return { updated: 0, skipped: true, reason: "no report data" };
    }

    const applied = await applyReports(reports);
    consumeBudgetRequest();
    return { ...applied, budgetRemaining: Math.max(getBudgetStatus().dailyLimit - getBudgetStatus().used, 0) };
  } finally {
    inFlight = false;
  }
}

function startLiveSync() {
  if (timer || process.env.MATCH_REPORT_SYNC_DISABLED === "true") return null;

  const initialMatches = (readStore().matches || []);
  const mode = selectSyncMode(initialMatches);
  const intervalMs = Number(process.env.MATCH_REPORT_INTERVAL_MS || mode.intervalMs || DEFAULT_INTERVAL_MS);

  syncMatchReports().catch((error) => console.warn(error.message));
  timer = setInterval(() => {
    const liveMode = selectSyncMode(readStore().matches || []);
    const nextInterval = Number(process.env.MATCH_REPORT_INTERVAL_MS || liveMode.intervalMs || DEFAULT_INTERVAL_MS);
    if (timer) {
      clearInterval(timer);
      timer = setInterval(() => {
        syncMatchReports().catch((error) => console.warn(error.message));
      }, nextInterval);
    }
    syncMatchReports().catch((error) => console.warn(error.message));
  }, intervalMs);
  return timer;
}

function stopLiveSync() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  applyReports,
  consumeBudgetRequest,
  filterWorldCupFixtures,
  getBudgetStatus,
  getSyncBudgetConfig,
  normalizeReportPayload,
  selectSyncMode,
  shouldFetchLiveData,
  startLiveSync,
  stopLiveSync,
  syncMatchReports
};
