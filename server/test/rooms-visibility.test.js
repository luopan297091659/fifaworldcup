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

test('new rooms default to private visibility when isPublic is not provided', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-default-${Date.now()}`);
    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ name: `默认私密-${Date.now()}` })
    });

    assert.equal(created.room.isPublic, false, 'new room should default to private');
    assert.equal(created.room.type, '私密', 'new room type should reflect private visibility');

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});

test('public rooms should be visible to other users after creation', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-public-owner-${Date.now()}`);
    const other = await login(base, `visibility-public-other-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `公开小组-${Date.now()}`,
        topic: '所有人都能看到',
        type: '公开',
        isPublic: true
      })
    });

    assert.equal(created.room.isPublic, true, 'created room should be public');

    const publicRooms = await getRooms(base, other.token);
    assert.equal(
      publicRooms.rooms.some((room) => room.id === created.room.id),
      true,
      'public room should appear in other users\' room list'
    );

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});

test('public visibility should also work when isPublic is provided as a truthy string', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-string-owner-${Date.now()}`);
    const other = await login(base, `visibility-string-other-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `兼容公开-${Date.now()}`,
        topic: '兼容旧客户端值',
        type: '公开',
        isPublic: 'true'
      })
    });

    assert.equal(created.room.isPublic, true, 'string truthy visibility should still be treated as public');

    const publicRooms = await getRooms(base, other.token);
    assert.equal(
      publicRooms.rooms.some((room) => room.id === created.room.id),
      true,
      'string visibility should still make the room visible to other users'
    );

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});

test('public visibility should still work when type is omitted and isPublic is a truthy string', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-legacy-owner-${Date.now()}`);
    const other = await login(base, `visibility-legacy-other-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `兼容旧客户端-${Date.now()}`,
        topic: '无需传 type 也能公开',
        isPublic: 'true'
      })
    });

    assert.equal(created.room.isPublic, true, 'legacy truthy string should still create a public room');

    const publicRooms = await getRooms(base, other.token);
    assert.equal(
      publicRooms.rooms.some((room) => room.id === created.room.id),
      true,
      'legacy truthy visibility should make the room visible to other users'
    );

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});

test('public rooms should always be labeled as public even if the client sends a stale private type', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-label-owner-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `类型同步-${Date.now()}`,
        topic: '即使客户端传错类型也要公开',
        type: '私密',
        isPublic: true
      })
    });

    assert.equal(created.room.isPublic, true, 'room should remain public');
    assert.equal(created.room.type, '公开', 'room type should be normalized to public when isPublic is true');

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});

test('private rooms stay hidden from non-members but remain shareable via invite link', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const owner = await login(base, `visibility-owner-${Date.now()}`);
    const invitee = await login(base, `visibility-invitee-${Date.now()}`);

    const created = await request(base, '/worldcup/rooms/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({
        name: `私密小组-${Date.now()}`,
        topic: '仅成员可见',
        type: '私密',
        isPublic: false
      })
    });

    assert.equal(created.room.isPublic, false, 'created room should preserve private visibility');

    const inviteeRooms = await getRooms(base, invitee.token);
    assert.equal(
      inviteeRooms.rooms.some((room) => room.id === created.room.id),
      false,
      'private room should not appear in the public room list'
    );

    const inviteLinkRooms = await request(base, `/worldcup/rooms?roomId=${created.room.id}`, {
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${invitee.token}`
      }
    });
    assert.equal(
      inviteLinkRooms.rooms.some((room) => room.id === created.room.id),
      true,
      'share link should still expose the private room for the invitee'
    );

    await request(base, '/worldcup/rooms/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-key': 'worldcup',
        authorization: `Bearer ${owner.token}`
      },
      body: JSON.stringify({ roomId: created.room.id })
    });
  } finally {
    server.close();
  }
});
