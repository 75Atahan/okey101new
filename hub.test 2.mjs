import assert from 'node:assert/strict';
import { createHub } from './hub.mjs';

let clock = 1000;
const hub = createHub({ now: () => clock });

function client() {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
  return {
    inbox, conn,
    send: (o) => conn.message(JSON.stringify(o)),
    last: (t) => inbox.findLast((m) => m.t === t),
  };
}

const c = ['Ali', 'Veli', 'Ayşe', 'Fatma'].map((name) => {
  const x = client();
  x.send({ t: 'hello', name });
  assert.equal(x.last('welcome').name, name);
  return x;
});

// Oda kur, katıl, başlat
c[0].send({ t: 'createRoom', mode: 'pairs', katlamali: true });
const code = c[0].last('state').lobby.code;
c.slice(1).forEach((x) => x.send({ t: 'join', code: code.toLowerCase() }));
c[0].send({ t: 'start' });
assert.ok(c.every((x) => x.last('state').game));

// Oyuncuya özel görünüm, sızıntı yok
const s0 = c[0].last('state'), s1 = c[1].last('state');
assert.equal(s0.game.hand.length, 22);
assert.equal(s1.game.hand.length, 21);
assert.ok(!('handCount' in s1.game.others[0]));   // rakibin taş sayısı gizli
assert.ok(!('hand' in s1.game.others[0]));
assert.deepEqual(s1.lobby.names, ['Ali', 'Veli', 'Ayşe', 'Fatma']);
assert.equal(s1.lobby.katlamali, true);

// Sıra kontrolü sunucuda
c[1].send({ t: 'act', action: { type: 'draw', source: 'pile' } });
assert.ok(c[1].last('error'));

// Yazılı sohbet + hız sınırı
c[1].send({ t: 'chat', text: '  selam  ' });
assert.ok(c.every((x) => x.last('chat')?.text === 'selam' && x.last('chat').from === 'Veli'));
for (let i = 0; i < 6; i++) c[1].send({ t: 'chat', text: 'x' });
assert.equal(c[1].inbox.filter((m) => m.t === 'error' && /hızlı/.test(m.error)).length, 2);
clock += 6000;
c[1].send({ t: 'chat', text: 'tamam' });
assert.equal(c[0].last('chat').text, 'tamam');

// Bağlantı kopması ve token ile geri dönüş
const token = c[2].last('welcome').token;
c[2].conn.close();
assert.equal(c[0].last('state').lobby.online[2], false);
const back = client();
back.send({ t: 'hello', token });
assert.equal(back.last('welcome').room, code);
assert.equal(back.last('state').game.hand.length, 21);
assert.equal(c[0].last('state').lobby.online[2], true);

// Geçersiz girdiler
const z = client();
z.conn.message('x');
z.send({ t: 'join', code });
z.send({ t: 'hello', name: 'Z' });
z.send({ t: 'bilinmeyen' });
z.conn.message('a'.repeat(5000));
assert.equal(z.inbox.filter((m) => m.t === 'error').length, 4);
assert.equal(z.last('welcome').name, 'Z');
console.log('Sunucu merkezi testleri geçti');
