import assert from 'node:assert/strict';
import { createGame, startRound, draw, discard, viewFor, autoPlay, timedOut } from './okey.mjs';

let nid = 5000;
const T = (color, num) => ({ id: nid++, color, num, fake: false });
const run = (c, a, b) => Array.from({ length: b - a + 1 }, (_, i) => T(c, a + i));
const clock = (() => { let t = 0; const f = () => t; f.set = (v) => (t = v); return f; })();
const winner14 = () => [...run(1, 1, 3), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), T(3, 12)];

// Dağıtım: başlayan 15, diğerleri 14, gösterge ayrı, yığında 48 taş
let g = createGame({ mode: 'single', turnSeconds: 45, clock });
assert.deepEqual(g.seats.map((s) => s.hand.length), [15, 14, 14, 14]);
assert.equal(g.pile.length, 106 - 1 - 57);
assert.equal(g.turn, 0); assert.equal(g.phase, 'discard');
const v = viewFor(g, 1);
assert.equal(v.kind, 'okey'); assert.equal(v.hand.length, 14); assert.equal(v.pileCount, 48); assert.equal(v.over, null);
assert.equal(v.others.length, 4); assert.ok(v.others.every((o) => Array.isArray(o.melds) && o.melds.length === 0));

// Sıra ve çekme kuralları
assert.equal(draw(g, 0, 'pile').ok, false);                     // başlayan zaten 15 taşlı, önce atmalı
const first = g.seats[0].hand.find((t) => !(t.color === g.okey.color && t.num === g.okey.num));
assert.ok(discard(g, 0, first.id).ok);
assert.equal(g.turn, 1); assert.equal(g.phase, 'draw');
assert.equal(discard(g, 1, g.seats[1].hand[0].id).ok, false);   // çekmeden atılmaz
assert.equal(draw(g, 2, 'pile').ok, false);                     // sıra 1'de
assert.ok(draw(g, 1, 'discard').ok);                            // soldakinin attığı taşı alır
assert.equal(g.seats[1].hand.length, 15);
assert.equal(g.discardPiles[0].length, 0);

// Normal bitiş: 14 taş geçerli + 15. taşı atar -> 1 puan
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
let extra = T(3, 1);
g.seats[0].hand = [...winner14(), extra];
assert.ok(discard(g, 0, extra.id).finished);
assert.equal(g.over.finisher, 0); assert.equal(g.over.factor, 1); assert.deepEqual(g.scores, [1, 0, 0, 0]);
assert.equal(g.over.byPairs, false); assert.equal(g.over.withOkey, false); assert.equal(g.over.rank[0], 0);

// Okey atarak bitiş: x2
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
const joker = T(0, 6);
g.seats[0].hand = [...winner14(), joker];
assert.ok(discard(g, 0, joker.id).finished);
assert.equal(g.over.withOkey, true); assert.equal(g.over.factor, 2);

// Çiftle bitiş: x2; çift + okey atarak: x4
const pairs14 = () => [T(1, 1), T(1, 1), T(2, 3), T(2, 3), T(3, 5), T(3, 5), T(1, 7), T(1, 7), T(2, 9), T(2, 9), T(3, 11), T(3, 11), T(1, 13), T(1, 13)];
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
extra = T(2, 2); g.seats[0].hand = [...pairs14(), extra];
assert.ok(discard(g, 0, extra.id).finished); assert.equal(g.over.byPairs, true); assert.equal(g.over.factor, 2);
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
const j2 = T(0, 6); g.seats[0].hand = [...pairs14(), j2];
discard(g, 0, j2.id); assert.equal(g.over.factor, 4);

// Eşli: takım toplamı
g = createGame({ mode: 'pairs', clock }); g.okey = { color: 0, num: 6 };
extra = T(3, 1); g.seats[0].hand = [...winner14(), extra]; discard(g, 0, extra.id);
assert.deepEqual(g.over.teams, [1, 0]); assert.deepEqual(g.teamScores, [1, 0]);

// Kazanmayan atış oyunu sürdürür; yığın bitince berabere
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
g.pile = []; g.seats[0].hand = [...winner14().slice(0, 13).reverse(), T(3, 2), T(2, 1)];
const r = discard(g, 0, g.seats[0].hand[0].id);
assert.ok(r.drawGame && g.over.finisher === null && g.over.points.every((x) => x === 0));

// Yeni el: puanlar birikir, başlayan döner
g = createGame({ clock }); g.okey = { color: 0, num: 6 };
extra = T(3, 1); g.seats[0].hand = [...winner14(), extra]; discard(g, 0, extra.id);
startRound(g); assert.equal(g.roundNo, 2); assert.equal(g.turn, 1); assert.equal(g.scores[0], 1);
assert.deepEqual(g.seats.map((s) => s.hand.length), [14, 15, 14, 14]);

// Süre dolunca otomatik oynar
g = createGame({ clock, turnSeconds: 10 }); clock.set(0); g.deadline = 10000;
assert.equal(timedOut(g), false); clock.set(10001); assert.equal(timedOut(g), true);
const ap = autoPlay(g); assert.ok(ap.ok && g.turn === 1);
clock.set(30000); assert.ok(timedOut(g)); const ap2 = autoPlay(g); assert.ok(ap2.ok);
assert.equal(g.seats[1].hand.length, 14);
console.log('Klasik Okey oyun akışı testleri geçti');
