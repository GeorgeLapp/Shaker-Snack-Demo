// Требуется: npm i sqlite3 ws
import sqlite3 from 'sqlite3';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// ==== Конфигурация окружения (переопределяйте переменными среды) ====
const TOKEN_URL = process.env.SHAKER_TOKEN_URL
  || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL    = process.env.SHAKER_WS_URL || 'ws://185.46.8.39:8315/ws';

const CLIENT_ID     = process.env.SHAKER_CLIENT_ID     || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID    = process.env.SHAKER_MACHINE_ID    || 'MACHINE_ID_001';

// ---- утилиты для sqlite3 (Promise-обёртки) ----
function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else {
        db.run('PRAGMA foreign_keys = ON'); // см. схему с FK и триггерами
        resolve(db);
      }
    });
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function close(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

// ---- OAuth2 Client Credentials ----
async function fetchToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'profile',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });
  if (!res.ok) throw new Error(`Token error ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

// ---- Открыть WS с заголовком Authorization ----
async function openWs(accessToken) {
  const ws = new WebSocket(WS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timeout')), 15000);
    ws.once('open', () => { clearTimeout(t); resolve(); });
    ws.once('error', reject);
  });
  return ws;
}

// ---- Прочитать volume по ячейкам из SQLite ----
// Если передан массив cellNumbers — берём только их.
// Если не передан — берём все включённые ячейки (enabled=1).
async function readCellsFromDb(dbPath, cellNumbers = null) {
  const db = await openDb(dbPath);
  try {
    let rows;
    if (Array.isArray(cellNumbers) && cellNumbers.length) {
      const placeholders = cellNumbers.map(() => '?').join(',');
      rows = await all(
        db,
        `
        SELECT s.cell_number AS cellNumber, s.volume
        FROM matrix_cell_state s
        JOIN matrix_cell_config c ON c.cell_number = s.cell_number
        WHERE c.enabled = 1 AND s.cell_number IN (${placeholders})
        ORDER BY s.cell_number
        `,
        cellNumbers
      );
    } else {
      rows = await all(
        db,
        `
        SELECT s.cell_number AS cellNumber, s.volume
        FROM matrix_cell_state s
        JOIN matrix_cell_config c ON c.cell_number = s.cell_number
        WHERE c.enabled = 1
        ORDER BY s.cell_number
        `
      );
    }

    // Защита от отрицательных/нецелых значений (по схеме volume INTEGER CHECK >=0)
    // но на всякий случай нормализуем.
    return rows.map(r => ({
      cellNumber: Number(r.cellNumber),
      volume: Math.max(0, Number.isFinite(+r.volume) ? Math.trunc(+r.volume) : 0)
    }));
  } finally {
    await close(db);
  }
}

// ---- Отправка остатков и ожидание подтверждения ----
async function sendVolumesOverWs(ws, cells, {
  clientId   = CLIENT_ID,
  machineId  = MACHINE_ID,
  timeoutMs  = 15000
} = {}) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('No cells to send');
  }
  // Базовая клиентская валидация
  for (const {cellNumber, volume} of cells) {
    if (!Number.isInteger(cellNumber) || cellNumber < 1) {
      throw new Error(`Bad cellNumber: ${cellNumber}`);
    }
    if (!Number.isInteger(volume) || volume < 0) {
      throw new Error(`Bad volume for cell ${cellNumber}: ${volume}`);
    }
  }

  const requestUuid = randomUUID();
  const payload = {
    clientId,
    type: 'cellVolumeImportTopicSnack',
    body: {
      requestUuid,
      machineId,
      cells: cells.map(c => ({ cellNumber: c.cellNumber, volume: c.volume }))
    }
  };

  ws.send(JSON.stringify(payload));

  // ждём подтверждение "cellVolumeExportSnack"
  const confirmed = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('No confirmation (timeout)')), timeoutMs);
    function onMessage(data) {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg?.type === 'cellVolumeExportSnack' && Array.isArray(msg.body)) {
        ws.off('message', onMessage);
        clearTimeout(t);
        resolve(msg.body); // [{cellNumber, volume}, ...]
      }
    }
    ws.on('message', onMessage);
    ws.once('close', () => { clearTimeout(t); reject(new Error('WS closed')); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });

  return confirmed;
}

// ---- Главная экспортируемая функция ----
/**
 * Читает количества из SQLite и отправляет одну/несколько ячеек на телеметрию.
 * @param {string} dbPath - путь к SQLite-файлу (например, goods.db)
 * @param {Object} opts
 * @param {number[]} [opts.cellNumbers] - явный список ячеек; если не задан — все enabled
 * @returns {Promise<Array<{cellNumber:number, volume:number}>>} подтверждённые сервером ячейки
 */
export async function sendCellVolumesFromSqlite(dbPath, { cellNumbers } = {}) {
  const cells = await readCellsFromDb(dbPath, cellNumbers); // читает из matrix_cell_state / matrix_cell_config (enabled) :contentReference[oaicite:2]{index=2}
  if (cells.length === 0) {
    return [];
  }
  const token = await fetchToken();
  const ws = await openWs(token);
  try {
    const confirmed = await sendVolumesOverWs(ws, cells);
    return confirmed;
  } finally {
    try { ws.close(1000, 'done'); } catch {}
  }
}

// --- Пример локального запуска: ---
// node sendCellVolumesFromSqlite.mjs ./goods.db 1 2 3
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const dbPath = process.argv[2] || 'goods.db';
    const nums = process.argv.slice(3).map(n => parseInt(n, 10)).filter(Number.isInteger);
    const confirmed = await sendCellVolumesFromSqlite(dbPath, { cellNumbers: nums.length ? nums : undefined });
    for (const { cellNumber, volume } of confirmed) {
      console.log(`✓ confirmed: cell ${cellNumber} → volume=${volume}`);
    }
  })().catch(e => {
    console.error('Error:', e.message);
    process.exitCode = 1;
  });
}
