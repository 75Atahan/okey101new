import assert from 'node:assert/strict';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
let c = Date.parse('2026-10-06T10:00:00Z');
const wallet = createWallet({ now: () => c });
const rm = createRoomManager({ wallet, clock: () => c });
const { code } = rm.createRoom('a', {});
const U = ['a', 'b', 'c', 'd'];
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
assert.ok(rm.start(code, 'd').ok);                    // yönetici olmayan da başlatabilir (oturan herkes)

function finishRound(seat) {                          // verilen koltuktaki oyuncu eli bitirir
  const g = rm._room(code).game; g.okey = { color: 1, num: 5 }; g.turn = seat; g.phase = 'discard';
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
  g.seats[seat].hand = [...a, ...b, ...d, last];
  assert.ok(rm.act(code, U[seat], { type: 'open', groups: [a, b, d].map(ids) }).ok);
  assert.ok(rm.act(code, U[seat], { type: 'discard', tileId: last.id }).ok);
  assert.ok(rm.view(code, 'a').game.over);
}
finishRound(0);

// Yeni el: tek kişi basınca başlamaz; oyundaki herkes hazır olunca başlar
assert.ok(!rm.nextRound(code, 'x').ok);
let r = rm.nextRound(code, 'c');
assert.ok(r.ok && r.waiting && rm.view(code, 'a').game.over);
assert.equal(rm.view(code, 'a').lobby.ready.filter(Boolean).length, 1);
assert.ok(rm.nextRound(code, 'a').waiting); assert.ok(rm.nextRound(code, 'b').waiting);
const before = rm.balance('a');
r = rm.nextRound(code, 'd');
assert.ok(r.started); assert.equal(rm.view(code, 'a').game.over, null);
assert.equal(rm.balance('a'), before - 2500);

// Biri basmazsa ilk basıştan 20 sn sonra beklenmeden başlar
finishRound(1);
rm.nextRound(code, 'a');
c += 19000; assert.deepEqual(rm.tick(), []);
c += 1500;
assert.equal(rm.tick()[0].kind, 'next');
assert.equal(rm.view(code, 'a').game.over, null);

// Jetonu yetmeyen varsa yeni el başlamaz
finishRound(2);
wallet.charge(['b'], wallet.balance('b'));
U.slice(0, 3).forEach((u) => rm.nextRound(code, u));
assert.match(rm.nextRound(code, 'd').error, /yetersiz/);
assert.ok(rm.view(code, 'a').game.over);
console.log('Yeni el (hazır oylaması) testleri geçti');
