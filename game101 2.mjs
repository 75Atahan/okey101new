// 101 Okey oyun akışı: sıra, hamleler, el sonu, tekli/eşli puanlama.
// Sunucu bu modülü çağırır; tüm hamleler burada doğrulanır.
import { newRound, checkOpen, canAddToMeld, isJoker, roundScore, validateMeld, isPair, RULES } from './okey101.mjs';

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

export function createGame({ players = 4, mode = 'single', katlamali = false, turnSeconds = 45, clock = Date.now, rnd } = {}) {
  const g = { players, mode, katlamali, rnd, clock, turnMs: turnSeconds * 1000, roundNo: 0, scores: Array(players).fill(0) };
  startRound(g);
  return g;
}

export function startRound(g) {
  const n = g.players;
  const r = newRound(n, g.rnd);
  const starter = g.roundNo % n; // her elde başlayan bir sonraki oyuncu
  g.roundNo++;
  g.indicator = r.indicator;
  g.okey = r.okey;
  g.pile = r.pile;
  g.discardPiles = Array.from({ length: n }, () => []);
  g.seats = Array.from({ length: n }, (_, s) => ({
    hand: r.hands[(s - starter + n) % n],
    opened: false,
    openMode: null,
    melds: [],
    meldSeq: [], // perlerin masaya dizilme sırası (istemci yerleşimi için)
    penalty: 0,
  }));
  g.turn = starter;
  g.phase = 'discard'; // başlayan 22 taşla doğrudan taş atar
  g.over = null;
  g.mustUse = null;
  g.acted = false;
  // Açılış eşikleri her elde sıfırlanır; katlamalı odada her açanla yükselir.
  g.minMeld = RULES.OPEN_MIN;
  g.minPairs = RULES.OPEN_MIN_PAIRS;
  g.lastDrawn = null;
  g.meldCounter = 0;
  g.penalized = false;
  g.deadline = g.clock() + g.turnMs; // başlayan oyuncunun süresi
}

const takeFromHand = (seat, id) => {
  const i = seat.hand.findIndex((t) => t.id === id);
  return i < 0 ? null : seat.hand.splice(i, 1)[0];
};

function guard(g, p, phase) {
  if (g.over) return 'El bitti.';
  if (g.turn !== p) return 'Sıra sende değil.';
  if (g.phase !== phase) return phase === 'draw' ? 'Önce taş atmalısın.' : 'Önce taş çekmelisin.';
  return null;
}

// source: 'pile' (ortadaki yığın) veya 'discard' (solundaki oyuncunun attığı son taş)
export function draw(g, p, source) {
  const err = guard(g, p, 'draw');
  if (err) return fail(err);
  let tile;
  if (source === 'discard') {
    const prev = (p + g.players - 1) % g.players;
    tile = g.discardPiles[prev].pop();
    if (!tile) return fail('Alınacak taş yok.');
  } else {
    tile = g.pile.shift();
    if (!tile) return fail('Yığın bitti.');
  }
  g.seats[p].hand.push(tile);
  g.phase = 'discard';
  g.acted = false;
  // Atılan taşı alan, o taşı bu turda kullanmak zorundadır.
  g.mustUse = source === 'discard' ? tile.id : null;
  g.lastDrawn = tile.id;
  return { ok: true, tile };
}

// Atılan taşı kullanamayacağını anlayan oyuncu, hiçbir hamle yapmadan taşı geri bırakıp
// yığından çekebilir (oyunun kilitlenmesini önler).
export function cancelDiscardDraw(g, p) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  if (g.mustUse == null) return fail('Geri verilecek atık taş yok.');
  if (g.acted) return fail('Hamle yaptıktan sonra geri verilemez.');
  const seat = g.seats[p];
  const tile = takeFromHand(seat, g.mustUse);
  const prev = (p + g.players - 1) % g.players;
  g.discardPiles[prev].push(tile);
  g.mustUse = null;
  g.phase = 'draw';
  return OK;
}

// groups: her biri taş id dizisi. Per veya çiftlerle açar.
// Hatalı açış/serme: taşlar geri alınır (elde kalır) ve oyuncu 101 ceza puanı yer (turda bir kez).
function penalize(g, p, msg) {
  const first = !g.penalized;
  if (first) { g.seats[p].penalty += RULES.WRONG_OPEN_PENALTY; g.penalized = true; }
  return fail(`Hatalı açış! ${msg}${first ? ` (+${RULES.WRONG_OPEN_PENALTY} ceza puanı)` : ''}`);
}

