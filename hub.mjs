// Mesaj merkezi: kimlik (misafir token), odalar, hamleler, yazılı sohbet, yeniden bağlanma.
// WebSocket'ten bağımsızdır: connect(send) bir gönderme fonksiyonu alır.
import { randomUUID } from 'node:crypto';
import { createRoomManager } from './rooms.mjs';

const MAX_MSG = 16384; // SDP sinyalleri 4 KB'ı aşabilir
const MAX_CHAT = 300;
const CHAT_LIMIT = { count: 5, windowMs: 5000 };

export function createHub({ rooms = createRoomManager(), now = Date.now, rtc = null, iceServers = [{ urls: 'stun:stun.l.google.com:19302' }] } = {}) {
  const users = new Map();  // userId -> { id, name, token, conns:Set, room, chatTimes }
  const tokens = new Map(); // token -> userId

  const sendTo = (u, msg) => {
    const data = JSON.stringify(msg);
    for (const s of u.conns) s(data);
  };
  const members = (code) => [...users.values()].filter((u) => u.room === code);

  // Dahili görüntülü sohbet (eşler arası): sunucu sadece sinyalleşmeyi iletir, görüntü sunucudan geçmez.
  const callPeers = (u) => members(u.room).filter((x) => x.call && x.id !== u.id).map((x) => ({ id: x.id, name: x.name }));
  function leaveCall(u) {
    if (!u.call) return;
    u.call = false;
    for (const x of members(u.room)) if (x.id !== u.id) sendTo(x, { t: 'callLeft', id: u.id });
  }

  function pushState(code) {
    for (const u of members(code)) {
      const v = rooms.view(code, u.id);
      if (!v.ok) continue;
      v.lobby.names = v.lobby.seats.map((id) => (id ? users.get(id)?.name ?? rooms.botName(id) : null));
      v.lobby.online = v.lobby.seats.map((id) => !!id && ((users.get(id)?.conns.size ?? 0) > 0 || rooms.isBot(id)));
      sendTo(u, { t: 'state', lobby: v.lobby, game: v.game, balance: v.balance });
    }
  }

  function connect(send) {
    let user = null;
    const err = (error) => send(JSON.stringify({ t: 'error', error }));

    function hello(m) {
      if (user) return err('Zaten giriş yaptın.');
      const known = typeof m.token === 'string' ? users.get(tokens.get(m.token)) : null;
      if (known) user = known;
      else {
        const name = String(m.name ?? '').trim().slice(0, 20) || 'Misafir';
        user = { id: randomUUID(), name, token: randomUUID(), conns: new Set(), room: null, chatTimes: [] };
        users.set(user.id, user);
        tokens.set(user.token, user.id);
      }
      user.conns.add(send);
      send(JSON.stringify({ t: 'welcome', userId: user.id, token: user.token, name: user.name, room: user.room, balance: rooms.balance(user.id) }));
      if (user.room) pushState(user.room); // yeniden bağlanan oyuncu durumu geri alır
    }

    function chat(m) {
      if (!user.room) return err('Önce bir odaya katıl.');
      const text = typeof m.text === 'string' ? m.text.trim().slice(0, MAX_CHAT) : '';
      if (!text) return err('Boş mesaj.');
      const t = now();
      user.chatTimes = user.chatTimes.filter((x) => t - x < CHAT_LIMIT.windowMs);
      if (user.chatTimes.length >= CHAT_LIMIT.count) return err('Çok hızlı yazıyorsun.');
      user.chatTimes.push(t);
      for (const u of members(user.room))
        sendTo(u, { t: 'chat', userId: user.id, from: user.name, text, ts: t });
    }

    function handle(raw) {
      if (typeof raw !== 'string' || raw.length > MAX_MSG) return err('Geçersiz mesaj.');
      let m;
      try { m = JSON.parse(raw); } catch { return err('Geçersiz JSON.'); }
      if (!m || typeof m.t !== 'string') return err('Geçersiz mesaj.');
      if (m.t === 'hello') return hello(m);
      if (!user) return err('Önce hello gönder.');
      if (m.t === 'chat') return chat(m);
      if (m.t === 'rtc') {
        if (!user.room) return err('Önce bir odaya katıl.');
        // LiveKit ayarlıysa onun token'ı; değilse dahili eşler arası görüntülü sohbet.
        if (rtc) return send(JSON.stringify({ t: 'rtc', url: rtc.url, token: rtc.token(user.id, user.name, `okey-${user.room}`) }));
        user.call = true;
        return send(JSON.stringify({ t: 'callPeers', peers: callPeers(user), iceServers }));
      }
      if (m.t === 'callLeave') return leaveCall(user);
      if (m.t === 'sig') {
        const to = users.get(m.to);
        if (!user.call || !to?.call || to.room !== user.room || !m.data || typeof m.data !== 'object') return err('Geçersiz sinyal.');
        return sendTo(to, { t: 'sig', from: user.id, data: m.data });
      }

      let r;
      switch (m.t) {
        case 'createRoom':
          if (user.room) return err('Zaten bir odadasın.');
          r = rooms.createRoom(user.id, { mode: m.mode, katlamali: m.katlamali, turnSeconds: m.turnSeconds, bots: m.bots ?? 0 });
          if (r.ok) user.room = r.code;
          break;
        case 'join': {
          if (user.room) return err('Zaten bir odadasın.');
          const code = String(m.code ?? '').trim().toUpperCase();
          r = rooms.join(code, user.id);
          if (r.ok) user.room = code;
          break;
        }
        case 'leave': {
          if (!user.room) return err('Bir odada değilsin.');
          const code = user.room;
          r = rooms.leave(code, user.id);
          if (r.ok) {
            leaveCall(user);
            user.room = null;
            send(JSON.stringify({ t: 'left', balance: rooms.balance(user.id) }));
            pushState(code);
          }
          break;
        }
        case 'start':
          r = user.room ? rooms.start(user.room, user.id) : { ok: false, error: 'Bir odada değilsin.' };
          break;
        case 'act':
          r = user.room ? rooms.act(user.room, user.id, m.action) : { ok: false, error: 'Bir odada değilsin.' };
          break;
        case 'nextRound':
          r = user.room ? rooms.nextRound(user.room, user.id) : { ok: false, error: 'Bir odada değilsin.' };
          break;
        case 'addBot':
          r = user.room ? rooms.addBot(user.room, user.id) : { ok: false, error: 'Bir odada değilsin.' };
          break;
        case 'removeBot':
          r = user.room ? rooms.removeBot(user.room, user.id, m.seat) : { ok: false, error: 'Bir odada değilsin.' };
          break;
        default:
          return err('Bilinmeyen mesaj türü.');
      }
      if (!r.ok) return err(r.error);
      if (user.room && m.t !== 'leave') pushState(user.room);
    }

    return {
      message: handle,
      close() {
        if (!user) return;
        user.conns.delete(send);
        if (!user.conns.size) leaveCall(user);
        if (user.room) pushState(user.room); // çevrimiçi durumu güncelle
      },
    };
  }

  // Süresi dolanları otomatik oynatır ve odaya bildirir (sunucu saniyede bir çağırır).
  function tick() {
    for (const e of rooms.tick()) {
      if (e.kind === 'nextFail') for (const u of members(e.code)) sendTo(u, { t: 'error', error: 'Yeni el başlamadı: ' + e.error });
      else if (e.kind === 'timeout') for (const u of members(e.code)) sendTo(u, { t: 'timeout', seat: e.seat, tileId: e.tileId });
      pushState(e.code);
    }
  }

  return { connect, rooms, tick };
}
