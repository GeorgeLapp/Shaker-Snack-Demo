// Node 18+
// npm i ws
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { loadMatrixFromSqlite } from './sendMatrixFromSqlite.mjs';

// ---- Конфиг окружения (из файла авторизации) ---- :contentReference[oaicite:9]{index=9}
const TOKEN_URL = process.env.SHAKER_TOKEN_URL
  || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL = process.env.SHAKER_WS_URL
  || 'ws://185.46.8.39:8315/ws';
const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001';

// Путь к БД — из аргумента, по умолчанию goods.db
const DB_PATH = process.argv[2] || 'goods.db';

// ---- OAuth2 Client Credentials ---- :contentReference[oaicite:10]{index=10}
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
  if (!json?.access_token) throw new Error('No access_token in token response');
  return json.access_token;
}

// ---- Построение payload по спецификации matrixImportTopicSnack ---- :contentReference[oaicite:11]{index=11}
function buildMatrixPayload({ clientId, machineId, matrix, requestUuid }) {
  return {
    clientId,
    type: 'matrixImportTopicSnack',
    body: { requestUuid, machineId, matrix },
  };
}

/**
 * Отправка по одному WS и ожидание ДВУХ сообщений:
 *   1) matrixImportTopicSnack (success/err), возможно с body: null
 *   2) snackTopicRes с тем же requestUuid
 *
 * Возвращает { ack1, ack2 }.
 */
async function sendAndWaitDoubleAck({ wsUrl, token, payload, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } });
    let timer;
    let ack1 = null;
    let ack2 = null;

    const requestUuid = payload?.body?.requestUuid;

    const finish = (err) => {
      clearTimeout(timer);
      try { ws.close(); } catch {}
      err ? reject(err) : resolve({ ack1, ack2 });
    };

    ws.on('open', () => {
      ws.send(JSON.stringify(payload));

      timer = setTimeout(() => {
        finish(new Error(`Timeout waiting for double-ACK (requestUuid=${requestUuid})`));
      }, timeoutMs);
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // 1-й ответ: matrixImportTopicSnack (body может быть null — это норма)
      if (!ack1 &&
          msg?.type === 'matrixImportTopicSnack') {
        ack1 = msg;
        // не выходим — ждём второй snackTopicRes
        return;
      }

      // 2-й ответ: snackTopicRes с тем же requestUuid
      if (msg?.type === 'snackTopicRes' &&
          msg?.body?.requestUuid &&
          msg.body.requestUuid === requestUuid) {
        ack2 = msg;
        return finish();
      }
    });

    ws.on('error', (err) => finish(err));
    ws.on('close', () => {
      // если сокет закрылся раньше времени — пусть таймер добьёт, либо уже finish(err/ok) отработал
    });
  });
}

// ---- Основной запуск ----
(async () => {
  try {
    console.log(`DB file: ${DB_PATH}`);
    console.log('Loading matrix from SQLite…');
    const matrix = await loadMatrixFromSqlite(DB_PATH); // только БД-логика (этот модуль вы и просили) 
    console.log(`Matrix cells: ${matrix.length}`);

    const requestUuid = randomUUID();
    const payload = buildMatrixPayload({
      clientId: CLIENT_ID,
      machineId: MACHINE_ID,
      matrix,
      requestUuid,
    });

    console.log('Getting OAuth token…');
    const token = await fetchToken(); // авторизация здесь, как вы просили. :contentReference[oaicite:13]{index=13}

    console.log('Sending snapshot over WS and waiting for 2 responses…');
    const { ack1, ack2 } = await sendAndWaitDoubleAck({
      wsUrl: WS_URL,
      token,
      payload,
      timeoutMs: 20000, // немного запас
    });

    console.log('\n— ACK #1 (matrixImportTopicSnack):');
    console.dir(ack1, { depth: null });

    console.log('\n— ACK #2 (snackTopicRes):');
    console.dir(ack2, { depth: null });

    const ok1 = (ack1?.success === true) || (ack1?.body?.accepted === true);
    const ok2 = Boolean(ack2?.body?.success);

    if (ok1 && ok2) {
      console.log('\n✅ Matrix import fully confirmed.');
      process.exit(0);
    } else {
      console.error('\n❌ Import not fully confirmed (one of ACKs indicates failure).');
      process.exit(2);
    }
  } catch (e) {
    console.error('\n💥 Fatal:', e.message);
    process.exit(1);
  }
})();
