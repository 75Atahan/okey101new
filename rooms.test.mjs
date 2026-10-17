import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';
import { createGame, open, discard } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });

// Oda seçenekleri
const m = createRoomManager();
assert.ok(!m.createRoom('a', { mode: 'xx' }).ok);
assert.ok(!m.createRoom('a', { katlamali: 'evet' }).ok);
const { code } = m.createRoom('a', { mode: 'pairs', katlamali: true });
assert.ok(m.join(code, 'b').ok && m.join(code, 'c').ok);
assert.ok(!m.start(code, 'a').ok);                 // 3 kişi
assert.ok(m.join(code, 'd').ok);
assert.ok(!m.join(code, 'e').ok);                  // dolu
assert.ok(!m.start(code, 'x').ok);                 // odada olmayan başlatamaz (yönetici şart değil)
assert.ok(m.start(code, 'a').ok);
const v = m.view(code, 'a');
assert.equal(v.lobby.katlamali, true);
assert.equal(v.game.katlamali, true);
assert.equal(v.lobby.mode, 'pairs');
assert.ok(!m.act(code, 'b', { type: 'draw', source: 'pile' }).ok); // sıra a'da
assert.ok(!m.act(code, 'x', { type: 'draw' }).ok);                 // odada değil

// Katlama: okeyle bitirince x2 (katlamalı), x1 (katlamasız)
for (const [katlamali, bonus, pen] of [[true, -202, 404], [false, -101, 202]]) {
  const g = createGame({ katlamali });
  g.okey = { color: 1, num: 5 };
  const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)];
  const c = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)], joker = T(1, 5);
  g.seats[0].hand = [...a, ...b, ...c, joker];
  assert.ok(open(g, 0, [a, b, c].map((x) => x.map((t) => t.id))).ok);
  assert.ok(discard(g, 0, joker.id).finished);      // okey atarak bitirdi
  assert.equal(g.scores[0], bonus);
  assert.equal(g.scores[1], pen);
}
console.log('Oda ve katlama testleri geçti');
