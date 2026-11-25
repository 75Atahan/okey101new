import assert from 'node:assert/strict';
import { BOT_ICONS, createRoomManager } from './rooms.mjs';

// Her botun simgesinin adı botun baş harfiyle başlar; simgeler birbirinden farklıdır
const up = (s) => s[0].toLocaleUpperCase('tr');
for (const [name, [icon, word]] of Object.entries(BOT_ICONS)) assert.equal(up(word), up(name), `${name} -> ${word}`);
assert.equal(new Set(Object.values(BOT_ICONS).map((v) => v[0])).size, Object.keys(BOT_ICONS).length);
// Oda görünümünde yalnızca bot koltuklarında simge var
const rm = createRoomManager({ clock: () => 0 });
const code = rm.createRoom('a', { bots: 3 }).code;
const l = rm.view(code, 'a').lobby;
assert.equal(l.botIcons[0], null);
assert.ok(l.botIcons.slice(1).every(Boolean));
console.log('Bot simgeleri (baş harfli nesne) testleri geçti');
