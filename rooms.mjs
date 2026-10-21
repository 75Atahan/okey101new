// Oda yöneticisi: aktarım katmanından (WebSocket vb.) bağımsız, test edilebilir.
import {
  createGame, startRound, draw, open, lay, addToMeld, discard, cancelDiscardDraw, viewFor,
  autoPlay, timedOut,
} from './game101.mjs';
import { GAME_STAKE } from './wallet.mjs';
import { botStep } from './bot.mjs';

const MODES = ['single', 'pairs']; // tekli / eşli
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const READY_GRACE_MS = 20000; // ilk "Yeni oyuna başla"dan sonra bu kadar beklenir, basmayanlar hazır sayılır
const BOT_NAMES = ['Ali', 'Ayşe', 'Can', 'Deniz', 'Elif', 'Mert', 'Zeynep', 'Kaan'];
const fail = (error) => ({ ok: false, error });

export function createRoomManager({ rnd = Math.random, clock = Date.now, wallet = null } = {}) {
  const rooms = new Map();
  const botNames = new Map(); // bot kimliği -> görünen ad
  let botSeq = 0;
  const isBot = (id) => typeof id === 'string' && id.startsWith('bot-');
  const hasBots = (room) => room.seats.some(isBot);
  const humansOf = (room) => room.seats.filter((id) => id && !isBot(id));
  function newBot(room) {                                  // odada kullanılmayan bir ad seçer
    const used = new Set(room.seats.filter(isBot).map((id) => botNames.get(id)));
    const name = '🤖 ' + (BOT_NAMES.find((n) => !used.has('🤖 ' + n)) ?? 'Bot ' + (botSeq + 1));
    const id = 'bot-' + ++botSeq;
    botNames.set(id, name);
    return id;
  }

  const newCode = () => {
    let c;
    do c = Array.from({ length: 6 }, () => ALPHABET[Math.floor(rnd() * ALPHABET.length)]).join('');
    while (rooms.has(c));
    return c;
  };

  // Oda açılırken seçenekler: mode ('single'|'pairs'), katlamali (true|false)
  function createRoom(hostId, options = {}) {
    const { mode = 'single', katlamali = false, turnSeconds = 45, bots = 0 } = options;
    if (!MODES.includes(mode)) return fail('Geçersiz oyun modu.');
    if (typeof katlamali !== 'boolean') return fail('Katlamalı seçimi true/false olmalı.');
    if (!Number.isInteger(turnSeconds) || turnSeconds < 15 || turnSeconds > 120)
      return fail('Süre 15-120 saniye arasında olmalı.');
    if (!Number.isInteger(bots) || bots < 0 || bots > 3) return fail('Bot sayısı 0-3 olmalı.');
    const room = { code: newCode(), hostId, mode, katlamali, turnSeconds, seats: [hostId, null, null, null], game: null, ready: new Set(), readyAt: null, botAt: null };
    for (let i = 1; i <= bots; i++) room.seats[i] = newBot(room);
    rooms.set(room.code, room);
    return { ok: true, code: room.code };
  }

  const get = (code) => rooms.get(code);
  const stakeOf = (room) => GAME_STAKE * (room.katlamali ? 2 : 1); // katlamalıda 2 katı
  const onOver = () => {}; // yeni el kendiliğinden başlamaz: oyunculardan biri "Yeni oyuna başla"ya basar

  // Her el başında herkesten masa bedeli alınır (hepsi ya da hiçbiri).
  function chargeRound(room) {
    room.settled = false; room.lastPayout = null; room.nextAt = null; room.ready = new Set(); room.readyAt = null; room.botAt = null;
    room.practice = hasBots(room);                          // botlu masa: antrenman, jeton yok (tur başında belirlenir)
    if (!wallet || room.practice) { room.pot = 0; return null; }
    if (!wallet.charge(room.seats, stakeOf(room))) return 'Bir oyuncunun jetonu yetersiz.';
    room.pot = stakeOf(room) * room.seats.length;
    return null;
  }
  // El bitince: elde en az taş kalan (bitiren) kazanır, ikinci bedelini geri alır.
  // Normal: 1. = 3 bedel (7.500), 2. = 1 bedel (2.500). Bitiren veya çift açan kazanan: 1. = 6 bedel (15.000).
  // Eşlide kazanan takım toplam ödülü paylaşır (normal: havuz = 4 bedel, büyük ödül: 6 bedel).
  function settle(room) {
    const o = room.game?.over;
    if (!wallet || !o || room.settled) return;
    room.settled = true;
    if (room.practice) { room.lastPayout = null; return; }
    const n = room.seats.length, st = stakeOf(room), pay = Array(n).fill(0), w = o.rank[0];
    if (room.mode === 'pairs') {
      const prize = (o.bonus ? 6 : 4) * st;
      pay[w] = prize / 2; pay[(w + 2) % n] = prize / 2;
    } else {
      pay[w] = (o.bonus ? 6 : 3) * st;
      pay[o.rank[1]] = st;
    }
    room.seats.forEach((id, i) => { if (!isBot(id)) wallet.pay(id, pay[i]); });   // oyundan çıkıp yerine bot geçen koltuğa ödeme yok
    room.lastPayout = pay.map((x) => x - st);
  }

  function join(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.game) return fail('Oyun başladı.');
    if (room.seats.includes(userId)) return fail('Zaten odadasın.');
    let free = room.seats.indexOf(null);
    if (free < 0) {                                         // dolu ama botlu: yeni oyuncu bir botun yerine geçer
      free = room.seats.map(isBot).lastIndexOf(true);
      if (free < 0) return fail('Oda dolu.');
      botNames.delete(room.seats[free]);
    }
    room.seats[free] = userId;
    return { ok: true, seat: free };
  }

  function leave(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    const s = room.seats.indexOf(userId);
    if (s < 0) return fail('Odada değilsin.');
    if (room.game && !room.game.over) {                     // oyun sırasında çıkış: yerine bot geçer, yatırılan jeton kaybolur
      room.seats[s] = newBot(room);
      room.botAt = null;
      const rest = humansOf(room);
      if (rest.length === 0) { room.seats.filter(isBot).forEach((id) => botNames.delete(id)); rooms.delete(code); }
      else if (room.hostId === userId) room.hostId = rest[0];
      return { ok: true, replaced: true };
    }
    if (room.game) { room.game = null; room.nextAt = null; room.ready = new Set(); room.readyAt = null; } // el bitti: masa bekleme ekranına döner
    room.seats[s] = null;
    const rest = humansOf(room);
    if (rest.length === 0) { room.seats.filter(isBot).forEach((id) => botNames.delete(id)); rooms.delete(code); }
    else if (room.hostId === userId) room.hostId = rest[0];
    return { ok: true };
  }

  // Oda sahibi boş koltuğa bot ekler / bot çıkarır (oyun başlamadan).
  function addBot(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.hostId !== userId) return fail('Bot sadece oda sahibi ekler.');
    if (room.game) return fail('Oyun başladı.');
    const free = room.seats.indexOf(null);
    if (free < 0) return fail('Boş koltuk yok.');
    room.seats[free] = newBot(room);
    return { ok: true, seat: free };
  }
  function removeBot(code, userId, seat) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (room.hostId !== userId) return fail('Bot sadece oda sahibi çıkarır.');
    if (room.game) return fail('Oyun başladı.');
    if (!isBot(room.seats[seat])) return fail('Orada bot yok.');
    botNames.delete(room.seats[seat]);
    room.seats[seat] = null;
    return { ok: true };
  }

  function start(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    if (!room.seats.includes(userId)) return fail('Bu odada değilsin.');   // yönetici şart değil: oturan herkes başlatabilir
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
    room.ready.add(userId);
    if (room.readyAt == null) room.readyAt = clock();
    if (humansOf(room).every((id) => room.ready.has(id))) return beginNext(room);
    return { ok: true, waiting: true };
  }
  function beginNext(room) {
    const err = chargeRound(room);
    if (err) return fail(err);
    startRound(room.game);
    return { ok: true, started: true };
  }

  // Oyuncuya özel görünüm (rakip elleri sızmaz).
  function view(code, userId) {
    const room = get(code);
    if (!room) return fail('Oda bulunamadı.');
    const p = room.seats.indexOf(userId);
    if (p < 0) return fail('Bu odada değilsin.');
    return {
      ok: true,
      lobby: { code, host: room.hostId, mode: room.mode, katlamali: room.katlamali, turnSeconds: room.turnSeconds, stake: (room.game ? room.practice : hasBots(room)) ? 0 : stakeOf(room), practice: room.game ? !!room.practice : hasBots(room), bots: room.seats.map(isBot), ready: room.seats.map((id) => !!id && (isBot(id) || room.ready.has(id))), readyAt: room.readyAt, readyGrace: READY_GRACE_MS, lastPayout: room.lastPayout ?? null, nextAt: room.nextAt ?? null, balances: wallet ? room.seats.map((id) => (id && !isBot(id) ? wallet.balance(id) : null)) : null, seats: room.seats, started: !!room.game },
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
      } else if (g.over && room.readyAt != null && clock() >= room.readyAt + READY_GRACE_MS) {
        const r = beginNext(room);                      // ilk basıştan 20 sn sonra basmayanlar beklenmeden başlar
        events.push(r.ok ? { kind: 'next', code } : { kind: 'nextFail', code, error: r.error });
      } else if (!g.over && isBot(room.seats[g.turn])) {   // bot sırası: kısa düşünme süresi sonra bir adım oynar
        if (room.botAt == null) room.botAt = clock() + 900 + Math.floor(rnd() * 900);
        else if (clock() >= room.botAt) {
          room.botAt = null;
          botStep(g, g.turn);
          settle(room);
          events.push({ kind: 'bot', code });
        }
      }
    }
    return events;
  }

  const balance = (id) => (wallet ? wallet.balance(id) : null);
  const botName = (id) => botNames.get(id) ?? null;
  return { createRoom, join, leave, start, act, nextRound, addBot, removeBot, view, tick, balance, isBot, botName, _room: get };
}
