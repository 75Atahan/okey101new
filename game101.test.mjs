import assert from 'node:assert/strict';
import { createGame, draw, open, addToMeld, discard, cancelDiscardDraw, viewFor } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });

// Akış: sıra kontrolleri
let g = createGame({ mode: 'pairs' });
assert.equal(g.seats[0].hand.length, 22);
assert.equal(g.phase, 'discard');
assert.ok(!draw(g, 0, 'pile').ok);                       // taş atmadan çekemez
assert.ok(!discard(g, 1, g.seats[1].hand[0].id).ok);     // sıra onda değil
const first = g.seats[0].hand[0];
assert.ok(discard(g, 0, first.id).ok);
assert.equal(g.turn, 1);
assert.ok(draw(g, 1, 'discard').ok);                     // soldaki atığı alır
assert.equal(g.seats[1].hand.length, 22);
assert.ok(!('handCount' in viewFor(g, 1).others[0]));

// Eli bitirme: aç, işle, son taşı at
g = createGame({ mode: 'pairs' });
g.okey = { color: 1, num: 5 };
const run1 = [T(0, 11), T(0, 12), T(0, 13)];
const set1 = [T(1, 10), T(2, 10), T(3, 10)];
const run2 = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)];
const add = T(0, 13), last = T(3, 2);
g.seats[0].hand = [...run1, ...set1, ...run2, add, last];
assert.ok(!open(g, 0, [run1.map((t) => t.id)]).ok);      // 36 < 101
const o = open(g, 0, [run1, set1, run2].map((m) => m.map((t) => t.id)));
assert.ok(o.ok && o.total === 108);
assert.ok(addToMeld(g, 0, 0, 2, add.id).ok);
const d = discard(g, 0, last.id);
assert.ok(d.finished && g.over.finisher === 0);
assert.equal(g.scores[0], -101);   // başarısız deneme sonra açtı: ceza yok
assert.equal(g.scores[1], 202);
assert.deepEqual(g.teamScores, [-101 + 202, 202 + 202]);

// Atık taş zorunluluğu: vazgeç hamlesi
g = createGame();
const x0 = g.seats[0].hand[0];
discard(g, 0, x0.id);
draw(g, 1, 'discard');
assert.equal(g.mustUse, x0.id);
assert.ok(!discard(g, 1, g.seats[1].hand[0].id).ok);     // kullanmadan atamaz
assert.ok(cancelDiscardDraw(g, 1).ok);                    // geri verir
assert.equal(g.seats[1].hand.length, 21);
assert.equal(g.discardPiles[0].at(-1).id, x0.id);
assert.equal(g.phase, 'draw');
assert.ok(draw(g, 1, 'pile').ok);                         // yığından çeker
assert.equal(g.mustUse, null);

// Atık taşla açmak zorunlu
g = createGame();
g.okey = { color: 1, num: 5 };
const X = T(0, 13);
g.seats[0].hand[0] = X;
discard(g, 0, X.id);
const ra = [T(0, 11), T(0, 12)], sb = [T(1, 10), T(2, 10), T(3, 10)];
const rc = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], lastT = T(3, 2);
g.seats[1].hand = [...ra, ...sb, ...rc, lastT];
draw(g, 1, 'discard');
const ids = (m) => m.map((t) => t.id);
const bad = open(g, 1, [ids(sb), ids(rc)]);
assert.ok(!bad.ok);                                       // atık taş yok / şart sağlanmıyor
assert.ok(open(g, 1, [[...ids(ra), X.id], ids(sb), ids(rc)]).ok);
assert.equal(g.mustUse, null);
assert.ok(discard(g, 1, lastT.id).finished);
console.log('Atık taş zorunluluğu testleri geçti');
