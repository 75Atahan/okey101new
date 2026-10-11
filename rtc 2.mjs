// LiveKit katılım token'ı üretir (HS256 JWT, SDK gerekmez).
// Ortam değişkenleri: LIVEKIT_URL (wss://...), LIVEKIT_API_KEY, LIVEKIT_API_SECRET
import { createHmac } from 'node:crypto';

const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');

export function createRtc({ url, apiKey, apiSecret, ttlSeconds = 6 * 3600, now = Date.now } = {}) {
  if (!url || !apiKey || !apiSecret) return null; // yapılandırılmamış
  return {
    url,
    token(identity, name, room) {
      const t = Math.floor(now() / 1000);
      const head = b64({ alg: 'HS256', typ: 'JWT' });
      const body = b64({
        iss: apiKey, sub: identity, name, nbf: t, exp: t + ttlSeconds,
        video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
      });
      const sig = createHmac('sha256', apiSecret).update(`${head}.${body}`).digest('base64url');
      return `${head}.${body}.${sig}`;
    },
  };
}
