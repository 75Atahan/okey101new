// WebSocket sunucusu. Çalıştır: npm install && npm start
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { createHub } from './hub.mjs';
import { createRtc } from './rtc.mjs';
import { createRoomManager } from './rooms.mjs';
import { createWallet } from './wallet.mjs';

const PORT = process.env.PORT || 3000;
// Üretimde izin verilen siteler: ALLOWED_ORIGINS="https://siteniz.com,https://www.siteniz.com"
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const rtc = createRtc({
  url: process.env.LIVEKIT_URL,
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET,
});
if (!rtc) console.log('LiveKit ayarlanmadı: dahili (eşler arası) görüntülü sohbet kullanılacak.');
// Bazı ağlarda doğrudan bağlantı kurulamaz; istenirse TURN sunucusu eklenebilir (TURN_URL, TURN_USER, TURN_PASS).
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
if (process.env.TURN_URL) iceServers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USER, credential: process.env.TURN_PASS });
const hub = createHub({ rooms: createRoomManager({ wallet: process.env.JETONLU === '1' ? createWallet() : null }), rtc, iceServers });
// Arayüz dosyaları (istemci okey101.mjs'yi önizleme doğrulaması için kullanır)
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/okey101.mjs': ['okey101.mjs', 'text/javascript; charset=utf-8'],
  '/assist.mjs': ['assist.mjs', 'text/javascript; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/icon-192.png': ['icon-192.png', 'image/png'],
  '/icon-512.png': ['icon-512.png', 'image/png'],
};
const server = http.createServer(async (req, res) => {
  const f = FILES[req.url.split('?')[0]];
  if (!f) { res.writeHead(404); return res.end('Bulunamadı'); }
  try {
    const body = await readFile(new URL(f[0], import.meta.url));
    res.writeHead(200, { 'content-type': f[1] });
    res.end(body);
  } catch { res.writeHead(500); res.end('Dosya okunamadı'); }
});
const wss = new WebSocketServer({ server, maxPayload: 20000 });

wss.on('connection', (ws, req) => {
  if (ALLOWED.length && !ALLOWED.includes(req.headers.origin)) return ws.close(1008, 'origin');
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  const conn = hub.connect((data) => ws.readyState === ws.OPEN && ws.send(data));
  ws.on('message', (d) => conn.message(d.toString()));
  ws.on('close', conn.close);
  ws.on('error', () => ws.terminate());
});

// Ölü bağlantıları temizle
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000).unref();

setInterval(hub.tick, 500).unref(); // sıra süresi kontrolü

server.listen(PORT, () => console.log(`Dinleniyor: ${PORT}`));
