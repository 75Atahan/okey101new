// 101 Okey oyun motoru — sunucu tarafında çalışır, bağımlılık yok.
// Puan sabitleri siteden siteye değişir; 101 Okey Plus değerleriyle doğrula.
export const RULES = {
  OPEN_MIN: 101,          // per ile açmak için asgari toplam
  OPEN_MIN_PAIRS: 5,      // çift ile açmak için asgari çift sayısı
  ACE_AFTER_13: 1,        // 12-13-1 dizisinde 1'in değeri
  JOKER_IN_HAND: 0,       // elde kalan okeyin ceza puanı (siteye göre değişir)
  NO_OPEN_PENALTY: 202,   // hiç açamayan oyuncunun cezası
  FINISH_BONUS: -101,     // eli bitirene
  WRONG_OPEN_PENALTY: 101, // hatalı açış/serme cezası (turda bir kez)
  KATLAMA_FACTOR: 2,      // katlamalı odada okeyle/çiftle bitirince tüm puanlar x2
};

export const COLORS = ['sarı', 'mavi', 'siyah', 'kırmızı'];

// ---- Taşlar ve dağıtım ----
export function createTiles() {
  const tiles = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++)
    for (let color = 0; color < 4; color++)
      for (let num = 1; num <= 13; num++)
        tiles.push({ id: id++, color, num, fake: false });
  tiles.push({ id: id++, color: -1, num: 0, fake: true });
  tiles.push({ id: id++, color: -1, num: 0, fake: true });
  return tiles; // 106 taş
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Oyuncu 0 başlar: 22 taş, diğerleri 21 taş.
export function newRound(playerCount = 4, rnd = Math.random) {
  const deck = shuffle(createTiles(), rnd);
  const i = deck.findIndex((t) => !t.fake);
  const indicator = deck.splice(i, 1)[0];
  const okey = { color: indicator.color, num: (indicator.num % 13) + 1 };
  const hands = [];
  for (let p = 0; p < playerCount; p++)
    hands.push(deck.splice(0, p === 0 ? 22 : 21));
  return { indicator, okey, hands, pile: deck, discards: [], turn: 0 };
}

// ---- Okey mantığı ----
export const isJoker = (t, okey) =>
  !t.fake && t.color === okey.color && t.num === okey.num;

// Sahte okey, okey taşının yüzünü taşır; gerçek okey joker olur.
const face = (t, okey) =>
  t.fake ? { color: okey.color, num: okey.num } : { color: t.color, num: t.num };

function tryGroup(real, jokers) {
  const n = real.length + jokers;
  if (n < 3 || n > 4 || real.length === 0) return null;
  const num = real[0].num;
  if (!real.every((t) => t.num === num)) return null;
  if (new Set(real.map((t) => t.color)).size !== real.length) return null;
  return { type: 'set', points: num * n };
}

function tryRun(real, jokers) {
  const n = real.length + jokers;
  if (n < 3 || n > 13 || real.length === 0) return null;
  const color = real[0].color;
  if (!real.every((t) => t.color === color)) return null;
  // Dizi yalnızca 1..13 arasında kurulur: 13'ten sonra 1 gelmez (12-13-1 geçersiz).
  for (let s = 1; s + n - 1 <= 13; s++) {
    const e = s + n - 1;
    const used = new Set();
    let ok = true;
    for (const t of real) {
      const p = t.num >= s && t.num <= e ? t.num : -1;
      if (p < 0 || used.has(p)) { ok = false; break; }
      used.add(p);
    }
    if (!ok) continue;
    let points = 0;
    for (let p = s; p <= e; p++) points += p;
    return { type: 'run', points };
  }
  return null;
}

// Bir per geçerli mi? → { valid, type, points }
export function validateMeld(tiles, okey) {
  const jokers = tiles.filter((t) => isJoker(t, okey)).length;
  const real = tiles.filter((t) => !isJoker(t, okey)).map((t) => face(t, okey));
  const r = tryGroup(real, jokers) || tryRun(real, jokers);
  return r ? { valid: true, ...r } : { valid: false, type: null, points: 0 };
}

// Açılmış pere taş işlenebilir mi?
export const canAddToMeld = (meld, tile, okey) =>
  validateMeld([...meld, tile], okey).valid;

// Çift: iki aynı taş (renk+sayı) veya biri joker.
export function isPair(a, b, okey) {
  if (isJoker(a, okey) || isJoker(b, okey)) return true;
  const x = face(a, okey), y = face(b, okey);
  return x.color === y.color && x.num === y.num;
}

