import assert from 'node:assert/strict';
import { newRound, validateMeld, checkOpen, canAddToMeld, createTiles } from './okey101.mjs';

const T = (color, num) => ({ id: Math.random(), color, num, fake: false });
const FAKE = { id: -1, color: -1, num: 0, fake: true };
const okey = { color: 1, num: 5 }; // mavi 5 okey
const J = T(1, 5);

assert.equal(createTiles().length, 106);
const r = newRound();
assert.deepEqual(r.hands.map((h) => h.length), [22, 21, 21, 21]);
assert.equal(r.pile.length, 20);

assert.equal(validateMeld([T(0,7), T(1,7), T(2,7)], okey).points, 21);
assert.equal(validateMeld([T(0,12), T(0,13), T(0,1)], okey).points, 26);
assert.ok(validateMeld([T(0,4), J, T(0,6)], okey).valid);
assert.ok(!validateMeld([T(0,7), T(0,7), T(1,7)], okey).valid);
assert.ok(!validateMeld([T(0,13), T(0,1), T(0,2)], okey).valid);
assert.ok(validateMeld([FAKE, T(0,5), T(2,5)], okey).valid);
assert.ok(canAddToMeld([T(0,7), T(1,7), T(2,7)], T(3,7), okey));

const open = checkOpen([
  [T(0,11), T(0,12), T(0,13)],   // 36
  [T(1,10), T(2,10), T(3,10)],   // 30
  [T(0,9), T(0,10), T(0,11), T(0,12)] // 42
], okey);
assert.deepEqual(open, { mode: 'meld', total: 108, canOpen: true });
console.log('Tüm testler geçti');
