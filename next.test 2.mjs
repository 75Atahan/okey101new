import assert from 'node:assert/strict';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
let c = Date.parse('2026-10-06T10:00:00Z');
const mk = () => {
  const wallet = createWallet({ now: () => c });
  const rm = createRoomManager({ wallet, clock: () => c });
  const { code } = rm.createRoom('a', {});
  ['b', 'c', 'd'].forEach((u) => rm.join(code, u));
  rm.start(code, 'a');
  return { rm, code, wallet };
};
function finish(rm, code) {                                   // koltuk 0 ('a') eli bitirir
  const g = rm._room(code).game; g.okey = { color: 1, num: 5 };
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
  g.seats[0].hand = [...a, ...b, ...d, last];
  rm.act(code, 'a', { type: 'open', groups: [a, b, d].map(ids) });
  rm.act(code, 'a', { type: 'discard', tileId: last.id });
}
const bal = (rm) => ['a', 'b', 'c', 'd'].map((u) => rm.balance(u));

// El bitince 8 sn sonra yeni el kendiliğinden başlar ve bedel yeniden alınır
let { rm, code, wallet } = mk();
finish(rm, code);
let v = rm.view(code, 'a');
assert.equal(v.lobby.nextAt, c + 8000);
assert.deepEqual(v.lobby.balances, [17500, 7500, 7500, 7500]);
c += 7000; assert.deepEqual(rm.tick(), []);
c += 1500;
assert.equal(rm.tick()[0].kind, 'next');
assert.equal(rm.view(code, 'a').game.over, null);
assert.deepEqual(bal(rm), [15000, 5000, 5000, 5000]);
assert.equal(rm.view(code, 'a').lobby.nextAt, null);

// Jetonu yetmeyen varsa yeni el başlamaz
({ rm, code, wallet } = mk());
finish(rm, code);
wallet.charge(['b'], wallet.balance('b'));
c += 8500;
const ev = rm.tick();
assert.equal(ev[0].kind, 'nextFail');
assert.ok(rm.view(code, 'a').game.over);

// Herkes yeni eli (beklemeden) başlatabilir; odada olmayan başlatamaz
({ rm, code } = mk());
finish(rm, code);
assert.ok(!rm.nextRound(code, 'x').ok);
assert.ok(rm.nextRound(code, 'c').ok);
console.log('Otomatik yeni el testleri geçti');
