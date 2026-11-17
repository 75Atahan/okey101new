import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';
import { pairsOf } from './assist.mjs';

// İlk el rastgele oyuncuda başlar; sonraki ellerde sıra bir sonraki oyuncuya geçer; görünümde starter vardır
const seen = new Set();
for (let i = 0; i < 40; i++) {
  const rm = createRoomManager({ clock: () => 0, randomStart: true });
  const code = rm.createRoom('a', { bots: 3, rounds: 3 }).code;
  rm.start(code, 'a');
  const g = rm._room(code).game, first = g.turn;
  assert.equal(g.starter, first); assert.equal(rm.view(code, 'a').game.starter, first);
  seen.add(first);
  if (i === 0) {
    g.over = { finisher: null, points: [0, 0, 0, 0], rank: [0, 1, 2, 3], left: [0, 0, 0, 0], tilesLeft: [0, 0, 0, 0], bonus: false };
    rm.nextRound(code, 'a');
    assert.equal(rm._room(code).game.starter, (first + 1) % 4);
  }
}
assert.ok(seen.size >= 3, `ilk başlayan oyuncu rastgele olmalı (görülen: ${[...seen]})`);
// randomStart verilmezse eskisi gibi 0. koltuk başlar (testler deterministik kalır)
const rm0 = createRoomManager({ clock: () => 0 });
const c0 = rm0.createRoom('a', { bots: 3 }).code; rm0.start(c0, 'a');
assert.equal(rm0._room(c0).game.turn, 0);

// Çiftler ıstakada ayrı yerlerde olsa da hepsi bulunur
let id = 1; const T = (c, n) => ({ id: id++, color: c, num: n, fake: false });
const okey = { color: 2, num: 6 };
const hand = [T(0, 3), T(1, 9), T(0, 3), T(3, 12), T(1, 9), T(2, 2), T(3, 12), T(0, 7), T(2, 2), T(1, 1)];
assert.equal(pairsOf(hand, okey).length, 4);                 // 3-3, 9-9, 12-12, 2-2 (ayrı yerlerde)
console.log('Başlangıç oyuncusu ve ayrı yerdeki çiftleri sayma testleri geçti');
