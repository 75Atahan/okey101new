import assert from 'node:assert/strict';
import { createGame } from './game101.mjs';
import { botStep } from './bot.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);

// 1) Dört bot oyunu bitirir: takılma yok, ceza yok (kural dışı hamle yapmaz)
let finished = 0;
for (let n = 0; n < 30; n++) {
  const g = createGame({ katlamali: n % 2 === 0, clock: () => 0 });
  let steps = 0;
  while (!g.over && steps++ < 800) botStep(g, g.turn);
  assert.ok(g.over, `oyun ${n} bitmedi`);
  assert.ok(g.seats.every((s) => s.penalty === 0), `oyun ${n}: bot ceza yedi`);
  if (g.over.finisher !== null) finished++;
}

// 2) Açabilen bot açar ve tek taşı kalınca eli bitirir
const g = createGame({ clock: () => 0 }); g.okey = { color: 1, num: 5 };
const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
g.turn = 1; g.phase = 'discard'; g.seats[1].hand = [...a, ...b, ...d, last];
botStep(g, 1);
assert.equal(g.over.finisher, 1); assert.equal(g.seats[1].penalty, 0);

// 3) Atılan taş açmasını sağlıyorsa onu alır, sonra açar
const h = createGame({ clock: () => 0 }); h.okey = { color: 1, num: 5 };
const r1 = [T(0, 11), T(0, 12), T(0, 13)], s1 = [T(1, 10), T(2, 10), T(3, 10)], r2 = [T(0, 9), T(0, 10), T(0, 11)], x = T(3, 2), y = T(2, 6), want = T(0, 12);
h.turn = 2; h.phase = 'draw'; h.seats[2].hand = [...r1, ...s1, ...r2, x, y]; h.discardPiles[1] = [want];
botStep(h, 2);
assert.equal(h.mustUse, want.id);
botStep(h, 2);
assert.ok(h.seats[2].opened && h.seats[2].penalty === 0);

// 4) Açamıyorsa yığından çeker (atığı almaz)
const k = createGame({ clock: () => 0 }); k.okey = { color: 1, num: 5 };
k.turn = 2; k.phase = 'draw'; k.seats[2].hand = [T(0, 1), T(1, 4), T(2, 7), T(3, 9)]; k.discardPiles[1] = [T(0, 2)];
botStep(k, 2);
assert.equal(k.mustUse, null); assert.equal(k.discardPiles[1].length, 1);
console.log(`Bot testleri geçti (30 oyunda ${finished} el bitirildi)`);
