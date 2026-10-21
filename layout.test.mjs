import assert from 'node:assert/strict';
import { layoutMeld } from './okey101.mjs';
import { createGame, open, discard } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };
const pos = (m) => layoutMeld(m, okey).cells.map((c) => c.pos);

assert.deepEqual(pos([T(0, 12), T(0, 10), T(0, 11)]), [10, 11, 12]);              // dizi sayısına göre hizalanır
let L = layoutMeld([T(0, 13), T(1, 13), T(2, 13)], okey);                          // set: sayı 13
assert.equal(L.kind, 'set'); assert.equal(L.num, 13);
L = layoutMeld([T(0, 4), T(1, 5), T(0, 6)], okey);                                 // okey 5'in yerine
assert.deepEqual(L.cells.map((c) => c.pos), [4, 5, 6]);
assert.equal(L.cells[1].tile.color, 1);
assert.deepEqual(pos([T(0, 12), T(0, 13), T(0, 1)]), [12, 13, 14]);                // 13'ten sonra 1
assert.equal(layoutMeld([T(0, 1), T(2, 9), T(3, 4)], okey).kind, null);            // geçersiz

// Açmayı deneyip açamamak: ceza anında değil, tur açmadan biterse verilir; hiç denemeyene ceza yok
const g = createGame(); g.okey = okey;
const a = [T(0, 11), T(0, 12), T(0, 13)], x = T(3, 2), y = T(2, 6), z = T(1, 9);
g.seats[0].hand = [...a, x, y, z];
let r = open(g, 0, [a.map((t) => t.id)]);                                          // 36 < 101
assert.ok(!r.ok); assert.match(r.error, /101 ceza/);
assert.equal(g.seats[0].penalty, 0); assert.equal(g.seats[0].hand.length, 6);      // taşlar elde, henüz ceza yok
open(g, 0, [a.map((t) => t.id)]);                                                   // tekrar denemek serbest
assert.equal(g.seats[0].penalty, 0);
assert.ok(discard(g, 0, x.id).ok);                                                  // açamadan turu bitirdi
assert.equal(g.seats[0].penalty, 101);
assert.equal(g.lastPenalty.why, 'açmayı denedi ama açamadı');
// Sonraki turda hiç denemeden atan ceza almaz
g.seats[1].hand = [T(0, 1), T(2, 3), T(3, 5)]; g.phase = 'discard';
assert.ok(discard(g, 1, g.seats[1].hand[0].id).ok);
assert.equal(g.seats[1].penalty, 0);
console.log('Yerleşim ve ceza testleri geçti');
