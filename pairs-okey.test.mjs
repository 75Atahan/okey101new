import assert from 'node:assert/strict';
import { plan } from './assist.mjs';
import { isJoker } from './okey101.mjs';

// Çift açarken okey, elin en yüksek sayılı tek taşıyla eşleşir
let id = 1; const T = (c, n) => ({ id: id++, color: c, num: n, fake: false });
const okey = { color: 2, num: 6 };
const J = T(2, 6);
const pairs = [3, 5, 8, 10, 12].flatMap((n) => [T(0, n), T(0, n)]);
const hand = [...pairs, T(0, 2), T(1, 7), T(3, 13), J, T(3, 1)];
const pl = plan(hand, okey, { prefer: 'pairs', minPairs: 5 });
assert.equal(pl.mode, 'pairs');
const withJ = pl.groups.find((g) => g.includes(J.id));
assert.ok(withJ, 'okey bir çifte girmeli');
const mate = hand.find((t) => t.id !== J.id && withJ.includes(t.id));
assert.equal(mate.num, 13, `okey en yüksek tek taşa (13) bağlanmalı, ${mate.num} ile eşleşti`);
assert.ok(isJoker(J, okey));
console.log('Çift açarken okey en yüksek taşa bağlanıyor testleri geçti');
