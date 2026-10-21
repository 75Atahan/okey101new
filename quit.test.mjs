import assert from 'node:assert/strict';
import { createGame, discard, autoPlay } from './game101.mjs';
import { createWallet } from './wallet.mjs';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
const okey = { color: 1, num: 5 };

// Okeyi (son taş değilken) atmak 101 ceza yedirir ve herkese bildirilir
let g = createGame({ clock: () => 0 }); g.okey = okey;
const J = T(1, 5);
g.turn = 0; g.phase = 'discard'; g.seats[0].hand = [J, T(0, 1), T(2, 3)];
assert.ok(discard(g, 0, J.id).ok);
assert.equal(g.seats[0].penalty, 101);
assert.deepEqual([g.lastPenalty.seat, g.lastPenalty.why], [0, 'okeyi attı']);

// Elde tek taş okey ve açılmışsa: bu bitirmedir, ceza yok
g = createGame({ clock: () => 0 }); g.okey = okey;
g.turn = 0; g.phase = 'discard'; g.seats[0].opened = true; g.seats[0].openMode = 'meld';
const J2 = T(1, 5); g.seats[0].hand = [J2];
assert.ok(discard(g, 0, J2.id).finished);
assert.equal(g.seats[0].penalty, 0); assert.equal(g.over.withOkey, true);

// Süre dolunca otomatik atış çekilen okeyi atmaz
g = createGame({ clock: () => 0 }); g.okey = okey;
const J3 = T(1, 5);
g.turn = 1; g.phase = 'draw'; g.pile.unshift(J3);
autoPlay(g);
assert.ok(g.seats[1].hand.some((t) => t.id === J3.id));
assert.equal(g.seats[1].penalty, 0);

// Oyun sırasında çıkış: yerine bot geçer, oyun sürer, jeton kaybolur
const wallet = createWallet({ now: () => Date.parse('2026-10-06T10:00:00Z') });
let c = 0;
const rm = createRoomManager({ wallet, clock: () => c });
const { code } = rm.createRoom('a', {});
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
rm.start(code, 'a');
assert.equal(rm.balance('d'), 7500);
const r = rm.leave(code, 'd');
assert.ok(r.ok && r.replaced);
let v = rm.view(code, 'a');
assert.deepEqual(v.lobby.bots, [false, false, false, true]);
assert.ok(!v.lobby.practice);                           // masa hâlâ jetonlu (tur başında bot yoktu)
assert.ok(!rm.view(code, 'd').ok);                      // çıkan oyuncu artık odada değil
// Bot o koltukta oynar; 'a' eli bitirince ödül normal ödenir
const room = rm._room(code), gm = room.game; gm.okey = okey;
const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
gm.turn = 0; gm.phase = 'discard'; gm.seats[0].hand = [...a, ...b, ...d, last];
gm.seats[1].hand = gm.seats[1].hand.slice(0, 8); gm.seats[2].hand = gm.seats[2].hand.slice(0, 12); gm.seats[3].hand = gm.seats[3].hand.slice(0, 5);
assert.ok(rm.act(code, 'a', { type: 'open', groups: [a, b, d].map(ids) }).ok);
assert.ok(rm.act(code, 'a', { type: 'discard', tileId: last.id }).ok);
assert.equal(rm.balance('a'), 22500);                   // 7.500 + 15.000
// Son insan da çıkınca oda kapanır
['a', 'b', 'c'].forEach((u) => rm.leave(code, u));
assert.equal(rm._room(code), undefined);
console.log('Okey cezası ve oyundan çıkış testleri geçti');
