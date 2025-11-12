// file: sync-payments.mjs
// Запуск: node sync-payments.mjs [dbPath]
// npm i ws
import WebSocket from 'ws';
import { getPendingSalesPayload, markSent, recordPayment } from './telemetry-payments.mjs';

// ---- Конфигурация из env ----
const CLIENT_ID  = process.env.SHAKER_CLIENT_ID  || 'snack_02'; // == serialNumber
const CLIENT_SEC = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const TOKEN_URL  = process.env.SHAKER_TOKEN_URL ||
  'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL     = process.env.SHAKER_WS_URL || 'ws://185.46.8.39:8315/ws';

const MACHINE_ID = Number(process.env.SHAKER_MACHINE_ID || 12);
const ORG_ID     = Number(process.env.SHAKER_ORG_ID || 54);
const MODEL_ID   = process.env.SHAKER_MACHINE_MODEL_ID ? Number(process.env.SHAKER_MACHINE_MODEL_ID) : 1;
const TZ_HOURS   = process.env.SHAKER_TZ_HOURS ? Number(process.env.SHAKER_TZ_HOURS) : 3;

// ---- CLI ----
const dbPath = process.argv[2] || 'goods.db';

// ---- OAuth2 CC ----
async function fetchToken() {
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SEC,
    scope: 'profile'
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token request failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json?.access_token) throw new Error('No access_token in token response');
  return json.access_token;
}

// ---- Отправка одной посылки по WS и ожидание ack ----
async function sendOverWs(oauthToken, message) {
  const ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${oauthToken}` } });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  const ack = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No ACK for saleImportTopicSnack')), 10_000);
    const onMessage = (data) => {
      try {
        const json = JSON.parse(data.toString());
        if (json?.type === 'saleImportTopicSnack') {
          clearTimeout(timer);
          ws.off('message', onMessage);
          if (json.success === false) reject(new Error(json.message || 'saleImportTopicSnack failed'));
          else resolve(json);
        }
      } catch { /* ignore non-JSON*/ }
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify(message), (err) => {
      if (err) { clearTimeout(timer); ws.off('message', onMessage); reject(err); }
    });
  });

  try { ws.close(1000, 'done'); } catch {}
  return ack;
}

// ---- MAIN ----
async function main() {
  console.log(`DB file: ${dbPath}`);

  await recordPayment(dbPath, {
  cellNumber: 2,
  qty: 1,
  goodId: 22,
  price: 150.0,
  method: 'cash'
});

  // 1) Собираем payload (БД-логика полностью внутри модуля)
  const { message, uuids } = await getPendingSalesPayload(dbPath, {
    serialNumber: CLIENT_ID,
    machineId: MACHINE_ID,
    orgId: ORG_ID,
    machineModelId: MODEL_ID,
    timezoneOffsetHours: TZ_HOURS
  });

  if (!message) {
    console.log('Нет незавершённых транзакций. Выход.');
    return;
  }

  // 2) Авторизуемся и отправляем
  console.log('Getting OAuth token…');
  const token = await fetchToken();

  console.log(`Sending ${uuids.length} sale(s) over WebSocket…`);
  console.log(JSON.stringify(message));
  const ack = await sendOverWs(token, message);
  console.log('Ack:', JSON.stringify(ack));

  // 3) Помечаем в БД как отправленные (note = "sent <ISO>")
  const res = await markSent(dbPath, uuids);
  console.log(`Updated ${res.updated} row(s), note="${res.note}"`);
}

main().catch((err) => {
  console.error('✖ Sync failed:', err?.message || err);
  process.exit(1);
});
