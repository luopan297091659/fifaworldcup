const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/index');

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  if (!response.ok || body.code !== 0) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function login(base, code) {
  return request(base, '/worldcup/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-key': 'worldcup' },
    body: JSON.stringify({ code, silent: true })
  });
}

async function getRooms(base, token) {
  return request(base, '/worldcup/rooms', {
    headers: {
      'content-type': 'application/json',
      'x-app-key': 'worldcup',
      authorization: `Bearer ${token}`
    }
  });
}

test('system groups should expose synced member roster for chat', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const user = await login(base, `group-sync-${Date.now()}`);
    const rooms = await getRooms(base, user.token);
    const championGroup = rooms.rooms.find((room) => room.id === 'group-1');

    assert.ok(championGroup, 'expected system group room to exist');
    assert.ok(Array.isArray(championGroup.players) && championGroup.players.length >= 2,
      'expected system group room to include synced member roster');
    assert.ok(championGroup.players.some((player) => player.name === '阿宁'),
      'expected system group members to be exposed to the chat page');
  } finally {
    server.close();
  }
});

test('room listings should support since-based live sync polling', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const user = await login(base, `room-sync-${Date.now()}`);
    const since = new Date(Date.now() + 60 * 1000).toISOString();

    const rooms = await request(base, `/worldcup/rooms?since=${encodeURIComponent(since)}`, {
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${user.token}`
      }
    });

    assert.deepEqual(rooms.rooms, [], 'expected since-based polling to return only updated rooms');
  } finally {
    server.close();
  }
});

test('room messages should be persisted and visible to members', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `room-msg-owner-${Date.now()}`);
    const member = await login(base, `room-msg-member-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `讨论同步-${Date.now()}`,
        topic: '同步讨论内容',
        type: '公开',
        isPublic: true
      })
    });

    await request(base, '/worldcup/rooms/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id, text: '这场必须看，大家一起讨论。' })
    });

    const rooms = await getRooms(base, member.token);
    const room = rooms.rooms.find((item) => item.id === created.room.id);

    assert.ok(room, 'expected room to be visible to member');
    assert.ok(
      Array.isArray(room.feedMessages) && room.feedMessages.some((item) => /这场必须看/.test(String(item))),
      'expected sent message to be stored in room feed for other members'
    );
  } finally {
    server.close();
  }
});
