// Oyuncu sayaçları: o an çevrimiçi/oynayan sayısı hub'dan gelir; burada günlük toplamlar tutulur.
// Gün Türkiye saatine göre (UTC+3) değişir. STATS_FILE verilirse sunucu yeniden başlayınca kaldığı yerden devam eder.
import fs from 'node:fs';

const TR_OFFSET = 3 * 3600 * 1000;
export const dayKey = (t) => new Date(t + TR_OFFSET).toISOString().slice(0, 10);

export function createStats({ now = Date.now, file = null } = {}) {
  let day = dayKey(now()), players = new Set(), games = 0, peak = 0, dirty = false;
  if (file) {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (d.day === day) { players = new Set(d.players); games = d.games | 0; peak = d.peak | 0; }
    } catch { /* dosya yok ya da bozuk: sıfırdan başla */ }
  }
  const roll = () => {
    const k = dayKey(now());
    if (k !== day) { day = k; players = new Set(); games = 0; peak = 0; dirty = true; }
  };
  return {
    seen(id) { roll(); if (!players.has(id)) { players.add(id); dirty = true; } },       // bugün giren farklı oyuncu
    gameStarted() { roll(); games++; dirty = true; },                                    // bugün başlayan oyun (el)
    sample(online) { roll(); if (online > peak) { peak = online; dirty = true; } },      // bugünkü en yüksek eşzamanlı oyuncu
    snapshot(live = {}) { roll(); return { ...live, today: { day, players: players.size, games, peak } }; },
    save() {
      if (!file || !dirty) return;
      dirty = false;
      try { fs.writeFileSync(file, JSON.stringify({ day, players: [...players], games, peak })); } catch { /* disk yazılamadı: sonraki sefere */ }
    },
  };
}
