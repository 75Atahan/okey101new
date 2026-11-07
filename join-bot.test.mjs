import assert from 'node:assert/strict';
import { createRoomManager } from './rooms.mjs';

// Oyun başladıktan sonra dışarıdan gelen oyuncu botların yerine geçer: önce kurucunun karşısındaki, sonra sırayla
let clock = 1000;
const rm = createRoomManager({ clock: () => clock });
const { code } = rm.createRoom('host', { bots: 3 });
assert.ok(rm.start(code, 'host').ok);
const room = rm._room(code);
const handOf = (seat) => room.game.seats[seat].hand.map((t) => t.id).join(',');
const before2 = handOf(2);

assert.equal(rm.join(code, 'x').seat, 2);                       // karşısındaki bot
assert.equal(handOf(2), before2);                              // botun elini devralır
assert.equal(rm.view(code, 'x').game.you, 2);
assert.equal(rm.join(code, 'y').seat, 1);
assert.equal(rm.join(code, 'z').seat, 3);
const full = rm.join(code, 'w');
assert.equal(full.ok, false); assert.match(full.error, /dolu/);   // dört insan oldu
assert.equal(rm.join(code, 'x').ok, false);                    // zaten odada
assert.ok(room.seats.every((id) => !rm.isBot(id)));

// Sıra bota aitken geçilirse yeni oyuncu tam süre alır
const rm2 = createRoomManager({ clock: () => clock });
const c2 = rm2.createRoom('host', { bots: 3 }).code;
rm2.start(c2, 'host');
const r2 = rm2._room(c2), g2 = r2.game;
g2.turn = 2; g2.deadline = clock + 1000;
rm2.join(c2, 'x');
assert.equal(r2.seats[2], 'x');
assert.equal(g2.deadline, clock + g2.turnMs);
assert.equal(r2.botAt ?? null, null);

// Bekleme odasında da aynı sıra: ilk gelen karşıya oturur (eşlide takım arkadaşı)
const rm3 = createRoomManager({ clock: () => clock });
const c3 = rm3.createRoom('host', { mode: 'pairs' }).code;
assert.equal(rm3.join(c3, 'x').seat, 2);
assert.equal(rm3.join(c3, 'y').seat, 1);
assert.equal(rm3.join(c3, 'z').seat, 3);
assert.equal(rm3.join(c3, 'q').ok, false);

// Klasik Okey'de de çalışır
const rm4 = createRoomManager({ clock: () => clock });
const c4 = rm4.createRoom('host', { kind: 'okey', bots: 2 }).code;
assert.equal(rm4.join(c4, 'x').seat, 3);                        // boş koltuk önce dolar (botlar yerinde kalır)
rm4.start(c4, 'host');
assert.equal(rm4.join(c4, 'y').seat, 2);                        // sonra karşıdaki bot yer verir
assert.equal(rm4._room(c4).seats.filter((id) => rm4.isBot(id)).length, 1);
assert.equal(rm4.join(c4, 'z').seat, 1);
assert.ok(rm4._room(c4).seats.every((id) => !rm4.isBot(id)));
console.log('Odaya sonradan katılma (botların yerine geçme) testleri geçti');
