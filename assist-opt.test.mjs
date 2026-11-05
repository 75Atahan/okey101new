import assert from 'node:assert/strict';
import { plan } from './assist.mjs';
import { createTiles, shuffle, isJoker, validateMeld } from './okey101.mjs';

// Planlayıcı en yüksek seri toplamını bulmalı (kaba kuvvetle karşılaştırılır)
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
function best(hand, okey) {
  const F = (t) => (t.fake ? okey : t);
  const jk = hand.filter((t) => isJoker(t, okey)), non = hand.filter((t) => !isJoker(t, okey)).sort((a, b) => F(a).color * 100 + F(a).num - (F(b).color * 100 + F(b).num));
  let top = 0;
  (function rec(items, js, pts, used) {
    if (pts > top && used <= hand.length - 1) top = pts;
    if (!items.length) return;
    const t = items[0], rest = items.slice(1);
    rec(rest, js, pts, used);
    const mates = [];
    for (let c = 0; c < 4; c++) { if (c === F(t).color) continue; const m = rest.find((x) => F(x).color === c && F(x).num === F(t).num); if (m) mates.push(m); }
    const subs = [[]]; for (const m of mates) subs.push(...subs.map((s) => [...s, m]).filter((s) => s.length <= 3));
    for (const s of subs) for (const tot of [3, 4]) {
      const need = tot - 1 - s.length; if (need < 0 || need > js.length) continue;
      const g = [t, ...s, ...js.slice(0, need)], v = validateMeld(g, okey); if (!v.valid) continue;
      rec(rest.filter((x) => !s.includes(x)), js.slice(need), pts + v.points, used + g.length);
    }
    for (let back = 0; back <= js.length && F(t).num - back >= 1; back++) {
      const start = F(t).num - back;
      for (let end = Math.max(F(t).num, start + 2); end <= 13; end++) {
        const g = [], used2 = []; let need = 0;
        for (let n = start; n <= end; n++) { if (n === F(t).num) { g.push(t); continue; } const m = rest.find((x) => !used2.includes(x) && F(x).color === F(t).color && F(x).num === n); if (m) { g.push(m); used2.push(m); } else need++; }
        if (need > js.length || g.length + need < 3) continue;
        const gg = [...g, ...js.slice(0, need)], v = validateMeld(gg, okey); if (!v.valid) continue;
        rec(rest.filter((x) => !used2.includes(x)), js.slice(need), pts + v.points, used + gg.length);
      }
    }
  })(non, jk, 0, 0);
  return top;
}
let checked = 0;
for (let i = 0; i < 30; i++) {
  const rnd = seeded(i + 101);
  const deck = shuffle(createTiles(), rnd);
  const okey = { color: Math.floor(rnd() * 4), num: 1 + Math.floor(rnd() * 13) };
  const hand = deck.slice(0, 22);
  const pl = plan(hand, okey, { minMeld: 0, prefer: 'meld' });
  const opt = best(hand, okey);
  assert.equal(pl.total, opt, `el ${i}: planlayıcı ${pl.total}, en iyi ${opt}`);
  checked++;
}
// Başa okey konan dizi: OKEY-12-13 (okey 11 yerine)
let id = 1; const T = (c, n) => ({ id: id++, color: c, num: n, fake: false });
const okey = { color: 0, num: 10 };
const h = [T(1, 12), T(1, 13), T(0, 10), T(3, 1), T(2, 2), T(3, 6), T(1, 3)];
const p2 = plan(h, okey, { minMeld: 0, prefer: 'meld' });
assert.equal(p2.total, 36, 'OKEY-12-13 serisi (11+12+13) bulunamadı');
console.log(`Planlayıcı en iyi seriyi buluyor (${checked} rastgele el kaba kuvvetle doğrulandı)`);
