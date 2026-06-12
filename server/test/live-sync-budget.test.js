const assert = require("node:assert/strict");
const {
  filterWorldCupFixtures,
  getSyncBudgetConfig,
  normalizeStatus,
  selectSyncMode,
  shouldFetchLiveData
} = require("../src/liveSync");

async function main() {
  const config = getSyncBudgetConfig();
  assert.equal(config.dailyLimit, 85, "default daily budget should be 85 requests");

  const highMode = selectSyncMode([
    { id: "m1", status: "live" },
    { id: "m2", status: "open" }
  ]);
  assert.equal(highMode.mode, "high", "live matches should use high-intensity mode");
  assert.ok(highMode.intervalMs <= 5 * 60 * 1000, "high mode should poll frequently");

  const lowMode = selectSyncMode([
    { id: "m1", status: "open" },
    { id: "m2", status: "closed" }
  ]);
  assert.equal(lowMode.mode, "low", "idle matches should use low-intensity mode");

  const fetchNow = shouldFetchLiveData([
    { id: "m1", status: "live", kickoffAt: new Date().toISOString() }
  ], {
    lastSuccessfulFetchAt: Date.now() - 60 * 1000,
    budgetRemaining: 10,
    budgetUsed: 75
  });
  assert.equal(fetchNow, true, "live fixtures should be fetched when there are live matches and budget remains");

  const filtered = filterWorldCupFixtures([
    {
      fixture: { id: 1, date: "2026-06-11T19:00:00+00:00", status: { short: "FT", long: "Match Finished" } },
      teams: { home: { name: "墨西哥" }, away: { name: "南非" } },
      goals: { home: 2, away: 0 },
      league: { name: "FIFA World Cup" }
    },
    {
      fixture: { id: 2, date: "2026-06-11T19:00:00+00:00", status: { short: "FT", long: "Match Finished" } },
      teams: { home: { name: "巴塞罗那" }, away: { name: "皇家马德里" } },
      goals: { home: 3, away: 1 },
      league: { name: "La Liga" }
    }
  ], [
    { home: "墨西哥", away: "南非" },
    { home: "加拿大", away: "新西兰" }
  ]);

  assert.equal(filtered.length, 1, "non-World Cup fixtures should be ignored");
  assert.equal(filtered[0].fixture.id, 1, "only the 2026 World Cup fixture should remain");

  assert.equal(normalizeStatus("FT", "2:0"), "closed", "FT should be treated as finished");
  assert.equal(normalizeStatus("Match Finished", "2:0"), "closed", "finished long-label should also be treated as closed");
  assert.equal(normalizeStatus("1H", ""), "live", "in-play status should remain live");

  console.log("live-sync budget test ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
