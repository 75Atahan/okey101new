import assert from 'node:assert/strict';
import { createGame, draw, open, discard } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
const sets = (nums, colors = [0, 1, 2]) => nums.map((n) => colors.map((c) => T(c, n)));
const pairs = (n) => Array.from({ length: n }, (_, i) => [T(0, i + 1), T(0, i + 1)]);

function setup(katlamali) {
  const g = createGame({ katlamali });
  g.okey = { color: 1, num: 5 };
  return g;
}
// Sıradaki oyuncuya el kurar, çeker.
function giveHand(g, p, groups, extras = 2) {
  if (g.turn !== p) throw new Error('sıra yanlış');
  g.seats[p].hand = [...groups.flat(), ...Array.from({ length: extras }, () => T(3, 2))];
  if (g.phase === 'draw') draw(g, p, 'pile');
}
function endTurn(g, p) {
  assert.ok(discard(g, p, g.seats[p].hand.at(-1).id).ok);
}

// --- Per ile açılış: katlamalı eşik yükselir ---
for (const katlamali of [true, false]) {
  const g = setup(katlamali);
  const a = [...sets([13, 12, 11, 10])];            // 39+36+33+30 = 138
  giveHand(g, 0, a);
  const r0 = open(g, 0, a.map(ids));
  assert.ok(r0.ok && r0.total === 138);
  assert.equal(g.minMeld, katlamali ? 139 : 101);
  endTurn(g, 0);

  const low = sets([13, 12, 10]);                   // 105
  giveHand(g, 1, low);
  const tooLow = open(g, 1, low.map(ids));
  assert.equal(tooLow.ok, !katlamali);              // katlamalıda 105 < 139
  if (katlamali) {
    const high = [...sets([13, 12, 11, 10, 9]).map((x, i) => (i === 4 ? x : x))]; // 138+27 = 165
    giveHand(g, 1, high, 1);
    // aynı elde tekrar kurmak yeni çekiş sayılmaz; sadece elini yenile
    assert.ok(open(g, 1, high.map(ids)).ok);
    assert.equal(g.minMeld, 166);
  }
}

// --- Çift ile açılış: 5 → 6 → 7 ---
{
  const g = setup(true);
  const p0 = pairs(5);
  giveHand(g, 0, p0);
  assert.ok(open(g, 0, p0.map(ids)).ok);
  assert.equal(g.minPairs, 6);
  endTurn(g, 0);

  const five = pairs(5);
  giveHand(g, 1, five);
  assert.ok(!open(g, 1, five.map(ids)).ok);          // 5 < 6
  const six = pairs(6);
  g.seats[1].hand = [...six.flat(), T(3, 2), T(3, 2)];
  assert.ok(open(g, 1, six.map(ids)).ok);
  assert.equal(g.minPairs, 7);
  endTurn(g, 1);

  const six2 = pairs(6);
  giveHand(g, 2, six2);
  assert.ok(!open(g, 2, six2.map(ids)).ok);          // 6 < 7
  const seven = pairs(7);
  g.seats[2].hand = [...seven.flat(), T(3, 2), T(3, 2)];
  assert.ok(open(g, 2, seven.map(ids)).ok);
  assert.equal(g.minPairs, 8);
}
console.log('Katlamalı açılış eşiği testleri geçti');
