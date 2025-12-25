// file: sync-catalog.mjs
import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { promisify } from 'node:util';
import { importCatalog } from '../shaker-db.mjs';

// ==== Параметры запуска ====
// 1-й аргумент: имя файла базы (по умолчанию goods.db)
const DB_FILE = process.argv[2] || 'c:/Users/user/Desktop/Shaker-Snack-Demo/Telemetry/goods.db';

// Данные авторизации и контекста берём из ENV:
const CLIENT_ID     = process.env.SHAKER_CLIENT_ID     || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID    = Number(process.env.MACHINE_ID    || process.env.SHAKER_MACHINE_ID || 12);
const ORG_ID        = Number(process.env.ORG_ID        || process.env.SHAKER_ORG_ID     || 54);

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

function toIntOrNull(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeMachineInfo(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      machineId: null,
      organizationId: null,
      modelId: null,
      serialNumber: null
    };
  }

  return {
    machineId: toIntOrNull(raw.machineId ?? raw.id ?? raw.machine_id ?? null),
    organizationId: toIntOrNull(
      raw.organizationId ?? raw.orgId ?? raw.organization_id ?? raw.org_id ?? null
    ),
    modelId: toIntOrNull(raw.modelId ?? raw.model_id ?? null),
    serialNumber: raw.serialNumber ?? raw.serial_number ?? raw.serial ?? null
  };
}

async function fetchMachineInfoOnce(accessToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let done = false;
    let timeout;

    const finish = (err, payload) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (err) {
        reject(err);
      } else {
        resolve(payload);
      }
    };

    ws.on('open', () => {
      const req = {
        clientId: CLIENT_ID,
        type: 'machineInfo',
        body: {}
      };
      ws.send(JSON.stringify(req));
      timeout = setTimeout(() => {
        ws.close(4000, 'timeout');
        finish(new Error('Timeout waiting for machineInfo'));
      }, 10_000);
    });

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      if (msg?.type !== 'machineInfo') return;
      ws.close(1000, 'done');
      finish(null, msg?.body ?? null);
    });

    ws.on('close', (code, reasonBuf) => {
      if (done) return;
      const reason = reasonBuf?.toString() || '';
      finish(new Error(`WS closed ${code} ${reason}`));
    });

    ws.on('error', (err) => {
      finish(err);
    });
  });
}

async function saveMachineInfo(db, info) {
  const run = promisify(db.run.bind(db));
  const source = info ?? {};
  const machineId = toIntOrNull(source.machineId);
  const organizationId = toIntOrNull(source.organizationId);
  const modelId = toIntOrNull(source.modelId);
  const serialNumber = source.serialNumber ?? null;

  await run(`
    CREATE TABLE IF NOT EXISTS machine_info (
      id              INTEGER PRIMARY KEY,
      machine_id      INTEGER,
      organization_id INTEGER,
      model_id        INTEGER,
      serial_number   TEXT
    )
  `);

  await run(
    `
    INSERT OR IGNORE INTO machine_info (id, machine_id, organization_id, model_id, serial_number)
    VALUES ($id, NULL, NULL, NULL, NULL)
    `,
    { $id: 1 }
  );

  await run(
    `
    UPDATE machine_info
       SET machine_id = $machineId,
           organization_id = $organizationId,
           model_id = $modelId,
           serial_number = $serialNumber
     WHERE id = $id
    `,
    {
      $machineId: machineId,
      $organizationId: organizationId,
      $modelId: modelId,
      $serialNumber: serialNumber,
      $id: 1
    }
  );
}

// Подключиться к WS, отправить запрос каталога и получить 2 ответа: ack → data
async function fetchCatalogOnce(accessToken, { machineId, organizationId }) {
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
        body: { machineId, organizationId }
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

  let rawMachineInfo = null;
  try {
    rawMachineInfo = await fetchMachineInfoOnce(access_token);
  } catch (err) {
    console.warn('Machine info request failed:', err.message);
  }

  const machineInfo = normalizeMachineInfo(rawMachineInfo);
  const machineId = machineInfo.machineId ?? MACHINE_ID;
  const organizationId = machineInfo.organizationId ?? ORG_ID;

  if (!machineId || !organizationId) {
    throw new Error('machineId and organizationId are required');
  }

  console.log(`Using machineId=${machineId} organizationId=${organizationId}`);

  // 2) Получаем каталог по WebSocket
  console.log('Fetching catalog over WebSocket…');
  const catalogMessage = await fetchCatalogOnce(access_token, { machineId, organizationId });
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
          await saveMachineInfo(db, {
            machineId,
            organizationId,
            modelId: machineInfo.modelId,
            serialNumber: machineInfo.serialNumber ?? CLIENT_ID
          });
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
