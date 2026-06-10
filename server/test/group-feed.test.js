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
      body: JSON.stringify({ code: `group-${Date.now()}`, silent: true })
    });

    const home = await request(base, "/worldcup/home", {
      headers: { ...headers, authorization: `Bearer ${login.token}` }
    });

    const championGroup = home.groups.find((group) => /冠军/.test(group.name));
    if (!championGroup) {
      throw new Error("Expected champion group to be present in home data");
    }

    if (championGroup.name !== "冠军押注群") {
      throw new Error(`Expected champion group name to be updated, got ${championGroup.name}`);
    }

    const roomsResponse = await request(base, "/worldcup/rooms", {
      headers: { ...headers, authorization: `Bearer ${login.token}` }
    });
    const systemRooms = roomsResponse.rooms.filter((room) => room.id === "group-1" || room.id === "group-2");
    if (systemRooms.length < 2) {
      throw new Error("Expected system groups to exist as rooms for direct entry");
    }

    if (championGroup.memberCount < 30 || championGroup.memberCount > 50) {
      throw new Error(`Expected champion group memberCount to be between 30 and 50, got ${championGroup.memberCount}`);
    }

    if (!championGroup.shareText || !Array.isArray(championGroup.feedMessages) || championGroup.feedMessages.length === 0) {
      throw new Error("Expected group feed metadata to be returned from the server");
    }

    console.log("group feed ok");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
