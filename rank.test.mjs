import assert from 'node:assert/strict';
import { createGame, discard } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };

// Sıralama taş adedine değil kalan sayıların toplamına göre; çift açanın sayıları 2 katı sayılır
let g = createGame({ clock: () => 0 }); g.okey = okey;
g.turn = 0; g.phase = 'discard'; g.seats[0].opened = true; g.seats[0].openMode = 'meld';
const last = T(3, 2); g.seats[0].hand = [last];
g.seats[1].opened = true; g.seats[1].openMode = 'meld'; g.seats[1].hand = [T(0, 13)];                       // 1 taş, toplam 13
g.seats[2].hand = [T(0, 1), T(1, 1), T(2, 1)];                                                               // 3 taş, toplam 3 (açmadı)
g.seats[3].opened = true; g.seats[3].openMode = 'pairs'; g.seats[3].hand = [T(0, 6)];                        // 1 taş, 6 x2 = 12
assert.ok(discard(g, 0, last.id).finished);
assert.deepEqual(g.over.left, [0, 13, 3, 12]);
assert.deepEqual(g.over.rank, [0, 2, 3, 1]);              // bitiren, sonra en az sayı (3), 12, 13
assert.equal(g.over.points[3], 12);                         // çift açanın elde kalan sayısı 2 katı (6 x 2)
assert.equal(g.over.points[1], 13);
assert.equal(g.over.points[2], 202);                        // açmayan

// Çift açıp bitiren: açmayanlar 404 yazar (2 katı)
g = createGame({ clock: () => 0 }); g.okey = okey;
g.turn = 0; g.phase = 'discard'; g.seats[0].opened = true; g.seats[0].openMode = 'pairs';
const l2 = T(3, 2); g.seats[0].hand = [l2];
assert.ok(discard(g, 0, l2.id).finished);
assert.equal(g.over.points[1], 404); assert.equal(g.over.points[0], -202);

// Açtıktan sonra işleyebileceği taşı atmak 101 ceza (okey zaten ceza); işlenemeyen taş ceza yedirmez
g = createGame({ clock: () => 0 }); g.okey = okey;
g.seats[1].opened = true; g.seats[1].openMode = 'meld'; g.seats[1].melds = [[T(0, 11), T(0, 12), T(0, 13)]];
const fit = T(0, 10), other = T(3, 3), more = T(2, 8);
g.turn = 0; g.phase = 'discard'; g.seats[0].opened = true; g.seats[0].openMode = 'meld';
g.seats[0].hand = [fit, other, more];
assert.ok(discard(g, 0, other.id).ok);
assert.equal(g.seats[0].penalty, 0);                        // işlenemeyen taş: ceza yok
g.turn = 0; g.phase = 'discard';
assert.ok(discard(g, 0, fit.id).ok);
assert.equal(g.seats[0].penalty, 101);
assert.equal(g.lastPenalty.why, 'işleyebileceği taşı attı');
// Açmamış oyuncu ya da otomatik atış ceza yemez
g = createGame({ clock: () => 0 }); g.okey = okey;
g.seats[1].opened = true; g.seats[1].openMode = 'meld'; g.seats[1].melds = [[T(0, 11), T(0, 12), T(0, 13)]];
const f2 = T(0, 10); g.turn = 0; g.phase = 'discard'; g.seats[0].hand = [f2, T(3, 3)];
assert.ok(discard(g, 0, f2.id).ok); assert.equal(g.seats[0].penalty, 0);
g.seats[2].opened = true; g.seats[2].openMode = 'meld';
const f3 = T(0, 10); g.turn = 2; g.phase = 'discard'; g.seats[2].hand = [f3, T(3, 3)];
assert.ok(discard(g, 2, f3.id, { free: true }).ok); assert.equal(g.seats[2].penalty, 0);
console.log('Sıralama (sayı toplamı) ve işlenebilir taş cezası testleri geçti');