// melds: taş dizileri. Per ile açma: tümü geçerli ve toplam >= 101.
// minMeld / minPairs: katlamalı odada her açılışla yükselen eşikler.
export function checkOpen(melds, okey, { minMeld = RULES.OPEN_MIN, minPairs = RULES.OPEN_MIN_PAIRS } = {}) {
  const results = melds.map((m) => validateMeld(m, okey));
  if (melds.length && results.every((r) => r.valid)) {
    const total = results.reduce((s, r) => s + r.points, 0);
    return { mode: 'meld', total, canOpen: total >= minMeld };
  }
  // Çift ile açma
  if (melds.length >= minPairs &&
      melds.every((m) => m.length === 2 && isPair(m[0], m[1], okey)))
    return { mode: 'pairs', total: melds.length, canOpen: true };
  return { mode: null, total: 0, canOpen: false };
}

// ---- Puanlama ----
export function handPenalty(hand, okey) {
  return hand.reduce((s, t) => s + (isJoker(t, okey) ? RULES.JOKER_IN_HAND : face(t, okey).num), 0);
}

export function roundScore({ opened, hand, finished, factor = 1 }, okey) {
  const base = finished
    ? RULES.FINISH_BONUS
    : opened ? handPenalty(hand, okey) : RULES.NO_OPEN_PENALTY;
  return base * factor;
}

// Perin masada gösterimi: kind 'set' | 'run'; her hücre için pos (1..13).
// Okey, yerine geçtiği sayının hücresine konur.
export function layoutMeld(tiles, okey) {
  const flat = () => ({ kind: null, cells: tiles.map((tile, i) => ({ tile, pos: i + 1 })) });
  const v = validateMeld(tiles, okey);
  if (!v.valid) return flat();
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const real = tiles.filter((t) => !isJoker(t, okey));
  if (v.type === 'set') {
    const num = face(real[0], okey).num;
    const sorted = [...real].sort((a, b) => face(a, okey).color - face(b, okey).color);
    return { kind: 'set', num, cells: [...sorted, ...jokers].map((tile) => ({ tile, pos: num })) };
  }
  const n = tiles.length;
  for (let s = 1; s + n - 1 <= 13; s++) {
    const e = s + n - 1, slots = new Map();
    let fits = true;
    for (const t of real) {
      const f = face(t, okey);
      const p = f.num >= s && f.num <= e ? f.num : -1;
      if (p < 0 || slots.has(p)) { fits = false; break; }
      slots.set(p, t);
    }
    if (!fits) continue;
    const J = [...jokers], cells = [];
    for (let p = s; p <= e; p++) cells.push({ tile: slots.get(p) ?? J.pop(), pos: p });
    return { kind: 'run', cells };
  }
  return flat();
}

// Perde okeyin yerine tam oturan taş varsa okeyin sırasını döndürür (yoksa -1).
// Taş okeyin yerine konunca okey oyuncunun eline döner.
// 3 taşlı aynı sayılı perde (ör. 13-13-okey): okeyin hangi renk yerine geçtiği belli olmadığı için okey alınamaz.
// 4 taşlıda eksik renk belli olduğundan alınabilir. Seride okeyin yeri her zaman belli olduğu için alınabilir.
export function jokerReplaceIndex(meld, tile, okey) {
  if (isJoker(tile, okey)) return -1;
  if (meld.length === 3 && validateMeld(meld, okey).type === 'set') return -1;
  for (let i = 0; i < meld.length; i++) {
    if (!isJoker(meld[i], okey)) continue;
    const next = [...meld];
    next[i] = tile;
    if (validateMeld(next, okey).valid) return i;
  }
  return -1;
}

// Çiftte okeyin yerine eşi (aynı renk ve sayı) konabilir; okey eline döner. İki okeyli çiftte her taş okeyin yerine geçer.
export function pairReplaceIndex(pair, tile, okey) {
  if (pair.length !== 2 || isJoker(tile, okey)) return -1;
  for (let i = 0; i < 2; i++) {
    if (!isJoker(pair[i], okey)) continue;
    const other = pair[1 - i];
    if (isJoker(other, okey)) return i;
    const a = face(tile, okey), b = face(other, okey);
    if (a.color === b.color && a.num === b.num) return i;
  }
  return -1;
}
