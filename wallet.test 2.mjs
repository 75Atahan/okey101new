import assert from 'node:assert/strict';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';

// --- Cüzdan: günlük sıfırlama (Türkiye saatiyle gece yarısı) ---
let now = Date.parse('2026-10-06T10:00:00Z');
const w = createWallet({ now: () => now });
assert.equal(w.balance('a'), 10000);
assert.ok(!w.charge(['a', 'b'], 20000) && w.balance('a') === 10000);   // hepsi ya da hiçbiri
assert.ok(w.charge(['a'], 4000) && w.balance('a') === 6000);
now = Date.parse('2026-10-06T20:59:00Z'); assert.equal(w.balance('a'), 6000);   // 23:59 TR
now = Date.parse('2026-10-06T21:01:00Z'); assert.equal(w.balance('a'), 10000);  // 00:01 TR: yeni gün

// --- Oda: bedel, ödeme, iade ---
const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
const mk = (opts) => {
  const wallet = createWallet({ now: () => Date.parse('2026-10-06T10:00:00Z') });
  const rm = createRoomManager({ wallet });
  const { code } = rm.createRoom('a', opts);
  ['b', 'c', 'd'].forEach((u) => rm.join(code, u));
  return { rm, code, wallet };
};
// Başlayan oyuncu (koltuk 0 = 'a') eli bitirir
function finish(rm, code) {
  const g = rm._room(code).game;
  g.okey = { color: 1, num: 5 };
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)];
  const c = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
  g.seats[0].hand = [...a, ...b, ...c, last];
  assert.ok(rm.act(code, 'a', { type: 'open', groups: [a, b, c].map(ids) }).ok);
  assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
}
const bal = (rm) => ['a', 'b', 'c', 'd'].map((u) => rm.balance(u));

let { rm, code } = mk({});                       // tekli, katlamasız
assert.ok(rm.start(code, 'a').ok);
assert.deepEqual(bal(rm), [7500, 7500, 7500, 7500]);
finish(rm, code);
assert.deepEqual(bal(rm), [17500, 7500, 7500, 7500]);
assert.deepEqual(rm.view(code, 'a').lobby.lastPayout, [7500, -2500, -2500, -2500]);

({ rm, code } = mk({ katlamali: true }));        // katlamalı: 2 katı gider, 2 katı gelir
rm.start(code, 'a');
assert.deepEqual(bal(rm), [5000, 5000, 5000, 5000]);
finish(rm, code);
assert.deepEqual(bal(rm), [25000, 5000, 5000, 5000]);

({ rm, code } = mk({ mode: 'pairs' }));          // eşli: kazanan takım havuzu paylaşır
rm.start(code, 'a'); finish(rm, code);
assert.deepEqual(bal(rm), [12500, 7500, 12500, 7500]);

({ rm, code } = mk({}));                         // yığın biterse iade
rm.start(code, 'a');
const g = rm._room(code).game; g.pile = [];
assert.ok(rm.act(code, 'a', { type: 'discard', tileId: g.seats[0].hand[0].id }).ok);
assert.deepEqual(bal(rm), [10000, 10000, 10000, 10000]);

({ rm, code } = mk({}));                         // yetersiz jeton: başlatılamaz
const wl = createWallet({ now: () => Date.parse('2026-10-06T10:00:00Z') });
wl.charge(['b'], 8000);
const rm2 = createRoomManager({ wallet: wl });
const c2 = rm2.createRoom('a', {}).code;
['b', 'c', 'd'].forEach((u) => rm2.join(c2, u));
assert.match(rm2.start(c2, 'a').error, /yetersiz/);

({ rm, code } = mk({}));                         // el bitince masadan ayrılınabilir
rm.start(code, 'a'); finish(rm, code);
assert.ok(rm.leave(code, 'd').ok);
// Çift açarak bitirme: jeton ve puan yine 2 katı (kaybedenler bir bedel daha öder)
({ rm, code } = mk({}));
{
  rm.start(code, 'a');
  const g = rm._room(code).game;
  g.okey = { color: 1, num: 5 };
  const pr = [1, 2, 3, 4, 5].map((n) => [T(0, n), T(0, n)]), last = T(3, 2);
  g.seats[0].hand = [...pr.flat(), last];
  assert.ok(rm.act(code, 'a', { type: 'open', groups: pr.map(ids) }).ok);
  assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
  assert.equal(g.over.byPairs, true); assert.equal(g.over.factor, 2);
  assert.deepEqual(bal(rm), [25000, 5000, 5000, 5000]);
  assert.deepEqual(rm.view(code, 'a').lobby.lastPayout, [15000, -5000, -5000, -5000]);
}
console.log('Jeton testleri geçti');
