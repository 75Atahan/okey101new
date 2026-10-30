// Bilgisayar oyuncu: motorun hamleleriyle insan gibi oynar (çek, aç, ser, işle, at).
// Sunucu tarafında çalışır; her hamle motorun kurallarından geçer (ceza yemez).
import { draw, open, lay, addToMeld, discard, cancelDiscardDraw, autoPlay } from './game101.mjs';
import { isJoker, canAddToMeld, jokerReplaceIndex, pairReplaceIndex, checkOpen } from './okey101.mjs';
import { plan } from './assist.mjs';

// Bot zayıflatma: odalarda g.botMiss ile açılır; değer = o hamleyi "kaçırma" olasılığı (0 = hiç hata yok).
// Testler ve doğrudan çağrılar botMiss vermezse bot tam güçte oynar.
export const BOT_MISS = { open: 0.3, lay: 0.3, joker: 0.4, add: 0.35, takeDiscard: 0.4, sloppyDiscard: 0.4 };
const R = (g) => (g.rnd ?? Math.random)();
const miss = (g, k) => !!g.botMiss && R(g) < g.botMiss[k];
const face = (t, okey) => (t.fake ? { color: okey.color, num: okey.num } : { color: t.color, num: t.num });
const ctxOf = (g, p) => {
  const s = g.seats[p];
  return { opened: s.opened, openMode: s.openMode, pairsOnTable: g.seats.some((x, i) => i !== p && x.openMode === 'pairs'), minMeld: g.minMeld, minPairs: g.minPairs };
};
const fitsTable = (g, tile) => g.seats.some((s) => s.melds.some((m) => m.length >= 3 && (jokerReplaceIndex(m, tile, g.okey) >= 0 || canAddToMeld(m, tile, g.okey))));

// Soldaki oyuncunun attığı taşı almak ancak o taşı bu turda kullanabilirse mantıklı.
function wantsDiscard(g, p) {
  const prev = (p + g.players - 1) % g.players, tile = g.discardPiles[prev].at(-1);
  if (!tile || isJoker(tile, g.okey)) return false;
  const seat = g.seats[p];
  if (seat.opened) return seat.hand.length >= 2 && fitsTable(g, tile);
  const pl = plan([...seat.hand, tile], g.okey, ctxOf(g, p));
  return pl.canOpen && pl.groups.flat().includes(tile.id);
}

// Atılacak taş: perde olmayan, komşuluğu en az olan taş (okey asla atılmaz).
function worstTile(g, p) {
  const seat = g.seats[p], ok = g.okey, hand = seat.hand;
  const keep = new Set(plan(hand, ok, ctxOf(g, p)).groups.flat());
  const list = [];
  for (const t of hand) {
    if (isJoker(t, ok)) continue;
    const f = face(t, ok);
    let sc = keep.has(t.id) ? 100 : 0;
    for (const u of hand) {
      if (u.id === t.id || isJoker(u, ok)) continue;
      const h = face(u, ok);
      if (h.color === f.color) { let d = Math.abs(h.num - f.num); if (d === 12) d = 1; sc += d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 3 : 0; }
      else if (h.num === f.num) sc += 4;
    }
    sc += f.num / 20;
    list.push({ t, sc });
  }
  list.sort((a, c) => a.sc - c.sc);
  // Dikkatsiz bot: bazen en kötü taş yerine sıradaki 2-4. taşı atar
  const pick = list.length > 1 && miss(g, 'sloppyDiscard') ? list[Math.min(list.length - 1, 1 + Math.floor(R(g) * 3))] : list[0];
  return pick?.t ?? hand[0];
}

function playDiscardPhase(g, p) {
  const seat = g.seats[p], ok = g.okey;
  const tryOpen = () => {
    if (seat.opened) return;
    const pl = plan(seat.hand, ok, ctxOf(g, p));
    if (!pl.canOpen) return;
    if (g.mustUse == null && miss(g, 'open')) return;               // açabilirken bazen açmayı kaçırır
    const tiles = pl.groups.map((grp) => grp.map((id) => seat.hand.find((t) => t.id === id)));
    if (!checkOpen(tiles, ok, { minMeld: g.minMeld, minPairs: g.minPairs }).canOpen) return;
    if (g.mustUse != null && !pl.groups.flat().includes(g.mustUse)) return;
    open(g, p, pl.groups);
  };
  tryOpen();
  if (!seat.opened && g.mustUse != null && !g.acted) {          // atığı kullanamıyor: geri verip yığından çeker
    cancelDiscardDraw(g, p);
    draw(g, p, 'pile');
    tryOpen();
  }
  if (seat.opened) {
    const pl2 = plan(seat.hand, ok, ctxOf(g, p));                // açtıktan sonra yeni grupları da serer
    if (pl2.canOpen && pl2.groups.length && !miss(g, 'lay')) lay(g, p, pl2.groups);
    const pass = () => {                                         // önce okeyleri geri alır (çift ve seri), sonra kalan taşları ekler
      let changed = false;
      const each = (fn) => { for (let s = 0; s < g.seats.length; s++) for (let k = 0; k < g.seats[s].melds.length; k++) if (fn(s, k, g.seats[s].melds[k])) return true; return false; };
      for (const t of [...seat.hand]) {
        if (!seat.hand.includes(t) || isJoker(t, ok) || miss(g, 'joker')) continue;
        if (each((s, k, m) => (m.length >= 3 ? jokerReplaceIndex(m, t, ok) : pairReplaceIndex(m, t, ok)) >= 0 && addToMeld(g, p, s, k, t.id).ok)) changed = true;
      }
      for (const t of [...seat.hand]) {
        if (!seat.hand.includes(t) || isJoker(t, ok) || seat.hand.length < 2 || miss(g, 'add')) continue;
        if (each((s, k, m) => m.length >= 3 && canAddToMeld(m, t, ok) && addToMeld(g, p, s, k, t.id).ok)) changed = true;
      }
      return changed;
    };
    for (let i = 0; i < 4 && pass(); i++);
  }
  if (g.mustUse != null) { autoPlay(g); return; }              // alınan atık kullanılamadıysa güvenli çıkış
  const t = seat.hand.length === 1 ? seat.hand[0] : worstTile(g, p);
  if (!discard(g, p, t.id, { free: true }).ok) autoPlay(g);
}

// Sıra botta ise bir adım oynar: çekme aşaması ya da (aç/işle/at) aşaması.
export function botStep(g, p) {
  if (g.over || g.turn !== p) return;
  if (g.phase === 'draw') {
    let r = draw(g, p, wantsDiscard(g, p) && !miss(g, 'takeDiscard') ? 'discard' : 'pile');
    if (!r.ok) r = draw(g, p, 'pile');
    if (!r.ok) autoPlay(g);
    return;
  }
  playDiscardPhase(g, p);
}
