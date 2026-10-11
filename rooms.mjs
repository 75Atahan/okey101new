// Oda yöneticisi: aktarım katmanından (WebSocket vb.) bağımsız, test edilebilir.
import {
  createGame, startRound, draw, open, lay, addToMeld, discard, cancelDiscardDraw, viewFor,
  autoPlay, timedOut,
} from './game101.mjs';
import { GAME_STAKE } from './wallet.mjs';

const MODES = ['single', 'pairs']; // tekli / eşli
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const fail = (error) => ({ ok: false, error });

export function createRoomManager({ rnd = Math.random, clock = Date.now, wallet = null } = {}) {
  const rooms = new Map();

  const newCode = () => {
    let c;
    do c = Array.from({ length: 6 }, () => ALPHABET[Math.floor(rnd() * ALPHABET.length)]).join('');
    while (rooms.has(c));
    return c;
  };

  // Oda açılırken seçenekler: mode ('single'|'pairs'), katlamali (true|false)
  function createRoom(hostId, options = {}) {
    const { mode = 'single', katlamali = false, turnSeconds = 45 } = options;
    if (!MODES.includes(mode)) return fail('Geçersiz oyun modu.');
    if (typeof katlamali !== 'boolean') return fail('Katlamalı seçimi true/false olmalı.');
    if (!Number.isInteger(turnSeconds) || turnSeconds < 15 || turnSeconds > 120)
      return fail('Süre 15-120 saniye arasında olmalı.');
    const room = { code: newCode(), hostId, mode, katlamali, turnSeconds, seats: [hostId, null, null, null], game: null };
    rooms.set(room.code, room);
    return { ok: true, code: room.code };
  }

  const get = (code) => rooms.get(code);
  const stakeOf = (room) => GAME_STAKE * (room.katlamali ? 2 : 1); // katlamalıda 2 katı
  const NEXT_MS = 8000; // el bitince yeni el otomatik başlar
  const onOver = (room) => { if (room.game?.over && room.nextAt == null) room.nextAt = clock() + NEXT_MS; };

  // Her el başında herkesten masa bedeli alınır (hepsi ya da hiçbiri).
  function chargeRound(room) {
    room.settled = false; room.lastPayout = null; room.nextAt = null;
    if (!wallet) return null;
    if (!wallet.charge(room.seats, stakeOf(room))) return 'Bir oyuncunun jetonu yetersiz.';
    room.pot = stakeOf(room) * room.seats.length;
    return null;
  }
  // El bitince kazanan(lar)a havuz ödenir; kimse bitiremediyse bedeller iade edilir.
  function settle(room) {
    const o = room.game?.over;
    if (!wallet || !o || room.settled) return;
    room.settled = true;
    const n = room.seats.length, st = stakeOf(room), pay = Array(n).fill(0);
    if (o.finisher === null) pay.fill(st);
    else if (room.mode === 'pairs') { pay[o.finisher] = room.pot / 2; pay[(o.finisher + 2) % n] = room.pot / 2; }
    else pay[o.finisher] = room.pot;
    room.seats.forEach((id, i) => wallet.pay(id, pay[i]));
    // Çift açarak bitirildiyse jeton yine 2 katı: kaybedenler bir bedel daha öder (bakiyesi yettiği kadar)
    if (o.byPairs && o.finisher !== null) {
      const winners = room.mode === 'pairs' ? [o.finisher, (o.finisher + 2) % n] : [o.finisher];
      let extra = 0;
      room.seats.forEach((id, i) => {
        if (winners.includes(i)) return;
        const e = Math.min(wallet.balance(id), st);
        if (e > 0 && wallet.charge([id], e)) { pay[i] -= e; extra += e; }
      });
      const share = Math.floor(extra / winners.length);
      winners.forEach((i, k) => { const x = share + (k === 0 ? extra - share * winners.length : 0); wallet.pay(room.seats[i], x); pay[i] += x; });
    }
    room.lastPayout = pay.map((x) => x - st);
  }

  function join(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.game) return fail('Oyun başladı.');
    if (room.seats.includes(userId)) return fail('Zaten odadasın.');
    const free = room.seats.indexOf(null);
    if (free < 0) return fail('Oda dolu.');
    room.seats[free] = userId;
    return { ok: true, seat: free };
  }

  function leave(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.game && !room.game.over) return fail('Oyun başladı.');
    if (room.game) { room.game = null; room.nextAt = null; } // el bitti: masa bekleme ekranına döner
    const s = room.seats.indexOf(userId);
    if (s < 0) return fail('Odada değilsin.');
    room.seats[s] = null;
    const rest = room.seats.filter(Boolean);
    if (rest.length === 0) rooms.delete(code);
    else if (room.hostId === userId) room.hostId = rest[0];
    return { ok: true };
  }

  function start(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.hostId !== userId) return fail('Oyunu sadece oda sahibi başlatır.');
    if (room.game) return fail('Oyun zaten başladı.');
    if (room.seats.some((s) => !s)) return fail('4 oyuncu gerekli.');
    const err = chargeRound(room);
    if (err) return fail(err);
    room.game = createGame({ players: 4, mode: room.mode, katlamali: room.katlamali, turnSeconds: room.turnSeconds, clock, rnd });
    return { ok: true };
  }

  function act0(code, userId, a) {
    const room = get(code);
    if (!room?.game) return fail('Oyun başlamadı.');
    const p = room.seats.indexOf(userId);
    if (p < 0) return fail('Bu odada değilsin.');
    const g = room.game;
    switch (a?.type) {
      case 'draw': return draw(g, p, a.source);
      case 'open':
      case 'lay':
        if (!Array.isArray(a.groups) || !a.groups.every(Array.isArray)) return fail('Geçersiz per listesi.');
        return (a.type === 'open' ? open : lay)(g, p, a.groups);
      case 'addToMeld': return addToMeld(g, p, a.ownerSeat, a.meldIndex, a.tileId);
      case 'discard': return discard(g, p, a.tileId);
      case 'cancelDiscardDraw': return cancelDiscardDraw(g, p);
      default: return fail('Bilinmeyen hamle.');
    }
  }

  function act(code, userId, a) {
    const r = act0(code, userId, a);
    const room = get(code);
    if (room) { settle(room); onOver(room); }
    return r;
  }

  function nextRound(code, userId) {
    const room = get(code);
    if (!room?.game?.over) return fail('El henüz bitmedi.');
    if (!room.seats.includes(userId)) return fail('Bu odada değilsin.');
    const err = chargeRound(room);
    if (err) return fail(err);
    startRound(room.game);
    return { ok: true };
  }

  // Oyuncuya özel görünüm (rakip elleri sızmaz).
  function view(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    const p = room.seats.indexOf(userId);
    if (p < 0) return fail('Bu odada değilsin.');
    return {
      ok: true,
      lobby: { code, host: room.hostId, mode: room.mode, katlamali: room.katlamali, turnSeconds: room.turnSeconds, stake: stakeOf(room), lastPayout: room.lastPayout ?? null, nextAt: room.nextAt ?? null, balances: wallet ? room.seats.map((id) => (id ? wallet.balance(id) : null)) : null, seats: room.seats, started: !!room.game },
      game: room.game ? viewFor(room.game, p) : null,
      balance: wallet ? wallet.balance(userId) : null,
    };
  }

  // Süresi dolan oyuncuların hamlesini otomatik oynar (sunucu saniyede bir çağırır).
  function tick() {
    const events = [];
    for (const [code, room] of rooms) {
      const g = room.game;
      if (!g) continue;
      if (timedOut(g)) {
        const r = autoPlay(g);
        settle(room); onOver(room);
        if (r.ok) events.push({ kind: 'timeout', code, seat: r.seat, tileId: r.tileId });
      } else if (g.over && room.nextAt != null && clock() >= room.nextAt) {
        const err = chargeRound(room);            // 8 sn dolunca yeni el kendiliğinden başlar
        if (err) events.push({ kind: 'nextFail', code, error: err });
        else { startRound(g); events.push({ kind: 'next', code }); }
      }
    }
    return events;
  }

  const balance = (id) => (wallet ? wallet.balance(id) : null);
  return { createRoom, join, leave, start, act, nextRound, view, tick, balance, _room: get };
}
