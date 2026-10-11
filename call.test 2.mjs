import assert from 'node:assert/strict';
import { createHub } from './hub.mjs';

const hub = createHub();
const mk = (name) => {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)));
  const send = (o) => conn.message(JSON.stringify(o));
  send({ t: 'hello', name });
  return { inbox, send, conn, last: (t) => inbox.findLast((m) => m.t === t), id: () => inbox.find((m) => m.t === 'welcome').userId };
};
const [a, b, c, x] = ['A', 'B', 'C', 'X'].map(mk);
a.send({ t: 'createRoom' });
const code = a.last('state').lobby.code;
[b, c].forEach((u) => u.send({ t: 'join', code }));

a.send({ t: 'rtc' });                                            // ilk katılan: kimse yok
assert.deepEqual(a.last('callPeers').peers, []);
assert.ok(a.last('callPeers').iceServers.length > 0);
b.send({ t: 'rtc' });                                            // ikinci katılan: A'yı görür
assert.deepEqual(b.last('callPeers').peers.map((p) => p.id), [a.id()]);

const big = 'v=0\r\n'.repeat(1000);                              // gerçekçi büyüklükte SDP
b.send({ t: 'sig', to: a.id(), data: { sdp: { type: 'offer', sdp: big } } });
assert.equal(a.last('sig').from, b.id());
assert.equal(a.last('sig').data.sdp.sdp.length, big.length);

c.send({ t: 'sig', to: a.id(), data: { candidate: {} } });       // aramada olmayan sinyal gönderemez
assert.ok(c.last('error'));
x.send({ t: 'sig', to: a.id(), data: {} });                      // odada olmayan da gönderemez
assert.ok(x.last('error'));

a.send({ t: 'callLeave' });
assert.equal(b.last('callLeft').id, a.id());
c.send({ t: 'rtc' });                                            // bağlantı kopunca da bildirilir
c.conn.close();
assert.equal(b.last('callLeft').id, c.id());
console.log('Dahili görüntülü sohbet sinyal testleri geçti');
