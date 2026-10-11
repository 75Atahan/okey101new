import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRtc } from './rtc.mjs';
import { createHub } from './hub.mjs';

assert.equal(createRtc({ url: 'wss://x' }), null);          // eksik ayarda kapalı
const rtc = createRtc({ url: 'wss://x.livekit.cloud', apiKey: 'KEY', apiSecret: 'SECRET', now: () => 1_700_000_000_000 });
const tok = rtc.token('u1', 'Ali', 'okey-ABC123');
const [h, b, s] = tok.split('.');
assert.equal(createHmac('sha256', 'SECRET').update(`${h}.${b}`).digest('base64url'), s);
const p = JSON.parse(Buffer.from(b, 'base64url'));
assert.deepEqual([p.iss, p.sub, p.name, p.video.room, p.video.roomJoin], ['KEY', 'u1', 'Ali', 'okey-ABC123', true]);
assert.equal(p.exp - p.nbf, 6 * 3600);

// Hub: sadece odadaki oyuncu token alır
const mk = (hub) => {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
  const send = (o) => conn.message(JSON.stringify(o));
  send({ t: 'hello', name: 'Ali' });
  return { inbox, send };
};
const on = mk(createHub({ rtc }));
on.send({ t: 'rtc' });
assert.match(on.inbox.at(-1).error, /odaya/);               // odada değil
on.send({ t: 'createRoom' });
const code = on.inbox.findLast((m) => m.t === 'state').lobby.code;
on.send({ t: 'rtc' });
const r = on.inbox.at(-1);
assert.equal(r.t, 'rtc');
assert.equal(JSON.parse(Buffer.from(r.token.split('.')[1], 'base64url')).video.room, `okey-${code}`);
const off = mk(createHub());
off.send({ t: 'rtc' });
assert.match(off.inbox.at(-1).error, /odaya/);
off.send({ t: 'createRoom' });
off.send({ t: 'rtc' });
assert.equal(off.inbox.at(-1).t, 'callPeers');   // LiveKit yoksa dahili görüntülü sohbet
console.log('LiveKit token testleri geçti');
