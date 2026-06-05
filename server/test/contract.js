const assert = require("assert");
const app = require("../src/index");

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  if (!response.ok || body.code !== 0) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function main() {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-app-key": "worldcup" };

  try {
    const login = await request(base, "/worldcup/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ code: `contract-${Date.now()}`, silent: true })
    });
    assert(login.token, "login.token is required");
    assert(login.user && login.user.id && login.user.name, "login.user fields are required");

    const authHeaders = { ...headers, authorization: `Bearer ${login.token}` };
    const home = await request(base, "/worldcup/home", { headers: authHeaders });
    assert(home.me && home.me.id, "home.me is required");
    assert(Array.isArray(home.matches), "home.matches must be an array");
    assert(Array.isArray(home.rooms), "home.rooms must be an array");
    assert(home.predictions && typeof home.predictions === "object", "home.predictions is required");

    const detail = await request(base, `/worldcup/matches/detail?matchId=${home.matches[0].id}`, { headers: authHeaders });
    assert(detail.match && detail.match.id, "match detail is required");
    assert(detail.match.lineups && Array.isArray(detail.match.lineups.home), "match.lineups.home must be an array");

    const predictionResult = await request(base, "/worldcup/predictions/submit", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        matchId: "m1",
        result: detail.match.aiPick || "home",
        score: "2:1",
        totalGoals: "2-3",
        firstScorer: "test",
        firstScorerSource: "manual",
        confidence: 70
      })
    });
    assert(predictionResult.prediction && predictionResult.prediction.score, "prediction result is required");

    const rooms = await request(base, "/worldcup/rooms", { headers: authHeaders });
    assert(Array.isArray(rooms.rooms), "rooms.rooms must be an array");
    assert(rooms.rooms[0].players && Array.isArray(rooms.rooms[0].players), "room.players must be an array");

    const cheer = await request(base, "/worldcup/rooms/cheer", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ roomId: rooms.rooms[0].id })
    });
    assert(Array.isArray(cheer.rooms), "cheer.rooms must be an array");

    const ranking = await request(base, "/worldcup/rankings?scope=friends", { headers: authHeaders });
    assert(ranking.me && Array.isArray(ranking.players), "ranking fields are required");

    const profile = await request(base, "/worldcup/profile", { headers: authHeaders });
    assert(profile.me && profile.aiStats, "profile fields are required");

    console.log("contract ok");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
