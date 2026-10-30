import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
// Jeton sistemi kapalıyken (varsayılan): bedel, ödül, bakiye yok; botlu oda da etiketsiz
let c = 0;
const rm = createRoomManager({ clock: () => c });
const { code } = rm.createRoom('a', { bots: 0 });
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
assert.ok(rm.start(code, 'a').ok);
let v = rm.view(code, 'a');
assert.equal(v.lobby.stake, 0); assert.equal(v.lobby.practice, false); assert.equal(v.balance, null);
const g = rm._room(code).game; g.okey = { color: 1, num: 5 };
const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
g.seats[0].hand = [...a, ...b, ...d, last];
assert.ok(rm.act(code, 'a', { type: 'open', groups: [a, b, d].map(ids) }).ok);
assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
v = rm.view(code, 'a');
assert.ok(v.game.over); assert.equal(v.lobby.lastPayout, null); assert.equal(v.lobby.balances, null);
const r2 = rm.createRoom('x', { bots: 2 }).code;
assert.equal(rm.view(r2, 'x').lobby.practice, false);
console.log('Jetonsuz (para yok) testleri geçti');