export function open(g, p, groups) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  const seat = g.seats[p];
  if (seat.opened) return fail('Zaten açtın.');
  const ids = groups.flat();
  if (new Set(ids).size !== ids.length) return fail('Aynı taş iki kez kullanılamaz.');
  const melds = groups.map((grp) => grp.map((id) => seat.hand.find((t) => t.id === id)));
  if (melds.some((m) => m.some((t) => !t))) return fail('Elinde olmayan taş var.');
  if (seat.hand.length - ids.length < 1) return fail('Atacak bir taş kalmalı.');
  if (g.mustUse != null && !ids.includes(g.mustUse))
    return fail('Aldığın atık taşla açmalısın.');
  const res = checkOpen(melds, g.okey, { minMeld: g.minMeld, minPairs: g.minPairs });
  if (!res.canOpen)
    return penalize(g, p, `Açılış için en az ${g.minMeld} sayı veya ${g.minPairs} çift gerekli.`);
  ids.forEach((id) => takeFromHand(seat, id));
  seat.melds.push(...melds);
  melds.forEach(() => seat.meldSeq.push(g.meldCounter++));
  seat.opened = true;
  seat.openMode = res.mode;
  // Katlamalı: sonraki açan en az bir fazlasıyla açmalı (per ve çift ayrı sayılır).
  if (g.katlamali) {
    if (res.mode === 'meld') g.minMeld = res.total + 1;
    else g.minPairs = res.total + 1;
  }
  g.acted = true;
  if (ids.includes(g.mustUse)) g.mustUse = null;
  return { ok: true, total: res.total };
}

// Açılmış (kendi veya başkasının) pere taş işle.
export function addToMeld(g, p, ownerSeat, meldIndex, tileId) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  const seat = g.seats[p];
  if (!seat.opened) return fail('Önce açmalısın.');
  if (seat.hand.length < 2) return fail('Atacak bir taş kalmalı.');
  const meld = g.seats[ownerSeat]?.melds[meldIndex];
  const tile = seat.hand.find((t) => t.id === tileId);
  if (!meld || !tile) return fail('Geçersiz per veya taş.');
  if (meld.length === 2) return fail('Çift taşlara taş işlenmez.');
  if (!canAddToMeld(meld, tile, g.okey)) return fail('Taş bu pere uymuyor.');
  meld.push(takeFromHand(seat, tileId));
  g.acted = true;
  if (tileId === g.mustUse) g.mustUse = null;
  return OK;
}

// Açtıktan sonra yeni grup sermek.
// Seri açan: yeni per serer; masada çift açılmışsa çift de serebilir.
// Çift açan: sadece çift serer (yeni per açamaz), mevcut perlere taş ekleyebilir (addToMeld).
export function lay(g, p, groups) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  const seat = g.seats[p];
  if (!seat.opened) return fail('Önce açmalısın.');
  if (!groups.length) return fail('Yere serilecek taş yok.');
  const ids = groups.flat();
  if (new Set(ids).size !== ids.length) return fail('Aynı taş iki kez kullanılamaz.');
  const tiles = groups.map((grp) => grp.map((id) => seat.hand.find((t) => t.id === id)));
  if (tiles.some((m) => m.some((t) => !t))) return fail('Elinde olmayan taş var.');
  if (seat.hand.length - ids.length < 1) return fail('Atacak bir taş kalmalı.');
  const pairsOnTable = g.seats.some((s, i) => i !== p && s.openMode === 'pairs');
  for (const m of tiles) {
    if (m.length === 2) {
      if (!isPair(m[0], m[1], g.okey)) return penalize(g, p, 'Geçersiz çift.');
      if (seat.openMode !== 'pairs' && !pairsOnTable) return fail('Çift sermek için masada çift açılmış olmalı.');
    } else {
      if (seat.openMode === 'pairs') return fail('Çift açan oyuncu per açamaz; mevcut perlere taş ekleyebilir.');
      if (!validateMeld(m, g.okey).valid) return penalize(g, p, 'Geçersiz per.');
    }
  }
  if (g.mustUse != null && ids.includes(g.mustUse)) g.mustUse = null;
  ids.forEach((id) => takeFromHand(seat, id));
  seat.melds.push(...tiles);
  tiles.forEach(() => seat.meldSeq.push(g.meldCounter++));
  g.acted = true;
  return OK;
}

