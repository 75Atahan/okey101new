import assert from 'node:assert/strict';
import { validateMeld } from './okey101.mjs';
import { plan } from './assist.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };
const J = T(1, 5);

// 13'ten sonra 1 gelmez: 12-13-1, 11-12-13-1, 13-1-2 geçersiz; 1-2-3 geçerli
assert.ok(!validateMeld([T(0, 12), T(0, 13), T(0, 1)], okey).valid);
assert.ok(!validateMeld([T(0, 11), T(0, 12), T(0, 13), T(0, 1)], okey).valid);
assert.ok(!validateMeld([T(0, 13), T(0, 1), T(0, 2)], okey).valid);
assert.ok(validateMeld([T(0, 1), T(0, 2), T(0, 3)], okey).valid);
assert.ok(validateMeld([T(0, 11), T(0, 12), T(0, 13)], okey).valid);
// Okey 12-13'ün başına 11 olarak girer, sonuna 1 olarak giremez
assert.equal(validateMeld([T(0, 12), T(0, 13), J], okey).points, 36);
// Yardımlı da 12-13-1 kurmaz
const pl = plan([T(0, 12), T(0, 13), T(0, 1), T(2, 7), T(3, 9)], okey);
assert.equal(pl.groups.length, 0);
console.log('13 den sonra 1 gelmez testleri geçti');
