// file: shaker-catalog.js
import WebSocket from 'ws';

// === Ваши реквизиты автомата ===
const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';

// === Endpoints ===
const TOKEN_URL = 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL = 'ws://185.46.8.39:8315/ws';

// === Параметры запроса каталога ===
const MACHINE_ID = Number(process.env.SHAKER_MACHINE_ID || 12);
const ORG_ID = Number(process.env.SHAKER_ORG_ID || 54);

// ---------- УТИЛИТЫ ВЫВОДА КАТАЛОГА ----------
function trunc(s, n) {
  const str = String(s ?? '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function printCatalog(items) {
  // Колонки: id | taste | brand | price | 18+ | img
  const rows = items.map(x => ({
    id: String(x.id ?? ''),
    taste: String(x.taste ?? ''),
    brand: x.goodBrand?.name ?? '',
    price: (x.price ?? '') === '' ? '' : String(x.price),
    adult: x.isAdult ? 'yes' : 'no',
    img: x.imgPath ?? '',
  }));

  // ширины колонок
  const W = {
    id: Math.max(2, ...rows.map(r => r.id.length)),
    taste: Math.max(5, ...rows.map(r => r.taste.length), 20),
    brand: Math.max(5, ...rows.map(r => r.brand.length)),
    price: Math.max(5, ...rows.map(r => r.price.length), 5),
    adult: 3,
    img: Math.max(8, ...rows.map(r => r.img.length), 20),
  };

  // ограничим, чтобы консоль не «поплыла»
  W.taste = Math.min(W.taste, 32);
  W.brand = Math.min(W.brand, 20);
  W.img = Math.min(W.img, 60);

  const sep = `+${'-'.repeat(W.id+2)}+${'-'.repeat(W.taste+2)}+${'-'.repeat(W.brand+2)}+${'-'.repeat(W.price+2)}+${'-'.repeat(W.adult+2)}+${'-'.repeat(W.img+2)}+`;
  const header =
    `| ${'id'.padEnd(W.id)} ` +
    `| ${'taste'.padEnd(W.taste)} ` +
    `| ${'brand'.padEnd(W.brand)} ` +
    `| ${'price'.padEnd(W.price)} ` +
    `| ${'18+'.padEnd(W.adult)} ` +
    `| ${'img'.padEnd(W.img)} |`;

  console.log('\n[CATALOG] Products:');
  console.log(sep);
  console.log(header);
  console.log(sep);

  for (const r of rows) {
    const line =
      `| ${r.id.padEnd(W.id)} ` +
      `| ${trunc(r.taste, W.taste).padEnd(W.taste)} ` +
      `| ${trunc(r.brand, W.brand).padEnd(W.brand)} ` +
      `| ${r.price.padEnd(W.price)} ` +
      `| ${r.adult.padEnd(W.adult)} ` +
      `| ${trunc(r.img, W.img).padEnd(W.img)} |`;
    console.log(line);
  }
  console.log(sep);
}

// -------- Токен-менеджер --------
class TokenCache {
  #token = null;
  #expAt = 0;
  async get() {
    const now = Date.now();
    if (this.#token && now < this.#expAt - 30_000) return this.#token;
    const { access_token, expires_in } = await fetchToken();
    this.#token = access_token;
    this.#expAt = now + (Number(expires_in ?? 60) * 1000);
    return this.#token;
  }
  invalidate() { this.#token = null; this.#expAt = 0; }
}

async function fetchToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'profile',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token error ${res.status}: ${text}`);
  }
  return res.json();
}

// -------- Логика соединения и обмена --------
const tokenCache = new TokenCache();
let ws = null;
let reconnectTimer = null;
let reconnectDelayMs = 1000;

function scheduleReconnect(why = '') {
  if (reconnectTimer) return;
  const delay = Math.min(reconnectDelayMs, 30_000);
  console.warn(`[WS] Reconnect in ${delay} ms… ${why ? `(${why})` : ''}`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
    connect().catch(err => {
      console.error('[WS] Reconnect failed:', err.message);
      scheduleReconnect('connect failed');
    });
  }, delay);
}

async function connect() {
  const token = await tokenCache.get();
  console.log('[WS] Connecting…');

  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${token}` } });

    ws.on('open', () => {
      console.log('[WS] Connected');
      reconnectDelayMs = 1000;

      // === Запрос каталога ===
      const msg = {
        clientId: CLIENT_ID,
        type: 'baseProductRequestExportTopic',
        body: { machineId: MACHINE_ID, organizationId: ORG_ID },
      };
      ws.send(JSON.stringify(msg));
      console.log('[WS] → baseProductRequestExportTopic request sent');
      resolve();
    });

    let gotAck = false;
    let gotData = false;

    ws.on('message', (data) => {
      const text = data.toString();
      let json;
      try { json = JSON.parse(text); } catch {
        console.warn('[WS] ← non-JSON message:', text);
        return;
      }

      if (json?.type !== 'baseProductRequestExportTopic') {
        console.log('[WS] ← other message:', json);
        return;
      }

      // 1) ACK
      if (json.success === true && json.body == null) {
        gotAck = true;
        console.log('[WS] ← ACK: baseProductRequestExportTopic success');
        return;
      }

      // 2) DATA
      if (Array.isArray(json.body)) {
        gotData = true;
        const items = json.body;

        // Базовая валидация
        const valid = items.every(x =>
          typeof x.id === 'number' &&
          typeof x.taste === 'string' &&
          typeof x.imgPath === 'string' &&
          typeof x.isAdult === 'boolean' &&
          x.goodBrand && typeof x.goodBrand.id === 'number' && typeof x.goodBrand.name === 'string'
        );

        if (!valid) {
          console.error('[CATALOG] Invalid item shape detected');
        } else {
          console.log(`[CATALOG] Received ${items.length} items`);
          // === НОВОЕ: человекочитаемый вывод каталога в консоль ===
          printCatalog(items);
        }

        if (gotAck && gotData) {
          console.log('[WS] Catalog fetch complete (ACK + DATA).');
          // ws.close(1000, 'done'); // если нужен одноразовый запрос
        }
        return;
      }

      console.log('[WS] ← baseProductRequestExportTopic (unrecognized shape):', json);
    });

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString() || '';
      console.warn(`[WS] Closed: code=${code} reason=${reason}`);
      if (code === 1008 || /token|auth|401|403/i.test(reason)) tokenCache.invalidate();
      scheduleReconnect(`close ${code}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      if (/401|403|token|auth/i.test(err.message)) tokenCache.invalidate();
      scheduleReconnect('error');
      reject(err);
    });
  });
}

// ---- Запуск ----
connect().catch(err => {
  console.error('[BOOT] Initial connect failed:', err.message);
  scheduleReconnect('initial failure');
});

process.on('SIGINT', () => {
  console.log('Shutting down…');
  try { ws?.close(1000, 'client shutdown'); } catch {}
  process.exit(0);
});
