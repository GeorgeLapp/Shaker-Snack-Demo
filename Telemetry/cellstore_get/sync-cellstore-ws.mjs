// file: sync-cellstore-ws.mjs
// npm i ws sqlite3
import { setTimeout as delay } from 'timers/promises';
import WebSocket from 'ws';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { applyMatrixFromTelemetry } from '../shaker-db.mjs';

// ====== Конфигурация ======
const DB_PATH        = process.argv[2] || 'c:/Users/user/Desktop/Shaker-Snack-Demo/Telemetry/goods.db';

// OAuth2 client_credentials
const AUTH_URL       = process.env.TELEMETRY_AUTH_URL || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const CLIENT_ID      = process.env.CLIENT_ID      || 'snack_02';
const CLIENT_SECRET  = process.env.CLIENT_SECRET  || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';

// WebSocket
const WS_URL         = process.env.TELEMETRY_WS_URL || 'ws://185.46.8.39:8315/ws';
const MACHINE_SERIAL = process.env.MACHINE_SERIAL   || CLIENT_ID;

// Поведение
const RECONNECT_BASE_MS = 1500;  // начальная задержка перед реконнектом
const RECONNECT_MAX_MS  = 15000; // максимум бэкоффа
const HEARTBEAT_MS      = 30000; // ping/pong интервал

// ====== Получение токена ======
async function fetchAccessToken() {
  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');
  params.set('client_id', CLIENT_ID);
  params.set('client_secret', CLIENT_SECRET);

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Auth failed: ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in response');

  const now = Date.now();
  const expiresAt = now + Math.max(5, (data.expires_in || 3600) - 30) * 1000; // чутка заранее
  return { token: data.access_token, expiresAt };
}

// ====== Подключение WS с авто-обновлением токена и реконнектом ======
async function start() {
  let backoff = RECONNECT_BASE_MS;
  let tokenInfo = null;

  while (true) {
    try {
      if (!tokenInfo || Date.now() > tokenInfo.expiresAt) {
        console.log('Getting OAuth token…');
        tokenInfo = await fetchAccessToken();
        console.log('Token acquired, exp:', new Date(tokenInfo.expiresAt).toISOString());
      }

      await connectOnce(tokenInfo.token);
      // Если connectOnce завершился «штатно» (например, по Ctrl+C) — выходим.
      return;
    } catch (err) {
      console.error('WS loop error:', err?.message || err);
      const wait = Math.min(backoff, RECONNECT_MAX_MS);
      console.log(`Reconnect in ${wait} ms…`);
      await delay(wait);
      backoff = Math.min(RECONNECT_MAX_MS, Math.round(backoff * 1.8));
    }
  }
}

async function connectOnce(bearerToken) {
  console.log('Connecting WS…', WS_URL);

  // Заголовок авторизации при апгрейде
  const ws = new WebSocket(WS_URL, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  let hbTimer = null;
  let isOpen = false;

  const setupHeartbeat = () => {
    clearInterval(hbTimer);
    hbTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, HEARTBEAT_MS);
  };

  const sendMachineInfo = () => {
    // Некоторые реализации ожидают от машины machineInfo сразу после коннекта
    const msg = {
      type: 'machineInfo',
      clientId: MACHINE_SERIAL,
      body: { ts: Date.now() }
    };
    safeSend(ws, msg);
  };

  ws.on('open', () => {
    isOpen = true;
    console.log('WS connected.');
    setupHeartbeat();
    sendMachineInfo();
  });

  ws.on('pong', () => {
    // можно логировать/обновлять lastActivity
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn('WS: non-JSON message, ignoring');
      return;
    }

    // Ожидаем формат телеметрии изменения матрицы:
    // { type: "cellStoreExportSnack", body: [ {cellNumber, price, goodId, size, volume, maxVolume}, ... ] }
    if (msg?.type === 'cellStoreExportSnack' && Array.isArray(msg?.body)) {
      console.log(`WS: received matrix update: ${msg.body.length} items`);

      try {
        const res = await applyMatrixFromTelemetry(DB_PATH, msg.body, {
          sourceHash: msg.sourceHash || null,
          syncTs: Date.now(),
        });
        console.log(`DB updated: inserted=${res.inserted}, updated=${res.updated}`);

        // Отправим положительный ack (если телеметрия его понимает)
        safeSend(ws, {
          type: 'cellStoreExportSnackResult',
          success: true,
          message: '',
          body: null,
        });
      } catch (e) {
        console.error('Failed to apply matrix:', e?.message || e);
        safeSend(ws, {
          type: 'cellStoreExportSnackResult',
          success: false,
          message: String(e?.message || e),
          body: null,
        });
      }
      return;
    }

    // Другие служебные типы сообщений можно обрабатывать здесь
    console.log('WS message:', msg?.type ?? '<unknown>');
  });

  ws.on('close', (code, reasonBuf) => {
    clearInterval(hbTimer);
    const reason = reasonBuf?.toString?.() || '';
    console.warn(`WS closed: code=${code} reason=${reason}`);
    // Бросаем исключение, чтобы внешний цикл сделал реконнект
    if (isOpen) throw new Error(`WS closed: ${code} ${reason}`);
  });

  ws.on('error', (err) => {
    clearInterval(hbTimer);
    console.error('WS error:', err?.message || err);
    // Бросаем исключение — пойдём в реконнект
    throw err;
  });

  // Ожидание SIGINT/SIGTERM (аккуратный выход)
  const onSig = () => {
    try { ws.close(1000, 'client closing'); } catch {}
    clearInterval(hbTimer);
    process.exit(0);
  };
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);

  // Держим процесс «живым»
  await new Promise((_resolve) => {});
}

function safeSend(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch (e) {
    console.warn('safeSend error:', e?.message || e);
  }
}

// ====== Запуск ======
console.log(`DB file: ${DB_PATH}`);
start().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
