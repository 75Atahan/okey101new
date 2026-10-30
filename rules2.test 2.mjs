import assert from 'node:assert/strict';
import { createGame, open, lay, discard } from './game101.mjs';
import { jokerReplaceIndex } from './okey101.mjs';

const T = (color, num, id) => ({ id: id ?? Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };            // okey: mavi 6 değil, rakam = gösterge+1; aşağıda okey taşı olarak T(1,5) kullanılır
const J = () => T(1, 5);                      // okey taşı

// 1) 3 taşlı aynı sayılı perde (13-13-okey): okey alınamaz; 4 taşlıda alınır; seride alınır
const three = [T(0, 13), T(2, 13), J()];
assert.equal(jokerReplaceIndex(three, T(3, 13), okey), -1);
const four = [T(0, 13), T(2, 13), T(3, 13), J()];
assert.equal(jokerReplaceIndex(four, T(1, 13), okey), 3);
const run = [T(0, 3), J(), T(0, 5)];
assert.equal(jokerReplaceIndex(run, T(0, 4), okey), 1);

// 2) Elden bitirme: 101 şartı yok
function fresh() {
  const g = createGame({ clock: () => 0 });
  g.okey = okey; g.turn = 0; g.phase = 'discard'; g.mustUse = null; g.acted = false;
  return g;
}
const ids = (m) => m.map((t) => t.id);
let g = fresh();
const a = [T(0, 1), T(0, 2), T(0, 3)], last = T(3, 9);
g.seats[0].hand = [...a, last];                               // toplam 6 sayı, geriye atılacak 1 taş
assert.ok(open(g, 0, [ids(a)]).ok, 'elden bitirme 101 altında açılabilmeli');
assert.ok(discard(g, 0, last.id).finished);
assert.equal(g.over.points[0], -101);

// 3) Eli bitirmeyen düşük açış: açılamaz, turu bitirince 101 ceza
g = fresh();
const b = [T(0, 1), T(0, 2), T(0, 3)], r1 = T(3, 9), r2 = T(2, 4);
g.seats[0].hand = [...b, r1, r2];
assert.equal(open(g, 0, [ids(b)]).ok, false);
assert.ok(discard(g, 0, r1.id).ok);
assert.equal(g.seats[0].penalty, 101);

// 4) "açtı" sayısı yalnızca ilk açılış toplamı; sonradan serilenler eklenmez
g = fresh();
const c = [T(0, 10), T(0, 11), T(0, 12)], d = [T(1, 10), T(2, 10), T(3, 10)], e = [T(2, 11), T(2, 12), T(2, 13)], h = [T(1, 7), T(1, 8), T(1, 9)];
const f = [T(0, 4), T(2, 4), T(3, 4)];
g.seats[0].hand = [...c, ...d, ...e, ...h, ...f, T(3, 1), T(2, 2)];
assert.ok(open(g, 0, [ids(c), ids(d), ids(e), ids(h)]).ok);   // 33 + 30 + 36 + 24 = 123
assert.equal(g.seats[0].openTotal, 123);
assert.ok(lay(g, 0, [ids(f)]).ok);                            // sonradan serilen 12 sayı eklenmez
assert.equal(g.seats[0].openTotal, 123);
console.log('Okey alma (3 taşlı perde), elden bitirme ve açtı sayısı testleri geçti');
