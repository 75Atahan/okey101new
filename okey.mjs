// Klasik Okey oyun akışı: 14 taş, çek-at, 14 taş geçerli perlere ya da 7 çifte ayrılınca el biter.
// 101 Okey ile aynı arayüzü (createGame, startRound, draw, discard, viewFor, timedOut, autoPlay) sunar.
import { createTiles, shuffle, isJoker } from './okey101.mjs';
import { findWinning } from './okeyrules.mjs';

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
export const POINTS = { base: 1, okeyFactor: 2, pairsFactor: 2 };   // normal 1; okey atarak x2; çiftle x2 (ikisi birlikte x4)

function deal(n, rnd) {
  const deck = shuffle(createTiles(), rnd);
  const i = deck.findIndex((t) => !t.fake);
  const indicator = deck.splice(i, 1)[0];
  const okey = { color: indicator.color, num: (indicator.num % 13) + 1 };
  const hands = [];
  for (let p = 0; p < n; p++) hands.push(deck.splice(0, p === 0 ? 15 : 14));   // başlayan 15 taş
  return { indicator, okey, hands, pile: deck };
}

export function createGame({ players = 4, mode = 'single', turnSeconds = 45, clock = Date.now, rnd } = {}) {
  const g = { kind: 'okey', players, mode, katlamali: false, rnd, clock, turnMs: turnSeconds * 1000, roundNo: 0, scores: Array(players).fill(0) };
  startRound(g);
  return g;
}

export function startRound(g) {
  const n = g.players;
  const r = deal(n, g.rnd);
  const starter = g.roundNo % n;
  g.roundNo++;
  g.indicator = r.indicator;
  g.okey = r.okey;
  g.pile = r.pile;
  g.discardPiles = Array.from({ length: n }, () => []);
  g.seats = Array.from({ length: n }, (_, s) => ({ hand: r.hands[(s - starter + n) % n], opened: false, openMode: null, melds: [], meldSeq: [], penalty: 0 }));
  g.turn = starter;
  g.phase = 'discard';       // başlayan 15 taşla doğrudan taş atar
  g.over = null;
  g.mustUse = null;
  g.acted = false;
  g.lastDrawn = null;
  g.deadline = g.clock() + g.turnMs;
}

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
  g.lastDrawn = tile.id;
  return { ok: true, tile };
}

export function discard(g, p, tileId) {
  const err = guard(g, p, 'discard');
  if (err) return fail(err);
  const seat = g.seats[p];
  const i = seat.hand.findIndex((t) => t.id === tileId);
  if (i < 0) return fail('Elinde olmayan taş.');
  const tile = seat.hand.splice(i, 1)[0];
  g.discardPiles[p].push(tile);
  const win = findWinning(seat.hand, g.okey);     // kalan 14 taş geçerliyse atılan taş bitiş taşıdır
  if (win) {
    endRound(g, p, { withOkey: isJoker(tile, g.okey), byPairs: win.kind === 'pairs' });
    return { ok: true, finished: true };
  }
  if (g.pile.length === 0) {
    endRound(g, null, {});
    return { ok: true, finished: false, drawGame: true };
  }
  g.turn = (p + 1) % g.players;
  g.phase = 'draw';
  g.deadline = g.clock() + g.turnMs;
  return OK;
}

function endRound(g, finisher, { withOkey = false, byPairs = false } = {}) {
  const n = g.players;
  const factor = finisher === null ? 0 : POINTS.base * (withOkey ? POINTS.okeyFactor : 1) * (byPairs ? POINTS.pairsFactor : 1);
  const points = Array(n).fill(0);
  if (finisher !== null) points[finisher] = factor;
  points.forEach((v, i) => (g.scores[i] += v));
  const order = [...Array(n).keys()];
  const rank = finisher === null ? order : [finisher, ...order.filter((i) => i !== finisher).map((i) => (i - finisher + n) % n).sort((a, b) => a - b).map((d) => (finisher + d) % n)];
  g.over = { finisher, withOkey, byPairs, factor, points, rank, tilesLeft: g.seats.map((s) => s.hand.length), left: Array(n).fill(0), bonus: false, winHand: finisher === null ? null : g.seats[finisher].hand };
  g.deadline = null;
  if (g.mode === 'pairs') {
    g.over.teams = [points[0] + points[2], points[1] + points[3]];
    g.teamScores = [g.scores[0] + g.scores[2], g.scores[1] + g.scores[3]];
  }
}

export function viewFor(g, p) {
  return {
    kind: 'okey',
    you: p,
    turn: g.turn,
    phase: g.phase,
    katlamali: false,
    minMeld: 0,
    minPairs: 0,
    deadline: g.deadline,
    serverNow: g.clock(),
    penaltyNote: null,
    mustUse: null,
    indicator: g.indicator,
    pileCount: g.pile.length,
    hand: g.seats[p].hand,
    others: g.seats.map((s, i) => ({ seat: i, opened: false, openMode: null, openTotal: 0, meldSeq: [], melds: [], lastDiscard: g.discardPiles[i].at(-1) ?? null })),
    scores: g.scores,
    teamScores: g.teamScores ?? null,
    over: g.over,
  };
}

export const timedOut = (g) => !g.over && g.deadline != null && g.clock() >= g.deadline;

// Süre dolunca: çekmediyse yığından çeker, çekilen taşı atar (okey atılmaz).
export function autoPlay(g) {
  if (g.over) return fail('El bitti.');
  const p = g.turn, seat = g.seats[p];
  if (g.phase === 'draw' && !draw(g, p, 'pile').ok) {
    endRound(g, null, {});
    return { ok: true, seat: p, tileId: null };
  }
  const nonJoker = (t) => !isJoker(t, g.okey);
  let t = seat.hand.find((x) => x.id === g.lastDrawn);
  if (!t || !nonJoker(t)) t = seat.hand.findLast(nonJoker) ?? seat.hand.at(-1);
  const r = discard(g, p, t.id);
  return r.ok ? { ok: true, seat: p, tileId: t.id } : r;
}
