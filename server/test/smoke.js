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
    await request(base, "/worldcup/health");

    const login = await request(base, "/worldcup/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ code: `smoke-${Date.now()}`, silent: true })
    });

    const authHeaders = {
      ...headers,
      authorization: `Bearer ${login.token}`
    };

    await request(base, "/worldcup/home", { headers: authHeaders });
    await request(base, "/worldcup/matches/detail?matchId=m2", { headers: authHeaders });
    await request(base, "/worldcup/predictions/submit", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        matchId: "m2",
        result: "主胜",
        score: "2:1",
        totalGoals: "2-3",
        firstScorer: "姆巴佩",
        firstScorerSource: "manual",
        confidence: 70
      })
    });

    const roomsResponse = await request(base, "/worldcup/rooms", { headers: authHeaders });
    const roomId = roomsResponse.rooms.find((room) => room.id === "group-1")?.id || roomsResponse.rooms[0]?.id;

    if (!roomId) {
      throw new Error("Expected at least one room to be available for smoke testing");
    }

    await request(base, "/worldcup/rooms/cheer", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ roomId })
    });
    await request(base, "/worldcup/rankings?scope=friends", { headers: authHeaders });

    console.log("smoke ok");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
