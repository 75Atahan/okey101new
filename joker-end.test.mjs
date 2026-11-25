import assert from 'node:assert/strict';
import { jokerReplaceIndex, canAddToMeld, validateMeld } from './okey101.mjs';

let id = 1; const T = (c, n) => ({ id: id++, color: c, num: n, fake: false });
const okey = { color: 0, num: 10 };            // okey: sarı 10
const J = () => T(0, 10);
// 11-12-OKEY: okey 13 yerindedir. 10 gelirse okey alınmaz, 10 başa işlenir; 13 gelirse okey alınır.
const run = [T(1, 11), T(1, 12), J()];
assert.equal(jokerReplaceIndex(run, T(1, 10), okey), -1);
assert.ok(canAddToMeld(run, T(1, 10), okey), '10 başa eklenebilmeli');
assert.equal(jokerReplaceIndex(run, T(1, 13), okey), 2);
// Ortadaki okey: 4-5-OKEY-7 -> 6 okeyi alır
const mid = [T(2, 4), T(2, 5), J(), T(2, 7)];
assert.equal(jokerReplaceIndex(mid, T(2, 6), okey), 2);
assert.equal(jokerReplaceIndex(mid, T(2, 8), okey), -1);
// 4 taşlı grup: eksik renk okeyi alır
const set4 = [T(0, 8), J(), T(1, 8), T(2, 8)];
assert.equal(jokerReplaceIndex(set4, T(3, 8), okey), 1);
console.log('Seride okey yalnızca yerindeki taşla alınır (uca işleme ayrı) testleri geçti');
