// file: sync-payments.mjs
// Запуск: node sync-payments.mjs [dbPath]
// Требует рядом файл telemetry-payments.mjs
// Зависимости: "ws", "sqlite3" (для самого telemetry-payments.mjs)

import { recordPayment, syncWithTelemetry } from './telemetry-payments.mjs';

// ---- Конфигурация из переменных окружения ----
// Обязательно задайте следующие переменные (или отредактируйте значения по умолчанию ниже):
const CLIENT_ID  = process.env.SHAKER_CLIENT_ID  || 'snack_02';
const CLIENT_SEC = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const TOKEN_URL  = process.env.SHAKER_TOKEN_URL ||
  'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL     = process.env.SHAKER_WS_URL || 'ws://185.46.8.39:8315/ws';

const MACHINE_ID = Number(process.env.SHAKER_MACHINE_ID || 12);   // обязательное число
const ORG_ID     = Number(process.env.SHAKER_ORG_ID || 54);       // обязательное число
const MODEL_ID   = process.env.SHAKER_MACHINE_MODEL_ID
  ? Number(process.env.SHAKER_MACHINE_MODEL_ID)
  : 1; // опционально
const TZ_HOURS   = process.env.SHAKER_TZ_HOURS
  ? Number(process.env.SHAKER_TZ_HOURS)
  : 3;

// ---- CLI: путь к БД ----
const dbPath = process.argv[2] || 'goods.db';

// ---- Функция получения OAuth2 токена по Client Credentials ----
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
  if (!json?.access_token) {
    throw new Error('No access_token in token response');
  }
  return json.access_token;
}

// ---- Основной поток ----
async function main() {
   const res = await recordPayment(dbPath, {
      cellNumber: 5,   // номер ячейки автомата
      qty: 1,          // количество (по умолчанию 1)
      goodId: 101,     // id товара из каталога (можно null)
      price: 150.5,    // цена в рублях (тип REAL в БД)
      method: 'cash'   // способ оплаты: 'cash' | 'card' | 'qr'
    });
  console.log(`DB file: ${dbPath}`);
  console.log('Getting OAuth token…');
  const token = await fetchToken();

  console.log('Syncing pending transactions over WebSocket…');
    
  const result = await syncWithTelemetry(dbPath, {
    oauthToken: token,
    wsUrl: WS_URL,
    serialNumber: CLIENT_ID,   // в нашей интеграции client_id == serialNumber
    machineId: MACHINE_ID,
    orgId: ORG_ID,
    machineModelId: MODEL_ID,
    timezoneOffsetHours: TZ_HOURS
  });

  // result.sent — сколько транзакций было отправлено
  console.log(`Done. Sent: ${result.sent}`);
  if (result.ack) {
    console.log('Ack:', JSON.stringify(result.ack));
  }
}

main().catch((err) => {
  console.error('✖ Sync failed:', err?.message || err);
  process.exit(1);
});
