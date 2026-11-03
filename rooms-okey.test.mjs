import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const run = (c, a, b) => Array.from({ length: b - a + 1 }, (_, i) => T(c, a + i));
const winner14 = () => [...run(1, 1, 3), ...run(2, 4, 7), T(0, 9), T(1, 9), T(2, 9), T(0, 12), T(1, 12), T(2, 12), T(3, 12)];
const rm = createRoomManager({ clock: () => 0 });

// Geçersiz tür
assert.equal(rm.createRoom('a', { kind: 'poker' }).ok, false);
// Klasik Okey odası: katlamalı yok sayılır, tür görünüme yansır
const { code } = rm.createRoom('a', { kind: 'okey', katlamali: true, rounds: 2 });
['b', 'c', 'd'].forEach((u) => rm.join(code, u));
assert.ok(rm.start(code, 'a').ok);
let v = rm.view(code, 'a');
assert.equal(v.lobby.kind, 'okey'); assert.equal(v.lobby.katlamali, false); assert.equal(v.game.kind, 'okey');
assert.equal(v.game.hand.length, 15); assert.equal(rm.view(code, 'b').game.hand.length, 14);
// 101'e özgü hamleler reddedilir
assert.equal(rm.act(code, 'a', { type: 'open', groups: [] }).ok, false);
// Taş at, çek, bitir
const g = rm._room(code).game; g.okey = { color: 0, num: 6 };
const extra = T(3, 1);
g.seats[0].hand = [...winner14(), extra];
const r = rm.act(code, 'a', { type: 'discard', tileId: extra.id });
assert.ok(r.ok && r.finished);
v = rm.view(code, 'a');
assert.ok(v.game.over); assert.equal(v.game.over.factor, 1); assert.equal(v.game.scores[0], 1);
assert.equal(v.lobby.matchOver, false); assert.equal(v.lobby.roundNo, 1);
// Sonraki oyun: puan birikir
['a', 'b', 'c', 'd'].forEach((u) => rm.nextRound(code, u));
v = rm.view(code, 'a'); assert.equal(v.lobby.roundNo, 2); assert.equal(v.game.scores[0], 1); assert.equal(v.game.over, null);
// Botlu klasik oda: bot sırası kendiliğinden oynar
const c2 = rm.createRoom('x', { kind: 'okey', bots: 3 }).code;
assert.ok(rm.start(c2, 'x').ok);
let clock = 0; const rm2 = createRoomManager({ clock: () => clock });
const c3 = rm2.createRoom('y', { kind: 'okey', bots: 3 }).code; rm2.start(c3, 'y');
const g3 = rm2._room(c3).game;
const startTurn = g3.turn;
for (let i = 0; i < 400 && !g3.over; i++) { clock += 1000; rm2.tick(); if (g3.turn === 0 && g3.phase === 'draw' && !g3.over) { g3.seats[0].hand.length === 14 && rm2.act(c3, 'y', { type: 'draw', source: 'pile' }) && rm2.act(c3, 'y', { type: 'discard', tileId: g3.seats[0].hand.find((t) => !(t.color === g3.okey.color && t.num === g3.okey.num))?.id ?? g3.seats[0].hand[0].id }); } }
assert.ok(g3.over || g3.roundNo >= 1);
console.log('Klasik Okey oda testleri geçti');
