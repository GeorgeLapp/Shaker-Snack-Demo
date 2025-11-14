// Требуется: npm i ws
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { getCellVolumes } from '../shaker-db.mjs';

// ==== Конфигурация окружения (переопределяем через переменные среды) ====

const TOKEN_URL =
  process.env.SHAKER_TOKEN_URL ||
  'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';

const WS_URL = process.env.SHAKER_WS_URL || 'ws://185.46.8.39:8315/ws';

const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';
const CLIENT_SECRET =
  process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001';

// ---- Ошибки (константы) ----

const ERROR_NO_CELLS = 'No cells to send';
const ERROR_BAD_CELL_NUMBER = 'Bad cellNumber value';
const ERROR_BAD_VOLUME = 'Bad volume value';
const ERROR_TOKEN = 'Token request failed';
const ERROR_WS_OPEN_TIMEOUT = 'WS open timeout';
const ERROR_WS_CLOSED = 'WebSocket closed';
const ERROR_NO_CONFIRMATION = 'No confirmation from server (timeout)';

// ---- OAuth2 Client Credentials ----

/**
 * Получение access_token по протоколу OAuth2 (client_credentials).
 * Используем внутренний Keycloak телеметрии.
 */
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
    throw new Error(`${ERROR_TOKEN}: HTTP ${res.status}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`${ERROR_TOKEN}: no access_token in response`);
  }

  return json.access_token;
}

/**
 * Открытие WebSocket-соединения с телеметрией.
 * В заголовок добавляется Authorization: Bearer <token>.
 */
async function openWs(accessToken) {
  const ws = new WebSocket(WS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(ERROR_WS_OPEN_TIMEOUT)),
      15000
    );

    ws.once('open', () => {
      clearTimeout(t);
      resolve();
    });

    ws.once('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });

  return ws;
}

/**
 * Отправка остатков ячеек на телеметрию и ожидание подтверждения.
 *
 * @param {WebSocket} ws открытое WebSocket-соединение
 * @param {Array<{cellNumber:number, volume:number}>} cells данные по ячейкам
 * @param {Object} [opts]
 * @param {string} [opts.clientId]
 * @param {string} [opts.machineId]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<Array<{cellNumber:number, volume:number}>>} подтверждённые сервером значения
 */
async function sendVolumesOverWs(
  ws,
  cells,
  { clientId = CLIENT_ID, machineId = MACHINE_ID, timeoutMs = 15000 } = {}
) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error(ERROR_NO_CELLS);
  }

  // Базовая клиентская валидация
  for (const { cellNumber, volume } of cells) {
    if (!Number.isInteger(cellNumber) || cellNumber < 1) {
      throw new Error(`${ERROR_BAD_CELL_NUMBER}: ${cellNumber}`);
    }
    if (!Number.isInteger(volume) || volume < 0) {
      throw new Error(`${ERROR_BAD_VOLUME} for cell ${cellNumber}: ${volume}`);
    }
  }

  const requestUuid = randomUUID();

  const payload = {
    clientId,
    type: 'cellVolumeImportTopicSnack',
    body: {
      requestUuid,
      machineId,
      cells: cells.map((c) => ({
        cellNumber: c.cellNumber,
        volume: c.volume,
      })),
    },
  };

  ws.send(JSON.stringify(payload));

  // Ожидаем ответ "cellVolumeExportSnack"
  const confirmed = await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(ERROR_NO_CONFIRMATION)),
      timeoutMs
    );

    function onMessage(data) {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg?.type === 'cellVolumeExportSnack' && Array.isArray(msg.body)) {
        ws.off('message', onMessage);
        clearTimeout(t);
        resolve(msg.body); // [{cellNumber, volume}, ...]
      }
    }

    ws.on('message', onMessage);

    ws.once('close', () => {
      clearTimeout(t);
      reject(new Error(ERROR_WS_CLOSED));
    });

    ws.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  return confirmed;
}

// ---- CLI-скрипт: только авторизация + отправка ----
//
// node sync-volume.mjs goods.db 1 2 3
// - goods.db — путь к базе (по умолчанию goods.db)
// - 1 2 3   — номера ячеек для отправки (если не указаны — отправляются все enabled)

const dbPath = process.argv[2] || 'c:/Users/user/Desktop/Shaker-Snack-Demo/Telemetry/goods.db';
const cellsFromArgs = process.argv
  .slice(3)
  .map((n) => parseInt(n, 10))
  .filter(Number.isInteger);

(async () => {
  try {
    // 1. Читаем данные по ячейкам из БД (логика в отдельном модуле)
    const cells = await getCellVolumes(
      dbPath,
      cellsFromArgs.length ? cellsFromArgs : undefined
    );

    if (!cells.length) {
      console.log(
        'Нет данных для отправки: либо нет enabled-ячееек, либо объемы равны 0.'
      );
      return;
    }

    console.log(
      `Подготовлено ячеек к отправке: ${cells.length} (БД: ${dbPath})`
    );

    // 2. Авторизация в телеметрии
    console.log('Получаем OAuth token…');
    const token = await fetchToken();

    // 3. Открываем WebSocket
    console.log('Открываем WebSocket-соединение…');
    const ws = await openWs(token);

    try {
      // 4. Отправляем данные и ждём подтверждения
      console.log('Отправляем cellVolumeImportTopicSnack…');
      const confirmed = await sendVolumesOverWs(ws, cells);

      if (!confirmed.length) {
        console.log('Ответ получен, но список подтверждённых ячеек пуст.');
        return;
      }

      for (const { cellNumber, volume } of confirmed) {
        console.log(`✓ confirmed: cell ${cellNumber} → volume=${volume}`);
      }
    } finally {
      try {
        ws.close(1000, 'done');
      } catch {}
    }
  } catch (e) {
    console.error('✖ Sync failed:', e.message);
    process.exitCode = 1;
  }
})();
