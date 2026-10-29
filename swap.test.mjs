import assert from 'node:assert/strict';
import { jokerReplaceIndex } from './okey101.mjs';
import { createGame, addToMeld } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };
const setup = (meld, hand) => {
  const g = createGame(); g.okey = okey;
  g.seats[0].opened = true; g.seats[0].openMode = 'meld'; g.seats[0].melds = [meld]; g.seats[0].hand = hand;
  return g;
};

// Dizi: sarı4, okey, sarı6 -> elde sarı5 varsa okeyin yerine konur, okey ıstakaya döner
const J = T(1, 5), five = T(0, 5), extra = T(3, 2);
assert.equal(jokerReplaceIndex([T(0, 4), J, T(0, 6)], five, okey), 1);
let g = setup([T(0, 4), J, T(0, 6)], [five, extra]);
let r = addToMeld(g, 0, 0, 0, five.id);
assert.ok(r.ok && r.swapped);
assert.ok(g.seats[0].hand.some((t) => t.id === J.id));              // okey ıstakada
assert.equal(g.seats[0].melds[0][1].id, five.id);                   // yerinde sarı 5
assert.equal(g.seats[0].hand.length, 2);

// Uzatma: sarı 7 sona eklenir, okey yerinde kalır
const seven = T(0, 7);
g = setup([T(0, 4), J, T(0, 6)], [seven, extra]);
r = addToMeld(g, 0, 0, 0, seven.id);
assert.ok(r.ok && !r.swapped);
assert.equal(g.seats[0].melds[0].length, 4); assert.equal(g.seats[0].hand.length, 1);

// Set: 3 taşlı (8, okey, 8) perdede okey alınamaz; 4 taşlıda (8, okey, 8, 8) eksik renk gelirse alınır, aynı renk gelirse olmaz
const J2 = T(1, 5);
assert.equal(jokerReplaceIndex([T(0, 8), J2, T(1, 8)], T(3, 8), okey), -1);
assert.equal(jokerReplaceIndex([T(0, 8), J2, T(1, 8), T(2, 8)], T(3, 8), okey), 1);
assert.equal(jokerReplaceIndex([T(0, 8), J2, T(1, 8), T(2, 8)], T(0, 8), okey), -1);
g = setup([T(0, 8), J2, T(1, 8), T(2, 8)], [T(0, 8), extra]);
assert.ok(!addToMeld(g, 0, 0, 0, g.seats[0].hand[0].id).ok);

// Okey değişiminde elde tek taş olsa bile yapılabilir (el sayısı değişmez)
const six = T(0, 6), J3 = T(1, 5);
g = setup([T(0, 4), T(0, 5), J3], [T(0, 3)]);
assert.ok(addToMeld(g, 0, 0, 0, g.seats[0].hand[0].id).ok);          // 3 sona/başa eklenmez: elde tek taş kalır
console.log('Okey değişimi testleri geçti');
