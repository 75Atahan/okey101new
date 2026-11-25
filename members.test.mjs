import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMembers, normalizePhone, validEmail } from './members.mjs';

// Telefon ve e-posta doğrulama
for (const ok of ['0532 123 45 67', '+90 532 123 45 67', '905321234567', '5321234567', '(0532) 123-4567']) assert.equal(normalizePhone(ok), '+905321234567', ok);
for (const bad of ['', '123', '02121234567', '0432 123 45 67', '05321234', null]) assert.equal(normalizePhone(bad), null, String(bad));
assert.ok(validEmail('ad@site.com') && !validEmail('ad@site') && !validEmail('ad site@x.com'));

let t = 1000000;
const file = path.join(os.tmpdir(), `luna-members-${process.pid}.json`); fs.rmSync(file, { force: true });
const sent = [];
const sender = { send: async (p, text) => sent.push([p, text]) };
const form = { kind: 'register', name: 'Özer', surname: 'Kral', phone: '0532 123 45 67', email: 'Ozer@Site.com', consent: true, ip: '1.1.1.1' };

// Servis yoksa ve test modu kapalıysa kayıt kapalı
let m = createMembers({ now: () => t });
assert.match((await m.begin(form)).error, /servisi/);

// Sağlayıcı yok + test modu: kod yanıtta döner
m = createMembers({ now: () => t, testMode: true });
let r = await m.begin(form); assert.ok(r.ok && /^\d{6}$/.test(r.test));
assert.equal(r.phone, '+90 5** *** ** 67', 'telefon maskelenmeli');
assert.equal((await m.begin({ ...form, name: '1' })).ok, false);
assert.match((await m.begin({ ...form, consent: false })).error, /aydınlatma/);
assert.match((await m.begin({ ...form, email: 'x' })).error, /e-posta/);

// Gerçek gönderim: kod SMS ile gider, yanıtta görünmez
m = createMembers({ now: () => t, file, sender });
r = await m.begin(form); assert.ok(r.ok && r.test === undefined);
const code = sent.at(-1)[1].match(/\d{6}/)[0]; assert.equal(sent.at(-1)[0], '+905321234567');
// Yanlış kod, sonra doğru kod
let v = m.verify({ phone: form.phone, code: code === '000000' ? '111111' : '000000' }); assert.equal(v.ok, false); assert.match(v.error, /4 hakkın/);
v = m.verify({ phone: '0532 123 45 67', code }); assert.ok(v.ok && v.token && v.member.name === 'Özer');
assert.equal(m.byToken(v.token).surname, 'Kral'); assert.equal(m.byToken('yanlis'), null);
assert.equal(m.verify({ phone: form.phone, code }).ok, false);            // kod tek kullanımlık
// Aynı telefon / e-posta ikinci kez kayıt olamaz
assert.match((await m.begin(form)).error, /zaten kayıtlı/);
assert.match((await m.begin({ ...form, phone: '0555 111 22 33' })).error, /e-posta/);
// Yeniden başlatma: üye ve oturum dosyadan gelir
const m2 = createMembers({ now: () => t, file, sender });
assert.equal(m2.count(), 1); assert.equal(m2.byToken(v.token).name, 'Özer');
// Giriş: kayıtlı telefona kod
assert.match((await m2.begin({ kind: 'login', phone: '0555 111 22 33' })).error, /kayıtlı üye yok/);
r = await m2.begin({ kind: 'login', phone: form.phone, ip: '2.2.2.2' }); assert.ok(r.ok);
v = m2.verify({ phone: form.phone, code: sent.at(-1)[1].match(/\d{6}/)[0] }); assert.ok(v.ok && v.member.email === 'ozer@site.com');
m2.logout(v.token); assert.equal(m2.byToken(v.token), null);
// 5 yanlış denemede kilitlenir, süre dolunca kod geçersiz
await m2.begin({ kind: 'login', phone: form.phone, ip: '3.3.3.3' });
for (let i = 0; i < 5; i++) m2.verify({ phone: form.phone, code: '999999' });
assert.match(m2.verify({ phone: form.phone, code: '999999' }).error, /Önce kod iste|Çok fazla/);
const m3 = createMembers({ now: () => t, sender });
await m3.begin({ ...form, ip: '4.4.4.4' }); t += 6 * 60 * 1000;
assert.match(m3.verify({ phone: form.phone, code: '123456' }).error, /süresi doldu/);
// Telefon başına saatte 3 kod
const m4 = createMembers({ now: () => t, sender });
for (let i = 0; i < 3; i++) assert.ok((await m4.begin({ ...form, ip: 'ip' + i })).ok);
assert.match((await m4.begin({ ...form, ip: 'ipx' })).error, /Çok fazla kod/);
t += 61 * 60 * 1000; assert.ok((await m4.begin({ ...form, ip: 'ipy' })).ok);
// SMS gönderilemezse kod kaydı kalmaz
const bad = createMembers({ now: () => t, sender: { send: async () => { throw new Error('x'); } } });
assert.match((await bad.begin(form)).error, /SMS gönderilemedi/);
fs.rmSync(file, { force: true });
console.log('Üyelik (kayıt, SMS kodu, giriş, sınırlar) testleri geçti');