export function discard(g, p, tileId) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  const seat = g.seats[p];
  if (!seat.hand.some((t) => t.id === tileId)) return fail('Elinde olmayan taş.');
  if (g.mustUse != null) return fail('Aldığın atık taşı kullanmadan taş atamazsın.');
  if (seat.hand.length === 1 && !seat.opened) return fail('Açmadan el bitirilemez.');
  const tile = takeFromHand(seat, tileId);
  g.discardPiles[p].push(tile);
  if (seat.hand.length === 0) {
    endRound(g, p, isJoker(tile, g.okey));
    return { ok: true, finished: true };
  }
  if (g.pile.length === 0) {
    endRound(g, null, false); // yığın bitti, kimse bitirmedi
    return { ok: true, finished: false, drawGame: true };
  }
  g.turn = (p + 1) % g.players;
  g.phase = 'draw';
  g.penalized = false;
  g.deadline = g.clock() + g.turnMs;
  return OK;
}

function endRound(g, finisher, withOkey) {
  // Çift açarak bitirmek her odada puanı 2 katlar; katlamalı odada okeyle bitirmek de 2 katlar (ikisi birlikte 4 kat).
  const byPairs = finisher !== null && g.seats[finisher].openMode === 'pairs';
  const factor = (byPairs ? 2 : 1) * (g.katlamali && withOkey ? RULES.KATLAMA_FACTOR : 1);
  const points = g.seats.map((s, i) =>
    roundScore({ opened: s.opened, hand: s.hand, finished: i === finisher, factor }, g.okey) + s.penalty
  );
  points.forEach((v, i) => (g.scores[i] += v));
  g.over = { finisher, withOkey, byPairs, factor, points };
  g.deadline = null;
  if (g.mode === 'pairs') {
    // Karşılıklı oturanlar takım: 0-2 ve 1-3
    g.over.teams = [points[0] + points[2], points[1] + points[3]];
    g.teamScores = [g.scores[0] + g.scores[2], g.scores[1] + g.scores[3]];
  }
}

// Oyuncuya özel görünüm: rakiplerin elini sızdırma.
export function viewFor(g, p) {
  return {
    you: p,
    turn: g.turn,
    phase: g.phase,
    katlamali: g.katlamali,
    minMeld: g.minMeld,
    minPairs: g.minPairs,
    deadline: g.deadline,
    serverNow: g.clock(),
    mustUse: g.turn === p ? g.mustUse : null,
    indicator: g.indicator,
    pileCount: g.pile.length,
    hand: g.seats[p].hand,
    others: g.seats.map((s, i) => ({
      seat: i,
      handCount: s.hand.length,
      opened: s.opened,
      openMode: s.openMode,
      meldSeq: s.meldSeq,
      melds: s.melds,
      lastDiscard: g.discardPiles[i].at(-1) ?? null,
    })),
    scores: g.scores,
    teamScores: g.teamScores ?? null,
    over: g.over,
  };
}

// ---- Sıra süresi ----
export const timedOut = (g) => !g.over && g.deadline != null && g.clock() >= g.deadline;

// Süre dolunca: çekmediyse yığından çeker, çekilen taşı atar.
// Atık taş alıp kullanamadıysa önce geri bırakır. Çekilen taş yoksa (başlayan oyuncu)
// elin sonundaki okey olmayan taşı atar.
export function autoPlay(g) {
  if (g.over) return fail('El bitti.');
  const p = g.turn;
  const seat = g.seats[p];
  if (g.phase === 'discard' && g.mustUse != null && !g.acted) cancelDiscardDraw(g, p);
  if (g.phase === 'draw' && !draw(g, p, 'pile').ok) {
    endRound(g, null, false); // yığın bitti
    return { ok: true, seat: p, tileId: null };
  }
  let id = g.lastDrawn;
  if (id == null || !seat.hand.some((t) => t.id === id))
    id = (seat.hand.findLast((t) => !isJoker(t, g.okey)) ?? seat.hand.at(-1)).id;
  g.mustUse = null; // süre dolduğunda atık taş zorunluluğu geçersiz
  const r = discard(g, p, id);
  return r.ok ? { ok: true, seat: p, tileId: id } : r;
}
