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

// --- Oda: bedel ve ödül ---
const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
const mk = (opts) => {
  const wallet = createWallet({ now: () => Date.parse('2026-10-06T10:00:00Z') });
  const rm = createRoomManager({ wallet });
  const { code } = rm.createRoom('a', opts);
  ['b', 'c', 'd'].forEach((u) => rm.join(code, u));
  return { rm, code, wallet };
};
// Diğer ellerin taş sayıları: b=8, c=12, d=5  -> sıralama a (bitiren), d, b, c
const shape = (g, sizes) => sizes.forEach((n, i) => n && (g.seats[i].hand = g.seats[i].hand.slice(0, n)));
function finish(rm, code, sizes = [null, 8, 12, 5]) {           // koltuk 0 ('a') eli seri açıp bitirir
  const g = rm._room(code).game; g.okey = { color: 1, num: 5 };
  shape(g, sizes);
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)];
  const c = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
  g.seats[0].hand = [...a, ...b, ...c, last];
  assert.ok(rm.act(code, 'a', { type: 'open', groups: [a, b, c].map(ids) }).ok);
  assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
}
const bal = (rm) => ['a', 'b', 'c', 'd'].map((u) => rm.balance(u));

let { rm, code } = mk({});                      // tekli, katlamasız: bitiren 15.000, ikinci bedelini geri alır
assert.ok(rm.start(code, 'a').ok);
assert.deepEqual(bal(rm), [7500, 7500, 7500, 7500]);
finish(rm, code);
assert.deepEqual(bal(rm), [22500, 7500, 7500, 10000]);
assert.deepEqual(rm.view(code, 'a').lobby.lastPayout, [12500, -2500, -2500, 0]);
assert.deepEqual(rm._room(code).game.over.rank, [0, 3, 1, 2]);

({ rm, code } = mk({ katlamali: true }));       // katlamalı: bedel ve ödül 2 katı
rm.start(code, 'a');
assert.deepEqual(bal(rm), [5000, 5000, 5000, 5000]);
finish(rm, code);
assert.deepEqual(bal(rm), [35000, 5000, 5000, 10000]);

({ rm, code } = mk({ mode: 'pairs' }));         // eşli: kazanan takım 15.000'i paylaşır
rm.start(code, 'a'); finish(rm, code);
assert.deepEqual(bal(rm), [15000, 7500, 15000, 7500]);

({ rm, code } = mk({}));                        // kimse bitirmezse: en az taş kalan 7.500, ikinci 2.500
rm.start(code, 'a');
{
  const g = rm._room(code).game; g.pile = [];
  shape(g, [null, 15, 20, 18]);
  assert.ok(rm.act(code, 'a', { type: 'discard', tileId: g.seats[0].hand[0].id }).ok);
  assert.deepEqual(g.over.rank.slice(0, 2), [1, 3]); assert.equal(g.over.bonus, false);
  assert.deepEqual(bal(rm), [7500, 15000, 7500, 10000]);
}

({ rm, code } = mk({}));                        // çift açarak bitirme: aynı büyük ödül, puan 2 katı
rm.start(code, 'a');
{
  const g = rm._room(code).game; g.okey = { color: 1, num: 5 };
  shape(g, [null, 8, 12, 5]);
  const pr = [1, 2, 3, 4, 5].map((n) => [T(0, n), T(0, n)]), last = T(3, 2);
  g.seats[0].hand = [...pr.flat(), last];
  assert.ok(rm.act(code, 'a', { type: 'open', groups: pr.map(ids) }).ok);
  assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
  assert.equal(g.over.byPairs, true); assert.equal(g.over.factor, 2);
  assert.deepEqual(bal(rm), [22500, 7500, 7500, 10000]);
}

({ rm, code } = mk({}));                        // yetersiz jeton: başlatılamaz
const wl = createWallet({ now: () => Date.parse('2026-10-06T10:00:00Z') });
wl.charge(['b'], 8000);
const rm2 = createRoomManager({ wallet: wl });
const c2 = rm2.createRoom('a', {}).code;
['b', 'c', 'd'].forEach((u) => rm2.join(c2, u));
assert.match(rm2.start(c2, 'a').error, /yetersiz/);

({ rm, code } = mk({}));                        // el bitince masadan ayrılınabilir
rm.start(code, 'a'); finish(rm, code);
assert.ok(rm.leave(code, 'd').ok);
console.log('Jeton testleri geçti');
