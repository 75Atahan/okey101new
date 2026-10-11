// Sanal jeton cüzdanı: her gün (Türkiye saati) 10.000 jetonla başlanır, gün sonunda sıfırlanır.
// Jetonun para değeri yoktur: satın alınamaz, çekilemez, oyuncular arası devredilemez.
// Not: şimdilik bellekte tutulur (sunucu yeniden başlarsa sıfırlanır). Kalıcılık için veritabanı gerekir.
export const DAILY_TOKENS = 10000;
export const GAME_STAKE = 2500; // oyun (el) başı masa bedeli; katlamalıda 2 katı

export function createWallet({ now = Date.now, daily = DAILY_TOKENS, tz = 'Europe/Istanbul' } = {}) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const accounts = new Map();
  const rec = (id) => {
    const day = fmt.format(now());
    let r = accounts.get(id);
    if (!r || r.day !== day) { r = { day, balance: daily }; accounts.set(id, r); }
    return r;
  };
  return {
    balance: (id) => rec(id).balance,
    // Hepsinden çekilir ya da hiçbirinden (yetersiz bakiyede false).
    charge(ids, amount) {
      if (!ids.every((id) => rec(id).balance >= amount)) return false;
      ids.forEach((id) => (rec(id).balance -= amount));
      return true;
    },
    pay(id, amount) { rec(id).balance += amount; },
  };
}
