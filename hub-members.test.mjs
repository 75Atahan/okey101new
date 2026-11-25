import assert from 'node:assert/strict';
import { createHub } from './hub.mjs';
import { createMembers } from './members.mjs';

let clock = 1000000;
const hub = createHub({ now: () => clock, memberStore: createMembers({ now: () => clock, testMode: true }) });
const wait = () => new Promise((r) => setTimeout(r, 10));
function client() {
  const inbox = [];
  const conn = hub.connect((d) => inbox.push(JSON.parse(d)), '9.9.9.9');
  return { inbox, send: (o) => conn.message(JSON.stringify(o)), last: (t) => inbox.findLast((m) => m.t === t) };
}
const a = client();
a.send({ t: 'hello', name: 'Misafir' });
assert.equal(a.last('welcome').member, null);
// Kayıt: kod iste, doğrula
a.send({ t: 'register', name: 'Özer', surname: 'Kral', phone: '0532 123 45 67', email: 'ozer@site.com', consent: true });
await wait();
const otp = a.last('otp'); assert.ok(otp.ok && /^\d{6}$/.test(otp.test));
a.send({ t: 'verify', phone: '0532 123 45 67', code: '000000' === otp.test ? '111111' : '000000' }); assert.ok(a.last('otp_error'));
a.send({ t: 'verify', phone: '0532 123 45 67', code: otp.test });
const mem = a.last('member'); assert.ok(mem.token && mem.member.name === 'Özer');
a.send({ t: 'rename', name: 'Başkası' });                       // üyenin adı değişmez
// Yeni cihaz: oturum belirteciyle üye olarak girer
const b = client();
b.send({ t: 'hello', name: 'x', mtoken: mem.token });
assert.equal(b.last('welcome').member.surname, 'Kral'); assert.equal(b.last('welcome').name, 'Özer');
// Geçersiz belirteç misafir kalır; çıkış oturumu kapatır
const c = client(); c.send({ t: 'hello', name: 'Ali', mtoken: 'yanlis' }); assert.equal(c.last('welcome').member, null);
b.send({ t: 'logout', mtoken: mem.token }); assert.equal(b.last('member').member, null);
const d = client(); d.send({ t: 'hello', name: 'x', mtoken: mem.token }); assert.equal(d.last('welcome').member, null);
// Kayıtlı telefonla tekrar kayıt olunamaz
a.send({ t: 'register', name: 'Özer', surname: 'Kral', phone: '0532 123 45 67', email: 'baska@site.com', consent: true }); await wait();
assert.match(a.last('otp').error, /zaten kayıtlı/);
console.log('Üyelik (hub: kayıt, doğrulama, oturum, çıkış) testleri geçti');
