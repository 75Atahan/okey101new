import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStats, dayKey } from './stats.mjs';
import { createHub } from './hub.mjs';
import { createRoomManager } from './rooms.mjs';

// Gün Türkiye saatine göre değişir (UTC+3): 21:00 UTC = gece 00:00 TR
assert.equal(dayKey(Date.parse('2026-11-05T20:59:00Z')), '2026-11-05');
assert.equal(dayKey(Date.parse('2026-11-05T21:00:00Z')), '2026-11-06');

let t = Date.parse('2026-11-05T10:00:00Z');
const file = path.join(os.tmpdir(), `luna-stats-${process.pid}.json`);
fs.rmSync(file, { force: true });
let s = createStats({ now: () => t, file });
s.seen('a'); s.seen('a'); s.seen('b'); s.gameStarted(); s.gameStarted(); s.sample(3); s.sample(2);
let snap = s.snapshot({ online: 2 });
assert.deepEqual(snap.today, { day: '2026-11-05', players: 2, games: 2, peak: 3 });   // aynı oyuncu bir kez sayılır
assert.equal(snap.online, 2);
s.save();
// Yeniden başlatma: aynı gün kaldığı yerden devam eder
s = createStats({ now: () => t, file });
assert.deepEqual(s.snapshot().today, { day: '2026-11-05', players: 2, games: 2, peak: 3 });
// Gün değişince sıfırlanır
t = Date.parse('2026-11-05T21:30:00Z');
assert.deepEqual(s.snapshot().today, { day: '2026-11-06', players: 0, games: 0, peak: 0 });
// Başka günün dosyası okunmaz
s = createStats({ now: () => t, file });
assert.equal(s.snapshot().today.players, 0);
fs.rmSync(file, { force: true });

// Hub: çevrimiçi / masada oynayan sayısı, botlar sayılmaz; oyun başlayınca sayaç artar
const st = createStats({ now: () => t });
const rooms = createRoomManager({ onGame: () => st.gameStarted() });
const hub = createHub({ rooms, stats: st, now: () => t });
const cs = ['Ali', 'Veli', 'Ayşe', 'Fatma'].map((name) => {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
  conn.message(JSON.stringify({ t: 'hello', name }));
  return { conn, send: (o) => conn.message(JSON.stringify(o)), inbox };
});
let h = hub.statsSnapshot();
assert.equal(h.online, 4); assert.equal(h.playing, 0); assert.equal(h.today.players, 4); assert.equal(h.today.games, 0);
cs[0].send({ t: 'createRoom' });
const code = cs[0].inbox.findLast((m) => m.t === 'state').lobby.code;
cs.slice(1).forEach((c) => c.send({ t: 'join', code }));
cs[0].send({ t: 'start' });
h = hub.statsSnapshot();
assert.equal(h.playing, 4); assert.equal(h.tables, 1); assert.equal(h.playingTables, 1); assert.equal(h.today.games, 1);
cs[3].conn.close?.();
h = hub.statsSnapshot();
assert.equal(h.online, 3); assert.equal(h.today.peak, 4);                        // en yüksek eşzamanlı sayı korunur
console.log('İstatistik (çevrimiçi, masada, günlük) testleri geçti');
