import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const ids = (m) => m.map((t) => t.id);
const rm = createRoomManager({ clock: () => 0 });

// Geçersiz oyun sayısı
assert.equal(rm.createRoom('a', { rounds: 0 }).ok, false);
assert.equal(rm.createRoom('a', { rounds: 12 }).ok, false);
assert.equal(rm.createRoom('a', { rounds: 2.5 }).ok, false);

const { code } = rm.createRoom('a', { rounds: 3 });
const users = ['a', 'b', 'c', 'd'];
users.slice(1).forEach((u) => rm.join(code, u));
assert.ok(rm.start(code, 'a').ok);
assert.equal(rm.view(code, 'a').lobby.rounds, 3);

// Sırası gelen oyuncu eli bitirir (elinde per dizisi + atılacak taş)
function finishHand() {
  const g = rm._room(code).game, s = g.turn, uid = rm._room(code).seats[s];
  g.okey = { color: 1, num: 5 }; g.phase = 'discard';
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], d = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], last = T(3, 2);
  g.seats[s].hand = [...a, ...b, ...d, last];
  assert.ok(rm.act(code, uid, { type: 'open', groups: [a, b, d].map(ids) }).ok);
  assert.ok(rm.act(code, uid, { type: 'discard', tileId: last.id }).ok);
  assert.ok(g.over);
  return s;
}
const everyoneNext = () => users.forEach((u) => rm.nextRound(code, u));

const s1 = finishHand();
let v = rm.view(code, 'a');
assert.equal(v.lobby.roundNo, 1); assert.equal(v.lobby.matchOver, false);
const after1 = [...v.game.scores];
assert.equal(after1[s1], -101);                       // bitiren -101, diğerleri elindeki sayı

everyoneNext();
v = rm.view(code, 'a');
assert.ok(!v.game.over); assert.equal(v.lobby.roundNo, 2);
assert.deepEqual(v.game.scores, after1);              // puanlar birikerek devam eder

finishHand(); everyoneNext();
v = rm.view(code, 'a'); assert.equal(v.lobby.roundNo, 3); assert.equal(v.lobby.matchOver, false);

const before3 = [...rm.view(code, 'a').game.scores];
const s3 = finishHand();
v = rm.view(code, 'a');
assert.equal(v.lobby.matchOver, true);                // 3 oyun bitti: maç sonu
assert.ok(v.game.scores.every((x) => typeof x === 'number'));
assert.equal(v.game.scores[s3] - before3[s3], -101);   // son oyunu bitiren -101 aldı, toplam birikti

everyoneNext();                                       // maç bitince "yeni maç": puanlar sıfırdan
v = rm.view(code, 'a');
assert.ok(!v.game.over); assert.equal(v.lobby.roundNo, 1); assert.equal(v.lobby.matchOver, false);
assert.deepEqual(v.game.scores, [0, 0, 0, 0]);
console.log('Oyun sayısı (maç) testleri geçti');
