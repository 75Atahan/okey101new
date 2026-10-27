// Yardımlı: eli en yüksek puanla düzenler, açılabilecek seri/çift planını çıkarır.
import { RULES, isJoker, validateMeld } from './okey101.mjs';

const IDX = (c, n) => c * 14 + n; // n: 1..13
const faceOf = (t, okey) => (t.fake ? { color: okey.color, num: okey.num } : { color: t.color, num: t.num });

// Ayrık per/diziler kümesi arasında toplam sayıyı en yükseğe çıkarır (okey her yeri doldurabilir).
function bestSeries(cnt0, jk0) {
  const memo = new Map();
  let budget = 300000; // aşırı zor ellerde takılmayı önler
  const better = (a, b) => (!b || a.pts > b.pts || (a.pts === b.pts && a.used > b.used) ? a : b);
  const rec = (cnt, jk) => {
    const i = cnt.findIndex((c) => c > 0);
    if (i < 0 || --budget < 0) return { pts: 0, used: 0, melds: [] };
    const key = cnt.join('') + '|' + jk;
    if (memo.has(key)) return memo.get(key);
    const c = (i / 14) | 0, n = i % 14;
    cnt[i]--;
    let best = rec(cnt, jk); // bu taşı elde bırak
    // Setler: aynı sayı, farklı renkler
    const others = [];
    for (let cc = c + 1; cc < 4; cc++) if (cnt[IDX(cc, n)] > 0) others.push(IDX(cc, n));
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const sel = others.filter((_, k) => (mask >> k) & 1);
      for (let jj = 0; jj <= jk; jj++) {
        const size = 1 + sel.length + jj;
        if (size < 3 || size > 4) continue;
        sel.forEach((ix) => cnt[ix]--);
        const r = rec(cnt, jk - jj);
        sel.forEach((ix) => cnt[ix]++);
        best = better({ pts: n * size + r.pts, used: size + r.used, melds: [{ faces: [i, ...sel, ...Array(jj).fill(-1)] }, ...r.melds] }, best);
      }
    }
    // Diziler: bu taşla başlayan, aynı renk ardışık (13'ten sonra 1 gelebilir)
    const taken = [i], faces = [i];
    let j = 0, pts = n;
    for (let p = n + 1; p <= 13; p++) {
      const ix = IDX(c, p);
      if (cnt[ix] > 0) { cnt[ix]--; taken.push(ix); faces.push(ix); }
      else if (j < jk) { j++; faces.push(-1); }
      else break;
      pts += p;
      if (faces.length >= 3) {
        const r = rec(cnt, jk - j);
        best = better({ pts: pts + r.pts, used: faces.length + r.used, melds: [{ faces: [...faces] }, ...r.melds] }, best);
      }
    }
    taken.slice(1).forEach((ix) => cnt[ix]++);
    cnt[i]++;
    memo.set(key, best);
    return best;
  };
  return rec(cnt0, jk0);
}

// Aynı taşlar çift olur; okey tek kalan bir taşla (veya okeyle) çift olur.
function pairsOf(tiles, okey) {
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const by = new Map();
  for (const t of tiles) {
    if (isJoker(t, okey)) continue;
    const f = faceOf(t, okey), k = IDX(f.color, f.num);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(t);
  }
  const groups = [], singles = [];
  for (const L of by.values()) { while (L.length >= 2) groups.push([L.pop(), L.pop()]); singles.push(...L); }
  while (jokers.length && singles.length) groups.push([jokers.pop(), singles.shift()]);
  while (jokers.length >= 2) groups.push([jokers.pop(), jokers.pop()]);
  return groups;
}

function seriesOf(tiles, okey) {
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const pool = new Map();
  const cnt = Array(56).fill(0);
  for (const t of tiles) {
    if (isJoker(t, okey)) continue;
    const f = faceOf(t, okey), k = IDX(f.color, f.num);
    cnt[k]++;
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(t);
  }
  const r = bestSeries(cnt, jokers.length);
  const groups = r.melds.map((m) => m.faces.map((ix) => (ix < 0 ? jokers.pop() : pool.get(ix).pop())));
  return { groups, total: r.pts };
}

const pointsOf = (g, okey) => (g.length === 2 ? 0 : validateMeld(g, okey).points);

// En az bir taş atmaya kalmalı.
function keepOne(groups, handLen, okey) {
  if (groups.flat().length < handLen) return groups;
  const g = groups.map((x) => [...x]);
  const big = g.find((x) => x.length > 3);
  if (big) { big.pop(); return g; }
  g.sort((a, b) => pointsOf(a, okey) - pointsOf(b, okey));
  g.shift();
  return g;
}

// ctx: { opened, openMode, pairsOnTable, minMeld, minPairs }
export function plan(hand, okey, ctx = {}) {
  const { opened = false, openMode = null, pairsOnTable = false, minMeld = RULES.OPEN_MIN, minPairs = RULES.OPEN_MIN_PAIRS, prefer = null } = ctx; // prefer: 'meld' | 'pairs' (diz düğmeleri)
  const S = seriesOf(hand, okey);
  const P = pairsOf(hand, okey);
  let mode, groups, summary;
  if (opened) {
    // Seri açan: yeni seri/set serer, masada çift açıldıysa çift de serebilir. Çift açan: sadece çift serer.
    mode = openMode === 'pairs' ? 'pairs' : 'meld';
    if (mode === 'pairs') groups = P;
    else {
      const used = new Set(S.groups.flat().map((t) => t.id));
      groups = [...S.groups, ...(pairsOnTable ? pairsOf(hand.filter((t) => !used.has(t.id)), okey) : [])];
    }
    summary = groups.length ? `${groups.length} grup serilebilir` : 'Serilecek bir şey yok';
  } else {
    const okS = S.total >= minMeld, okP = P.length >= minPairs;
    // İkisi de yetmiyorsa elindeki taşların çoğunu gruplayan kurgu seçilir
    mode = prefer ?? (okS ? 'meld' : okP ? 'pairs' : S.groups.flat().length >= P.length * 2 ? 'meld' : 'pairs');
    groups = mode === 'meld' ? S.groups : P;
  }
  groups = keepOne(groups, hand.length, okey);
  const total = mode === 'meld' ? groups.reduce((s, g) => s + pointsOf(g, okey), 0) : groups.length;
  const canOpen = opened ? groups.length > 0 : mode === 'meld' ? total >= minMeld : total >= minPairs;
  if (!opened)
    summary = mode === 'meld'
      ? `Seri: ${total} sayı${canOpen ? ' (açılabilir)' : ` (en az ${minMeld} gerekli)`}`
      : `${total} çift${canOpen ? ' (açılabilir)' : ` (en az ${minPairs} gerekli)`}`;
  const inGroups = new Set(groups.flat().map((t) => t.id));
  const rank = (t) => (t.fake || isJoker(t, okey) ? 999 : t.color * 20 + t.num);
  const rest = hand.filter((t) => !inGroups.has(t.id)).sort((a, b) => rank(a) - rank(b));
  return {
    mode, total, canOpen, summary,
    groups: groups.map((g) => g.map((t) => t.id)),
    order: [...groups.flat().map((t) => t.id), ...rest.map((t) => t.id)],
  };
}
