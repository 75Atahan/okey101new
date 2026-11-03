import assert from 'node:assert/strict';
import { createGame } from './game101.mjs';
import { botStep, BOT_MISS } from './bot.mjs';

// Sabit tohumlu rastgele sayı: test her çalıştırmada aynı sonucu verir
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const play = (n, miss) => {
  let finished = 0;
  for (let i = 0; i < n; i++) {
    const g = createGame({ katlamali: i % 2 === 0, clock: () => 0, rnd: seeded(i + 7) });
    if (miss) g.botMiss = miss;
    let steps = 0;
    while (!g.over && steps++ < 3000) botStep(g, g.turn);
    assert.ok(g.over, `oyun ${i} bitmedi`);
    assert.ok(g.seats.every((s) => s.penalty === 0), `oyun ${i}: bot ceza yedi`);
    if (g.over.finisher !== null) finished++;
  }
  return finished;
};
// 1) Zayıflatılmış botlar da takılmaz, kural dışı hamle yapmaz; tam güçlü bottan az el bitirir
const strong = play(60, null), weak = play(60, BOT_MISS);
assert.ok(weak < strong, `zayıf bot (${weak}) tam güçlüden (${strong}) az bitirmeli`);
// 2) Her hamleyi kaçıran bot hiç açmaz ama oyun yine de ilerler (ceza yok)
const none = play(10, { open: 1, lay: 1, joker: 1, add: 1, takeDiscard: 1, sloppyDiscard: 1 });
assert.equal(none, 0);
console.log(`Bot zayıflatma testleri geçti (60 oyunda tam güç: ${strong}, zayıf: ${weak} el bitirdi)`);
