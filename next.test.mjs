import assert from 'node:assert/strict';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
let c = Date.parse('2026-10-06T10:00:00Z');
const wallet = createWallet({ now: () => c });
const rm = createRoomManager({ wallet, clock: () => c });
const { code } = rm.createRoom('a', {});
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
rm.start(code, 'a');
const g = rm._room(code).game; g.okey = { color: 1, num: 5 };
const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
g.seats[0].hand = [...a, ...b, ...d, last];
rm.act(code, 'a', { type: 'open', groups: [a, b, d].map(ids) });
rm.act(code, 'a', { type: 'discard', tileId: last.id });
assert.ok(rm.view(code, 'a').game.over);

// El bitince yeni el kendiliğinden BAŞLAMAZ; biri "Yeni oyuna başla" demeli
assert.equal(rm.view(code, 'a').lobby.nextAt, null);
c += 60000;
assert.deepEqual(rm.tick(), []);
assert.ok(rm.view(code, 'a').game.over);

// Odada olmayan başlatamaz; oturan herkes başlatabilir, bedel yeniden alınır
assert.ok(!rm.nextRound(code, 'x').ok);
const before = rm.balance('a');
assert.ok(rm.nextRound(code, 'c').ok);
assert.equal(rm.view(code, 'a').game.over, null);
assert.equal(rm.balance('a'), before - 2500);

// Jetonu yetmeyen varsa yeni el başlamaz
const g2 = rm._room(code).game; g2.over = { finisher: 0, withOkey: false, byPairs: false, factor: 1, points: [0, 0, 0, 0], rank: [0, 1, 2, 3], tilesLeft: [0, 1, 2, 3], bonus: true };
wallet.charge(['b'], wallet.balance('b'));
assert.match(rm.nextRound(code, 'a').error, /yetersiz/);
console.log('Yeni el testleri geçti');
