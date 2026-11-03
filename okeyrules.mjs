// Klasik Okey kuralları (sunucu ve arayüz ortak kullanır, bağımlılık yok).
// 14 taşın tamamı geçerli seri/gruplara (en az 3'lü) ya da 7 çifte ayrılıyorsa el bitebilir.
import { isJoker, validateMeld } from './okey101.mjs';

// Sahte okey, okey taşının yüzünü taşır; gerçek okey joker olur.
const fv = (t, okey) => (t.fake ? { color: okey.color, num: okey.num } : { color: t.color, num: t.num });
const key = (t, okey) => { const f = fv(t, okey); return f.color * 100 + f.num; };

// 7 çift: aynı renk ve sayıdan iki taş; okey eksik taşı tamamlar.
export function pairsOk(tiles, okey) {
  if (tiles.length !== 14) return false;
  let jokers = 0;
  const cnt = new Map();
  for (const t of tiles) {
    if (isJoker(t, okey)) { jokers++; continue; }
    cnt.set(key(t, okey), (cnt.get(key(t, okey)) || 0) + 1);
  }
  let singles = 0;
  for (const c of cnt.values()) singles += c % 2;
  return singles <= jokers;
}

// Taşların hepsini geçerli perlere ayırır; ayıramazsa null. Dönüş: perlerin listesi (taş dizileri).
export function partition(tiles, okey) {
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const rest = tiles.filter((t) => !isJoker(t, okey)).sort((a, b) => key(a, okey) - key(b, okey));
  const groups = [];

  function absorb(js) {                                   // artan okeyleri uygun perlere ekle (başarısızsa hiçbir şeyi değiştirmez)
    const copy = groups.map((g) => [...g]);
    for (const j of js) {
      const g = copy.find((m) => validateMeld([...m, j], okey).valid);
      if (!g) return false;
      g.push(j);
    }
    groups.splice(0, groups.length, ...copy);
    return true;
  }

  function solve(items, js) {
    if (items.length === 0) return js.length === 0 || absorb(js);
    const t = items[0], f = fv(t, okey);
    const others = items.slice(1);
    const take = (arr, tile) => arr.filter((x) => x !== tile);
    // A) Aynı sayılı, farklı renkli grup (3-4 taş)
    const mates = [];                                      // diğer renklerden birer aday
    for (let c = 0; c < 4; c++) {
      if (c === f.color) continue;
      const m = others.find((x) => fv(x, okey).color === c && fv(x, okey).num === f.num);
      if (m) mates.push(m);
    }
    const subsets = [[]];
    for (const m of mates) subsets.push(...subsets.map((s) => [...s, m]).filter((s) => s.length <= 3));
    for (const s of subsets) {
      const size = 1 + s.length;
      for (const total of [3, 4]) {
        const need = total - size;
        if (need < 0 || need > js.length) continue;
        const g = [t, ...s, ...js.slice(0, need)];
        let left = others;
        for (const m of s) left = take(left, m);
        groups.push(g);
        if (solve(left, js.slice(need))) return true;
        groups.pop();
      }
    }
    // B) Aynı renkli seri: t'yi içeren, en az 3 taş
    for (let back = 0; back <= js.length && f.num - back >= 1; back++) {
      const start = f.num - back;
      for (let end = Math.max(f.num, start + 2); end <= 13; end++) {
        const g = [], used = [];
        let need = 0;
        for (let n = start; n <= end; n++) {
          if (n === f.num) { g.push(t); continue; }
          const m = others.find((x) => !used.includes(x) && fv(x, okey).color === f.color && fv(x, okey).num === n);
          if (m) { g.push(m); used.push(m); } else need++;
        }
        if (need > js.length) continue;
        if (g.length + need < 3) continue;
        const gg = [...g, ...js.slice(0, need)];
        let left = others;
        for (const m of used) left = take(left, m);
        groups.push(gg);
        if (solve(left, js.slice(need))) return true;
        groups.pop();
      }
    }
    return false;
  }

  if (tiles.length < 3) return null;
  return solve(rest, jokers) ? groups.map((g) => [...g]) : null;
}

// El bitiyor mu? 14 taşlık el için: { kind: 'pairs' | 'melds', groups? } ya da null.
export function findWinning(tiles14, okey) {
  if (tiles14.length !== 14) return null;
  if (pairsOk(tiles14, okey)) return { kind: 'pairs' };
  const groups = partition(tiles14, okey);
  return groups ? { kind: 'melds', groups } : null;
}

// 15 taşlı elde, atınca eli bitiren taşların kimlikleri (arayüzde "bitirebilirsin" ipucu)
export function finishTiles(hand15, okey) {
  if (hand15.length !== 15) return [];
  return hand15.filter((t) => findWinning(hand15.filter((x) => x !== t), okey)).map((t) => t.id);
}

// Botun elini değerlendirmesi için: perlerle örtülen en çok taş sayısı (okeyler dahil)
export function maxCover(tiles, okey) {
  const jokers = tiles.filter((t) => isJoker(t, okey)).length;
  const rest = tiles.filter((t) => !isJoker(t, okey)).sort((a, b) => key(a, okey) - key(b, okey));
  let best = 0;
  function go(items, js, covered) {
    if (covered + items.length + js <= best) return;       // bundan iyisi çıkamaz
    if (items.length === 0) { best = Math.max(best, covered + js); return; }
    const t = items[0], f = fv(t, okey), others = items.slice(1);
    const take = (arr, tile) => arr.filter((x) => x !== tile);
    const mates = [];
    for (let c = 0; c < 4; c++) {
      if (c === f.color) continue;
      const m = others.find((x) => fv(x, okey).color === c && fv(x, okey).num === f.num);
      if (m) mates.push(m);
    }
    const subsets = [[]];
    for (const m of mates) subsets.push(...subsets.map((s) => [...s, m]).filter((s) => s.length <= 3));
    for (const s of subsets) for (const total of [3, 4]) {
      const need = total - 1 - s.length;
      if (need < 0 || need > js) continue;
      let left = others;
      for (const m of s) left = take(left, m);
      go(left, js - need, covered + total);
    }
    for (let end = f.num + 2; end <= 13; end++) {
      const used = [];
      let need = 0;
      for (let n = f.num + 1; n <= end; n++) {
        const m = others.find((x) => !used.includes(x) && fv(x, okey).color === f.color && fv(x, okey).num === n);
        if (m) used.push(m); else need++;
      }
      if (need > js) continue;
      let left = others;
      for (const m of used) left = take(left, m);
      go(left, js - need, covered + used.length + 1 + need);
    }
    go(others, js, covered);                               // t perlere girmiyor
  }
  go(rest, jokers, 0);
  return best;
}
