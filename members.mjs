// Üyelik: kayıt (ad, soyad, telefon, e-posta) ve telefona gelen 6 haneli kodla doğrulama.
// Kodlar düz yazı olarak saklanmaz, süresi 5 dakikadır, 5 yanlış denemede kilitlenir, telefon ve IP başına saatlik sınır vardır.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const H = (s) => createHash('sha256').update(String(s)).digest('hex');
const CODE_TTL_MS = 5 * 60 * 1000, MAX_TRIES = 5, PHONE_PER_HOUR = 3, IP_PER_HOUR = 10, HOUR = 3600 * 1000;

// Türkiye cep telefonu: 0532 123 45 67 / +90 532 ... / 532... -> +905321234567
export function normalizePhone(raw) {
  const d = String(raw ?? '').replace(/[^\d+]/g, '');
  const x = d.replace(/^\+?90/, '').replace(/^0/, '');
  return /^5\d{9}$/.test(x) ? '+90' + x : null;
}
export const validEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(e);
const validName = (n) => typeof n === 'string' && /^\p{L}[\p{L} .'-]{1,29}$/u.test(n.trim());
const maskPhone = (p) => '+90 5** *** ** ' + p.slice(-2);
const pub = (m) => ({ id: m.id, name: m.name, surname: m.surname, phone: maskPhone(m.phone), email: m.email });

// Netgsm HTTP API ile SMS (NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER ortam değişkenleri)
export function createSender(env = process.env) {
  const { NETGSM_USERCODE: usercode, NETGSM_PASSWORD: password, NETGSM_HEADER: msgheader } = env;
  if (!usercode || !password || !msgheader) return null;
  return {
    async send(phone, message) {
      const q = new URLSearchParams({ usercode, password, gsmno: phone.replace(/^\+90/, ''), message, msgheader, dil: 'TR' });
      const res = await fetch('https://api.netgsm.com.tr/sms/send/get/?' + q, { signal: AbortSignal.timeout(10000) });
      const text = (await res.text()).trim();
      if (!/^0[012]\b/.test(text)) throw new Error('SMS gönderilemedi: ' + text.slice(0, 40));
    },
  };
}

export function createMembers({ now = Date.now, file = null, sender = null, testMode = false } = {}) {
  let db = { members: {}, byPhone: {}, byEmail: {}, sessions: {} };
  if (file) { try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* dosya yok: sıfırdan */ } }
  const save = () => {
    if (!file) return;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); } catch { /* disk yazılamadı */ }
  };
  const pending = new Map(), hits = new Map();
  const limited = (key, max) => {
    const t = now(), arr = (hits.get(key) ?? []).filter((x) => t - x < HOUR);
    hits.set(key, arr);
    if (arr.length >= max) return true;
    arr.push(t); return false;
  };

  async function begin({ kind, name, surname, phone, email, consent, ip = 'x' }) {
    const ph = normalizePhone(phone);
    if (!ph) return { ok: false, error: 'Geçerli bir cep telefonu yaz (örn. 0532 123 45 67).' };
    let data = {};
    if (kind === 'register') {
      if (!validName(name) || !validName(surname)) return { ok: false, error: 'Ad ve soyadı harflerle yaz (2-30 karakter).' };
      const em = String(email ?? '').trim().toLowerCase();
      if (!validEmail(em)) return { ok: false, error: 'Geçerli bir e-posta adresi yaz.' };
      if (!consent) return { ok: false, error: 'Devam etmek için aydınlatma metnini onaylamalısın.' };
      if (db.byPhone[ph]) return { ok: false, error: 'Bu telefon numarası zaten kayıtlı. "Giriş" sekmesinden devam et.' };
      if (db.byEmail[em]) return { ok: false, error: 'Bu e-posta adresiyle zaten bir üyelik var.' };
      data = { name: name.trim(), surname: surname.trim(), email: em };
    } else if (!db.byPhone[ph]) return { ok: false, error: 'Bu telefonla kayıtlı üye yok. Önce "Yeni kayıt" yap.' };
    if (!sender && !testMode) return { ok: false, error: 'Doğrulama servisi henüz bağlı değil. Lütfen daha sonra tekrar dene.' };
    if (limited('p:' + ph, PHONE_PER_HOUR) || limited('i:' + ip, IP_PER_HOUR)) return { ok: false, error: 'Çok fazla kod istedin. Bir saat sonra tekrar dene.' };
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    pending.set(ph, { kind, data, h: H(ph + ':' + code), exp: now() + CODE_TTL_MS, tries: 0 });
    if (sender) {
      try { await sender.send(ph, `Luna101 doğrulama kodunuz: ${code}`); }
      catch { pending.delete(ph); return { ok: false, error: 'SMS gönderilemedi. Birkaç dakika sonra tekrar dene.' }; }
    }
    return { ok: true, phone: maskPhone(ph), expiresIn: CODE_TTL_MS / 1000, ...(testMode && !sender ? { test: code } : {}) };
  }

  function verify({ phone, code }) {
    const ph = normalizePhone(phone), p = ph && pending.get(ph);
    if (!p) return { ok: false, error: 'Önce kod iste.' };
    if (now() > p.exp) { pending.delete(ph); return { ok: false, error: 'Kodun süresi doldu. Yeni kod iste.' }; }
    if (p.tries >= MAX_TRIES) { pending.delete(ph); return { ok: false, error: 'Çok fazla yanlış deneme. Yeni kod iste.' }; }
    p.tries++;
    const given = Buffer.from(H(ph + ':' + String(code ?? '').trim())), real = Buffer.from(p.h);
    if (!timingSafeEqual(given, real)) return { ok: false, error: `Kod yanlış (${MAX_TRIES - p.tries} hakkın kaldı).` };
    pending.delete(ph);
    let m = db.members[db.byPhone[ph]];
    if (p.kind === 'register') {
      const id = randomBytes(8).toString('hex');
      m = { id, ...p.data, phone: ph, createdAt: now() };
      db.members[id] = m; db.byPhone[ph] = id; db.byEmail[p.data.email] = id;
    }
    const token = randomBytes(32).toString('hex');
    db.sessions[H(token)] = m.id;
    save();
    return { ok: true, member: pub(m), token };
  }

  const byToken = (token) => { const id = typeof token === 'string' && db.sessions[H(token)]; return id && db.members[id] ? pub(db.members[id]) : null; };
  const logout = (token) => { if (typeof token === 'string' && db.sessions[H(token)]) { delete db.sessions[H(token)]; save(); } };
  const mode = () => (sender ? 'sms' : testMode ? 'test' : 'off');   // 'off': doğrulama servisi bağlı değil, kayıt kapalı
  return { begin, verify, byToken, logout, mode, count: () => Object.keys(db.members).length };
}
