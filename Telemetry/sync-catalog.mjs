// file: sync-catalog.mjs
import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { importCatalog } from './importCatalog.mjs';

// ==== Параметры запуска ====
// 1-й аргумент: имя файла базы (по умолчанию goods.db)
const DB_FILE = process.argv[2] || 'goods.db';

// Данные авторизации и контекста берём из ENV:
const CLIENT_ID     = process.env.SHAKER_CLIENT_ID     || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID    = Number(process.env.MACHINE_ID    || 12);
const ORG_ID        = Number(process.env.ORG_ID        || 54);

// Endpoints из ваших документов
const TOKEN_URL = 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL    = 'ws://185.46.8.39:8315/ws';

// ==== Утилиты ====
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
    body
  });
  if (!res.ok) {
    throw new Error(`Token error ${res.status}: ${await res.text().catch(()=> '')}`);
  }
  return res.json(); // { access_token, expires_in, ... }
}

// Подключиться к WS, отправить запрос каталога и получить 2 ответа: ack → data
async function fetchCatalogOnce(accessToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let gotAck = false;
    let timeout;

    ws.on('open', () => {
      // Запрос каталога
      const req = {
        clientId: CLIENT_ID,
        type: 'baseProductRequestExportTopic',
        body: { machineId: MACHINE_ID, organizationId: ORG_ID }
      };
      ws.send(JSON.stringify(req));
      // Таймаут ожидания полной выдачи
      timeout = setTimeout(() => {
        ws.close(4000, 'timeout');
        reject(new Error('Timeout waiting for catalog data'));
      }, 30_000);
    });

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      if (msg?.type !== 'baseProductRequestExportTopic') return;

      // 1) ACK
      if (msg?.success === true && msg?.body === null) {
        gotAck = true;
        return;
      }
      // 2) DATA
      if (Array.isArray(msg?.body)) {
        clearTimeout(timeout);
        ws.close(1000, 'done');
        // Соберём «сообщение из телеметрии» в том же формате, который ждёт importCatalog
        resolve({
          type: 'baseProductRequestExportTopic',
          body: msg.body
        });
      }
    });

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString() || '';
      if (code !== 1000) {
        reject(new Error(`WS closed ${code} ${reason}`));
      } else if (!gotAck) {
        // На всякий случай: получили data без ack — допустим, но предупредим
        // (не считаем это ошибкой, так как некоторые окружения могут прислать только data)
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  console.log(`DB file: ${DB_FILE}`);
  // 1) Получаем токен
  console.log('Getting OAuth token…');
  const { access_token } = await fetchToken();

  // 2) Получаем каталог по WebSocket
  console.log('Fetching catalog over WebSocket…');
  const catalogMessage = await fetchCatalogOnce(access_token);
  console.log(`Catalog items: ${Array.isArray(catalogMessage.body) ? catalogMessage.body.length : 0}`);

  // 3) Открываем БД и импортируем
  await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) return reject(err);
      // Рекомендуемые pragmas (опционально)
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');
        db.run('PRAGMA journal_mode = WAL');
      });

      (async () => {
        try {
          await importCatalog(db, catalogMessage);
          console.log('Catalog imported successfully.');
          db.close((e) => e ? reject(e) : resolve());
        } catch (e) {
          db.close(() => reject(e));
        }
      })();
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[sync-catalog] Failed:', err.message);
    process.exit(1);
  });
