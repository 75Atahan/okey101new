// WebSocket kaynak (Origin) kontrolü: başka sitede barındırılan kopya bir arayüz bizim sunucumuzu kullanamasın.
// Tarayıcı Origin başlığını kendisi gönderir ve siteler değiştiremez.
export function originOk(origin, host, allowed = []) {
  if (!origin) return allowed.length === 0;           // Origin yok: tarayıcı dışı istemci (liste tanımlıysa reddedilir)
  if (allowed.includes(origin)) return true;
  try { return new URL(origin).host === host; } catch { return false; }   // aynı adresten gelen sayfa serbest
}
