import assert from 'node:assert/strict';
import { createGame, draw, autoPlay, timedOut } from './game101.mjs';
import { createRoomManager } from './rooms.mjs';
import { createHub } from './hub.mjs';

// --- Motor ---
let t = 0;
const g = createGame({ turnSeconds: 30, clock: () => t });
assert.equal(g.deadline, 30000);
t = 29999; assert.ok(!timedOut(g));
t = 30001; assert.ok(timedOut(g));

// 1) Başlayan oyuncu (çekilen taş yok): bir taş atılır, sıra geçer, süre yenilenir
let r = autoPlay(g);
assert.ok(r.ok && r.seat === 0);
assert.equal(g.seats[0].hand.length, 21);
assert.equal(g.turn, 1);
assert.equal(g.deadline, 60001);

// 2) Çekmeden süre dolarsa: yığından çeker ve çekilen taşı atar
t = 61000;
const peek = g.pile[0].id;
r = autoPlay(g);
assert.equal(r.tileId, peek);
assert.equal(g.discardPiles[1].at(-1).id, peek);
assert.equal(g.seats[1].hand.length, 21);
assert.equal(g.turn, 2);

// 3) Atık taşı alıp kullanamayan: taş geri bırakılır, yığından çekileni atar
const taken = g.discardPiles[1].at(-1);
draw(g, 2, 'discard');
t = 100000;
r = autoPlay(g);
assert.equal(g.discardPiles[1].at(-1).id, taken.id);
assert.equal(g.discardPiles[2].at(-1).id, r.tileId);
assert.notEqual(r.tileId, taken.id);
assert.equal(g.seats[2].hand.length, 21);
assert.equal(g.turn, 3);

// --- Oda yöneticisi ---
let c = 0;
const rm = createRoomManager({ clock: () => c });
assert.ok(!rm.createRoom('a', { turnSeconds: 5 }).ok);
assert.ok(!rm.createRoom('a', { turnSeconds: 'x' }).ok);
const { code } = rm.createRoom('a', { turnSeconds: 20 });
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
rm.start(code, 'a');
const v = rm.view(code, 'a');
assert.equal(v.lobby.turnSeconds, 20);
assert.equal(v.game.deadline, 20000);
c = 19000; assert.deepEqual(rm.tick(), []);
c = 21000;
const ev = rm.tick();
assert.equal(ev.length, 1);
assert.equal(ev[0].seat, 0);
assert.equal(rm.view(code, 'a').game.turn, 1);

// --- Hub: odaya 'timeout' bildirimi ---
let hc = 0;
const hub = createHub({ rooms: createRoomManager({ clock: () => hc }) });
const cl = ['A', 'B', 'C', 'D'].map((name) => {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
  const send = (o) => conn.message(JSON.stringify(o));
  send({ t: 'hello', name });
  return { inbox, send };
});
cl[0].send({ t: 'createRoom', turnSeconds: 15 });
const rc = cl[0].inbox.findLast((m) => m.t === 'state').lobby.code;
cl.slice(1).forEach((x) => x.send({ t: 'join', code: rc }));
cl[0].send({ t: 'start' });
hc = 16000;
hub.tick();
assert.ok(cl.every((x) => x.inbox.some((m) => m.t === 'timeout' && m.seat === 0)));
assert.equal(cl[1].inbox.findLast((m) => m.t === 'state').game.turn, 1);
console.log('Sıra süresi testleri geçti');
