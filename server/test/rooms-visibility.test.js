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
