import assert from 'node:assert/strict';
import { layoutMeld } from './okey101.mjs';
import { createGame, open } from './game101.mjs';

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

// Hatalı açış: 101 ceza, turda bir kez; taşlar elde kalır
const g = createGame(); g.okey = okey;
const a = [T(0, 11), T(0, 12), T(0, 13)], x = T(3, 2), y = T(2, 6);
g.seats[0].hand = [...a, x, y];
let r = open(g, 0, [a.map((t) => t.id)]);                                          // 36 < 101
assert.ok(!r.ok); assert.match(r.error, /Hatalı açış.*101/);
assert.equal(g.seats[0].penalty, 101); assert.equal(g.seats[0].hand.length, 5);
r = open(g, 0, [a.map((t) => t.id)]);
assert.equal(g.seats[0].penalty, 101);                                              // aynı turda ikinci ceza yok
assert.ok(!/ceza puanı\)/.test(r.error));
console.log('Yerleşim ve ceza testleri geçti');
