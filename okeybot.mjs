// Klasik Okey botu: eli değerlendirir, işine yarayan atığı alır, en az işe yarayan taşı atar, bitirebiliyorsa bitirir.
import { isJoker } from './okey101.mjs';
import { draw, discard, autoPlay } from './okey.mjs';
import { findWinning, finishTiles, maxCover } from './okeyrules.mjs';

// Bot zayıflatma: odalarda g.botMiss ile açılır; değer = o hamleyi "kaçırma" olasılığı. Bitirme asla kaçırılmaz.
export const BOT_MISS_OKEY = { takeDiscard: 0.45, sloppyDiscard: 0.55 };
const R = (g) => (g.rnd ?? Math.random)();
const miss = (g, k) => !!g.botMiss && R(g) < g.botMiss[k];
const face = (t, okey) => (t.fake ? { color: okey.color, num: okey.num } : { color: t.color, num: t.num });

// Elin değeri: perlerle örtülen taş sayısı + gruba yaklaşan (komşu / aynı sayı) taşlar
function evalHand(tiles, g) {
  const okey = g.okey;
  if (findWinning(tiles, okey)) return 1000;
  const real = tiles.filter((t) => !isJoker(t, okey)).map((t) => face(t, okey));
  let near = 0;
  for (let i = 0; i < real.length; i++) {
    let best = 0;
    for (let j = 0; j < real.length; j++) {
      if (i === j) continue;
      const a = real[i], b = real[j];
      if ((a.color === b.color && a.num !== b.num && Math.abs(a.num - b.num) <= 2) || (a.num === b.num && a.color !== b.color)) { best = 1; break; }
    }
    near += best;
  }
  return maxCover(tiles, okey) * 10 + near * 2;
}

// 15 taşlı elden atılacak en iyi taş (okey atılmaz)
function discardChoices(hand, g) {
  const list = hand.filter((t) => !isJoker(t, g.okey)).map((t) => ({ t, score: evalHand(hand.filter((x) => x !== t), g) + R(g) * 0.5 }));
  list.sort((a, b) => b.score - a.score);
  return list.length ? list : [{ t: hand[0], score: 0 }];
}

export function botStep(g, p) {
  if (g.over || g.turn !== p) return { ok: false };
  const seat = g.seats[p], n = g.players;
  if (g.phase === 'draw') {
    const top = g.discardPiles[(p + n - 1) % n].at(-1);
    let src = 'pile';
    if (top && !miss(g, 'takeDiscard')) {
      const now = evalHand(seat.hand, g);
      const after = discardChoices([...seat.hand, top], g)[0].score;
      if (after >= 1000 || after - now >= 8) src = 'discard';      // atık taş eli belirgin iyileştiriyorsa al
    }
    let r = draw(g, p, src);
    if (!r.ok && src === 'discard') r = draw(g, p, 'pile');
    if (!r.ok) return autoPlay(g);
  }
  const fin = finishTiles(seat.hand, g.okey);                        // bitirebiliyorsa bitir
  if (fin.length) {
    const id = fin.find((id) => isJoker(seat.hand.find((t) => t.id === id), g.okey)) ?? fin[0];   // okeyle bitirmek x2
    return discard(g, p, id);
  }
  const list = discardChoices(seat.hand, g);
  const pick = list.length > 1 && miss(g, 'sloppyDiscard') ? list[Math.min(list.length - 1, 1 + Math.floor(R(g) * 3))] : list[0];
  return discard(g, p, pick.t.id);
}
