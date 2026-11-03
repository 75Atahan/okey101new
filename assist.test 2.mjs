import assert from 'node:assert/strict';
import { plan } from './assist.mjs';
import { validateMeld, isPair } from './okey101.mjs';
import { newRound } from './okey101.mjs';
import { createGame, lay, addToMeld } from './game101.mjs';

const T = (color, num) => ({ id: Math.floor(Math.random() * 1e9), color, num, fake: false });
const okey = { color: 1, num: 5 };
const check = (hand, pl) => {                       // grupların geçerli ve elden olduğunu doğrula
  const by = new Map(hand.map((t) => [t.id, t]));
  const ids = pl.groups.flat();
  assert.equal(new Set(ids).size, ids.length);
  pl.groups.forEach((g) => {
    const ts = g.map((id) => by.get(id));
    assert.ok(ts.every(Boolean));
    assert.ok(g.length === 2 ? isPair(ts[0], ts[1], okey) : validateMeld(ts, okey).valid);
  });
  assert.ok(ids.length < hand.length);              // atacak taş kalır
  assert.deepEqual([...pl.order].sort(), hand.map((t) => t.id).sort());
};

// Seri el: en az önceki elle bulduğumuz 108 sayı
const a = [T(0, 11), T(0, 12), T(0, 13)], b = [T(1, 10), T(2, 10), T(3, 10)], c = [T(0, 9), T(0, 10), T(0, 11), T(0, 12)];
let hand = [...a, ...b, ...c, T(3, 2), T(2, 1)];
let pl = plan(hand, okey);
assert.equal(pl.mode, 'meld'); assert.ok(pl.canOpen && pl.total >= 108); check(hand, pl);

// Çift el: seri yetmez, 6 çift var
hand = [1, 2, 3, 4, 5, 6].flatMap((n) => [T(0, n), T(0, n)]).concat([T(3, 13), T(2, 9)]);
pl = plan(hand, okey);
assert.equal(pl.mode, 'pairs'); assert.equal(pl.total, 6); assert.ok(pl.canOpen); check(hand, pl);

// Okey eksik taşı tamamlar: sarı 4, okey, sarı 6 + ek taşlar
hand = [T(0, 4), T(1, 5), T(0, 6), T(3, 13), T(2, 1)];
pl = plan(hand, okey);
assert.equal(pl.groups.length, 1); assert.equal(pl.total, 15); check(hand, pl);

assert.equal(plan(hand, okey, { prefer: 'meld' }).mode, 'meld');   // Seri diz düğmesi seri kurgusunu zorlar
// Katlamalı eşik yükselince açılamaz
hand = [...a, ...b, ...c, T(3, 2)];
assert.ok(plan(hand, okey, { minMeld: 400 }).canOpen);            // tüm taşlar perde + 1 atılacak taş: elden bitirme, sayı şartı yok
hand = [...a, ...b, ...c, T(3, 2), T(2, 1)];
assert.ok(!plan(hand, okey, { minMeld: 400 }).canOpen);           // geriye 2 taş kalıyorsa eşik aranır

// Açmış oyuncu: çift açan sadece çift, seri açan çift de serer (masada çift varsa)
hand = [...a, T(3, 7), T(3, 7), T(2, 2)];
assert.ok(plan(hand, okey, { opened: true, openMode: 'pairs' }).groups.every((g) => g.length === 2));
assert.ok(plan(hand, okey, { opened: true, openMode: 'meld' }).groups.every((g) => g.length >= 3));
assert.ok(plan(hand, okey, { opened: true, openMode: 'meld', pairsOnTable: true }).groups.some((g) => g.length === 2));

// Rastgele 150 el: hızlı ve geçerli
const t0 = Date.now();
for (let i = 0; i < 150; i++) {
  const r = newRound();
  const h = r.hands[0];
  check(h, (() => { const p = plan(h, r.okey); const by = new Map(h.map((t) => [t.id, t])); p.groups.forEach((g) => { const ts = g.map((id) => by.get(id)); assert.ok(g.length === 2 ? isPair(ts[0], ts[1], r.okey) : validateMeld(ts, r.okey).valid); }); return { groups: [], order: p.order }; })());
}
assert.ok(Date.now() - t0 < 20000, 'plan çok yavaş');

// --- Motor kuralları: lay / addToMeld ---
const g = createGame(); g.okey = okey;
g.seats[0].opened = true; g.seats[0].openMode = 'meld'; g.seats[0].melds = [[T(0, 11), T(0, 12), T(0, 13)]];
const run = [T(2, 1), T(2, 2), T(2, 3)], pair = [T(3, 7), T(3, 7)];
g.seats[0].hand = [...run, ...pair, T(0, 2)];
assert.ok(lay(g, 0, [run.map((t) => t.id)]).ok);                          // seri açan yeni seri serer
assert.ok(!lay(g, 0, [pair.map((t) => t.id)]).ok);                        // masada çift yok
g.seats[1].opened = true; g.seats[1].openMode = 'pairs';
g.seats[1].melds = [[T(0, 1), T(0, 1)]];
assert.ok(lay(g, 0, [pair.map((t) => t.id)]).ok);                         // çift açılmış: seri açan çift serer

const h = createGame(); h.okey = okey;
h.seats[0].opened = true; h.seats[0].openMode = 'pairs'; h.seats[0].melds = [[T(0, 1), T(0, 1)]];
h.seats[1].opened = true; h.seats[1].openMode = 'meld'; h.seats[1].melds = [[T(0, 11), T(0, 12), T(0, 13)]];
const r3 = [T(2, 4), T(2, 5), T(2, 6)], np = [T(3, 8), T(3, 8)], add = T(0, 10), ex = T(1, 1);
h.seats[0].hand = [...r3, ...np, add, ex];
assert.ok(!lay(h, 0, [r3.map((t) => t.id)]).ok);                          // çift açan per açamaz
assert.ok(lay(h, 0, [np.map((t) => t.id)]).ok);                           // ama çift serer
assert.ok(addToMeld(h, 0, 1, 0, add.id).ok);                              // seri kısma taş ekler
const bad = T(0, 3);
h.seats[0].hand.push(bad);
assert.ok(!addToMeld(h, 0, 0, 0, bad.id).ok);                             // çift taşa işlenmez
console.log('Yardımlı ve ser/ekle kuralları testleri geçti');
