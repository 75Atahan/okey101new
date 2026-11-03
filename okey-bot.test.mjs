import assert from 'node:assert/strict';
import { createGame } from './okey.mjs';
import { botStep, BOT_MISS_OKEY } from './okeybot.mjs';

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
function play(n, miss) {
  let finished = 0, turns = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const g = createGame({ clock: () => 0, rnd: seeded(i + 11) });
    if (miss) g.botMiss = miss;
    let steps = 0;
    while (!g.over && steps++ < 400) { const r = botStep(g, g.turn); assert.ok(r.ok !== false, `oyun ${i}: bot hamlesi geçersiz: ${r.error}`); turns++; }
    assert.ok(g.over, `oyun ${i} bitmedi`);
    if (g.over.finisher !== null) {
      finished++;
      assert.equal(g.seats[g.over.finisher].hand.length, 14);     // bitiren 14 taşla kalır
    }
    assert.equal(g.scores.reduce((a, b) => a + b, 0), g.over.factor);   // puan yalnız kazanana yazılır
  }
  return { finished, turns, ms: Date.now() - t0 };
}
const strong = play(12, null), weak = play(12, BOT_MISS_OKEY);
assert.ok(strong.finished >= 3, `tam güçlü bot yeterince bitiremedi: ${strong.finished}`);
assert.ok(weak.finished <= strong.finished, `zayıf bot (${weak.finished}) güçlüden (${strong.finished}) çok bitirmemeli`);
console.log(`Klasik Okey bot testleri geçti (12 oyunda tam güç: ${strong.finished}, zayıf: ${weak.finished} el bitirdi; ${strong.ms + weak.ms} ms)`);
