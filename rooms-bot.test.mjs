import assert from 'node:assert/strict';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';
import { createHub } from './hub.mjs';

let c = Date.parse('2026-10-06T10:00:00Z');
const wallet = createWallet({ now: () => c });
const rm = createRoomManager({ wallet, clock: () => c });
assert.ok(!rm.createRoom('a', { bots: 4 }).ok); assert.ok(!rm.createRoom('a', { bots: -1 }).ok);

// Girişte bot seçimi: 1 insan + 3 bot hemen başlayabilir, jeton yok (antrenman)
const { code } = rm.createRoom('a', { bots: 3 });
let v = rm.view(code, 'a');
assert.deepEqual(v.lobby.bots, [false, true, true, true]);
assert.ok(v.lobby.practice && v.lobby.stake === 0);
assert.ok(rm.start(code, 'a').ok);
assert.equal(rm.balance('a'), 10000);
for (let i = 0; i < 20000 && !rm._room(code).game.over; i++) { c += 1000; rm.tick(); }   // botlar oynar, insan süresi dolunca otomatik
assert.ok(rm._room(code).game.over);
assert.equal(rm.view(code, 'a').lobby.lastPayout, null); assert.equal(rm.balance('a'), 10000);
assert.ok(rm.nextRound(code, 'a').started);          // tek insan hazırsa hemen başlar

// Bekleme odasında bot ekle/çıkar; yeni gelen oyuncu botun yerine geçer
const r2 = rm.createRoom('h', { bots: 1 }).code;
assert.ok(rm.join(r2, 'u').ok);
assert.ok(!rm.addBot(r2, 'u').ok);                   // sadece oda sahibi
assert.ok(rm.addBot(r2, 'h').ok);                    // dolu: h, bot, u, bot
assert.ok(!rm.addBot(r2, 'h').ok);
assert.ok(rm.removeBot(r2, 'h', 3).ok);
assert.ok(rm.addBot(r2, 'h').ok);
assert.ok(rm.join(r2, 'z').ok);                      // dolu ama botlu: z bir botun yerine geçer
assert.equal(rm.view(r2, 'z').lobby.bots.filter(Boolean).length, 1);
assert.ok(rm.start(r2, 'u').ok);                     // yönetici olmayan da başlatır
assert.equal(rm.balance('h'), 10000);                // botlu masada jeton yok

// İnsanların hepsi çıkınca (botlar kalsa da) oda kapanır
const r3 = rm.createRoom('p', { bots: 2 }).code;
assert.ok(rm.leave(r3, 'p').ok);
assert.equal(rm._room(r3), undefined);

// Mesaj merkezi: botların adı ve çevrimiçi durumu
const hub = createHub({ rooms: createRoomManager({ wallet }) });
const inbox = []; const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
const send = (o) => conn.message(JSON.stringify(o));
send({ t: 'hello', name: 'Ali' }); send({ t: 'createRoom', bots: 2 });
const lobby = inbox.findLast((m) => m.t === 'state').lobby;
assert.ok(lobby.names[1].startsWith('🤖') && lobby.online.every(Boolean) === false && lobby.online[1]);
send({ t: 'addBot' });
assert.ok(inbox.findLast((m) => m.t === 'state').lobby.bots.filter(Boolean).length === 3);
send({ t: 'removeBot', seat: 3 });
assert.equal(inbox.findLast((m) => m.t === 'state').lobby.bots.filter(Boolean).length, 2);
console.log('Botlu oda testleri geçti');
