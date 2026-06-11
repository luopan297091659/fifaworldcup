const { updateStore } = require("./store");

const DEFAULT_INTERVAL_MS = 60 * 1000;
let timer = null;
let inFlight = false;

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

async function fetchReports() {
  const url = process.env.MATCH_REPORT_URL || process.env.WORLD_CUP_REPORT_URL || "";
  if (!url) return [];

  const response = await fetch(url, {
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
  inFlight = true;
  try {
    const reports = await fetchReports();
    return applyReports(reports);
  } finally {
    inFlight = false;
  }
}

function startLiveSync() {
  if (timer || process.env.MATCH_REPORT_SYNC_DISABLED === "true") return null;
  const intervalMs = Number(process.env.MATCH_REPORT_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  syncMatchReports().catch((error) => console.warn(error.message));
  timer = setInterval(() => {
    syncMatchReports().catch((error) => console.warn(error.message));
  }, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS);
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
  normalizeReportPayload,
  startLiveSync,
  stopLiveSync,
  syncMatchReports
};
