import assert from 'node:assert/strict';
import { pairReplaceIndex } from './okey101.mjs';
import { createGame, addToMeld, discard } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };
const setup = (pair, hand, opened = true) => {
  const g = createGame({ clock: () => 0 }); g.okey = okey;
  g.seats[1].opened = true; g.seats[1].openMode = 'pairs'; g.seats[1].melds = [pair];
  g.turn = 0; g.phase = 'discard'; g.seats[0].opened = opened; g.seats[0].openMode = 'meld'; g.seats[0].hand = hand;
  return g;
};

// Çiftteki okeyin yerine eşi konur, okey eline döner
const J = T(1, 5), two = T(0, 2), extra = T(3, 9);
assert.equal(pairReplaceIndex([J, T(0, 2)], two, okey), 0);
assert.equal(pairReplaceIndex([T(0, 2), J], two, okey), 1);
assert.equal(pairReplaceIndex([J, T(0, 2)], T(2, 2), okey), -1);          // renk farklı: olmaz
let g = setup([J, T(0, 2)], [two, extra]);
let r = addToMeld(g, 0, 1, 0, two.id);
assert.ok(r.ok && r.swapped);
assert.ok(g.seats[0].hand.some((t) => t.id === J.id));                      // okey ıstakada
assert.equal(g.seats[1].melds[0][0].id, two.id);

// Eşi olmayan taş çifte işlenmez; açmayan oyuncu alamaz
g = setup([J, T(0, 2)], [T(2, 2), extra]);
assert.ok(!addToMeld(g, 0, 1, 0, g.seats[0].hand[0].id).ok);
g = setup([J, T(0, 2)], [two, extra], false);
assert.ok(!addToMeld(g, 0, 1, 0, two.id).ok);

// İki okeyli çift: herhangi bir taş bir okeyin yerine geçer
const J1 = T(1, 5), J2 = T(1, 5), any = T(3, 8);
g = setup([J1, J2], [any, extra]);
assert.ok(addToMeld(g, 0, 1, 0, any.id).swapped);

// Çiftte okeyin yerine konabilen taşı atmak da 101 ceza
g = setup([J, T(0, 2)], [two, extra]);
assert.ok(discard(g, 0, two.id).ok);
assert.equal(g.seats[0].penalty, 101);
console.log('Çift okeyi alma testleri geçti');
