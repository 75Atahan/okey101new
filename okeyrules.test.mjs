import assert from 'node:assert/strict';
import { findWinning, pairsOk, partition, finishTiles, maxCover } from './okeyrules.mjs';

let nid = 1;
const T = (color, num) => ({ id: nid++, color, num, fake: false });
const F = () => ({ id: nid++, color: -1, num: 0, fake: true });
const okey = { color: 0, num: 6 };                // okey: sarı 6 (gösterge sarı 5)
const J = () => T(0, 6);                          // okey taşı (joker)
const run = (c, a, b) => Array.from({ length: b - a + 1 }, (_, i) => T(c, a + i));

// 1) 3 + 4 + 3 + 4 = 14: iki seri, iki grup
const good = [...run(1, 1, 3), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), T(3, 12)];
assert.equal(good.length, 14);
assert.equal(findWinning(good, okey)?.kind, 'melds');
// 2) bir taş uymuyorsa bitmez
const bad = [...good.slice(0, 13), T(3, 2)];
assert.equal(findWinning(bad, okey), null);
// 3) okey eksik taşı tamamlar (1-2-OKEY)
const withJ = [T(1, 1), T(1, 2), J(), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), T(3, 12)];
assert.equal(findWinning(withJ, okey)?.kind, 'melds');
// 4) sahte okey okey taşının yüzünü taşır: sarı 5, SAHTE(=sarı 6), sarı 7
const fake = [T(0, 5), F(), T(0, 7), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), T(3, 12)];
assert.equal(findWinning(fake, okey)?.kind, 'melds');
// 5) artan okey bir pere eklenir (13 taş per + 1 okey)
const extra = [...run(1, 1, 3), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), J()];
assert.equal(findWinning(extra, okey)?.kind, 'melds');
// 6) 13'ten sonra 1 gelmez: 12-13-1 geçersiz
const wrap = [T(1, 12), T(1, 13), T(1, 1), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 2), T(1, 2), T(2, 2), T(3, 2)];
assert.equal(findWinning(wrap, okey), null);
// 7) 7 çift (+ okey tek kalanı tamamlar)
const pairs = [T(1, 1), T(1, 1), T(2, 3), T(2, 3), T(3, 5), T(3, 5), T(1, 7), T(1, 7), T(2, 9), T(2, 9), T(3, 11), T(3, 11), T(1, 13), J()];
assert.ok(pairsOk(pairs, okey)); assert.equal(findWinning(pairs, okey)?.kind, 'pairs');
const notPairs = [...pairs.slice(0, 12), T(1, 13), T(2, 13)];
assert.ok(!pairsOk(notPairs, okey));
// 8) 15 taşlı elde bitiren taşı bulur
const hand15 = [...good, T(3, 1)];
const ids = finishTiles(hand15, okey);
assert.ok(ids.includes(hand15[14].id) && ids.length >= 1);
assert.deepEqual(finishTiles(good, okey), []);          // 14 taşlıda önce taş çekilmeli
// 9) 1-13 serisi bölünüp okey bir pere eklenir; 13 taşa fazladan 13 eklenemez
const long = [...run(1, 1, 13), T(1, 13)];
assert.equal(findWinning(long, okey), null);            // 13'ten sonra bir 13 daha: seriye girmez
assert.equal(findWinning([...run(1, 1, 13), J()], okey)?.kind, 'melds');   // 1..13 + okey 14 taş? okey seriye eklenemez -> bitmemeli
console.log('Klasik Okey kural testleri geçti');
