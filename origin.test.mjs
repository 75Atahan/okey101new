import assert from 'node:assert/strict';
import { originOk } from './origin.mjs';

assert.ok(originOk('https://luna101.com.tr', 'luna101.com.tr'));                 // kendi sitemiz
assert.ok(originOk('http://localhost:3000', 'localhost:3000'));                  // yerel deneme
assert.ok(!originOk('https://kopya-site.com', 'luna101.com.tr'));                // başka site: reddedilir
assert.ok(!originOk('https://luna101.com.tr.kotu.com', 'luna101.com.tr'));       // benzer görünen adres: reddedilir
assert.ok(!originOk('not a url', 'luna101.com.tr'));
assert.ok(originOk(undefined, 'luna101.com.tr'));                                // tarayıcı dışı: liste yoksa serbest
assert.ok(!originOk(undefined, 'luna101.com.tr', ['https://luna101.com.tr']));   // liste varsa Origin şart
assert.ok(originOk('https://www.luna101.com.tr', 'x', ['https://www.luna101.com.tr']));
console.log('Origin (kopya arayüz koruması) testleri geçti');
