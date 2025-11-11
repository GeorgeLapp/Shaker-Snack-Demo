#!/usr/bin/env node
// send-cellstore-cli.js
// Запуск:
//   node send-cellstore-cli.js [goods.db]
//   SHAKER_CLIENT_ID=snack_02 SHAKER_CLIENT_SECRET=SECRET SHAKER_MACHINE_ID=MACHINE_ID_001 node send-cellstore-cli.js /path/to/goods.db

import { fileURLToPath } from 'url';
import path from 'path';
import process from 'process';
import WebSocket from 'ws'; // чтобы была установлена зависимость для sendCellStoreFromSqlite.js
import { v4 as uuidv4 } from 'uuid'; // зависимость для sendCellStoreFromSqlite.js
import { sendCellStoreFromSqlite,sendCellStoreForCells } from './sendCellStoreFromSqlite.mjs';

// === ENDPOINTS из вашей спецификации авторизации ===
// см. "Авторизация и установление соединения ws.docx"
const TOKEN_URL = process.env.SHAKER_TOKEN_URL
  || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL = process.env.SHAKER_WS_URL
  || 'ws://185.46.8.39:8315/ws'; // адрес WS-эндпоинта телеметрии
// :contentReference[oaicite:3]{index=3}

// === Данные автомата ===
const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';        // серийный номер автомата
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';   // секрет автомата
const MACHINE_ID = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001'; // ID автомата на стороне сервера

// === Параметры CLI ===
const argv = process.argv.slice(2);
const dbPath = argv[0] ? path.resolve(argv[0]) : path.resolve('goods.db');

// === Получение OAuth2 access_token по Client Credentials ===
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
  const json = await res.json();
  if (!json.access_token) throw new Error('No access_token in response');
  return json.access_token;
}
// Формат токена, способ подключения WS и заголовок Authorization описаны в файле по авторизации. :contentReference[oaicite:4]{index=4}

async function main() {
  console.log(`→ БД: ${dbPath}`);
  console.log(`→ WS: ${WS_URL}`);
  console.log(`→ clientId: ${CLIENT_ID} | machineId: ${MACHINE_ID}`);

  // 1) Получаем access_token
  const accessToken = await fetchToken();

  // 2) Отправляем наполнение (read+send)
 const body = await sendCellStoreFromSqlite({
    dbPath,
    wsUrl: WS_URL,
    accessToken,
    clientId: CLIENT_ID,
    machineId: MACHINE_ID,
    onMessage: (msg) => {
      // Логируем любые сообщения от сервера (могут приходить помимо snackTopicRes)
      try {
        console.log('[WS] ←', JSON.stringify(msg));
      } catch {
        // no-op
      }
    },
  });
/*const body  =await sendCellStoreForCells({
  dbPath,
  wsUrl: WS_URL,
  accessToken,
  clientId:CLIENT_ID,
  machineId: MACHINE_ID,
  cellNumbers: [12, 23],
  onMessage: (m) => console.log('[WS] ←', JSON.stringify(m))
});*/

  // 3) Печатаем результат snackTopicRes.body
  // Структура ответа описана в спецификации cellStoreImportTopicSnack/snackTopicRes.
  // Поля: requestUuid, success, updatedCells, errors. :contentReference[oaicite:5]{index=5}
  console.log('\n=== Результат телеметрии (snackTopicRes.body) ===');
  console.log(JSON.stringify(body, null, 2));

  if (body?.success === false && Array.isArray(body?.errors) && body.errors.length) {
    console.log('\n⚠ Есть ошибки по ячейкам — повторите синхронизацию только для проблемных cellNumber.');
  }
}

main().catch((err) => {
  console.error('✖ Ошибка:', err?.message || err);
  process.exit(1);
});
