// Node 18+
// npm i ws
import WebSocket from 'ws';
import { buildMatrixImportPayload } from './sendMatrixFromSqlite.mjs';

// ── конфиг окружения (адреса/креды)
const TOKEN_URL = process.env.SHAKER_TOKEN_URL
  || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL = process.env.SHAKER_WS_URL
  || 'ws://185.46.8.39:8315/ws';

const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001';

// БД — только как входной параметр, но обработка в другом файле
const DB_PATH = process.argv[2] || 'goods.db';

// ── OAuth2 Client Credentials (только авторизация)
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

/**
 * Только отправка и ожидание двух ответов на ОДНОМ сокете:
 *   1) { "type": "matrixImportTopicSnack", "success": true, "message": "", "body": null }
 *   2) { "type": "snackTopicRes", "body": { "requestUuid": "...", "success": true, "updatedCells": [...], "errors": null } }
 */
async function sendPayloadAndWaitDoubleAck({ wsUrl, token, payload, timeoutMs = 20000 }) {
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
      timer = setTimeout(() => finish(new Error(`Timeout waiting two responses (requestUuid=${requestUuid})`)), timeoutMs);
    });

    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

      // 1-й ответ
      if (!ack1 && msg?.type === 'matrixImportTopicSnack') {
        ack1 = msg;                     // body может быть null — это ОК
        return;                          // ждём второй
      }

      // 2-й ответ (коррелируем по requestUuid)
      if (msg?.type === 'snackTopicRes' &&
          msg?.body?.requestUuid === requestUuid) {
        ack2 = msg;
        return finish();
      }
    });

    ws.on('error', (err) => finish(err));
    ws.on('close', () => { /* ждём таймер или уже завершили */ });
  });
}

// ── основной запуск (только «взять payload у модуля» → авторизоваться → отправить → дождаться 2 ответов)
(async () => {
  try {
    console.log(`DB file: ${DB_PATH}`);
    console.log('Building payload from DB (delegated)…');
    const { payload, requestUuid, matrixCount } = await buildMatrixImportPayload({
      dbPath: DB_PATH,
      clientId: CLIENT_ID,
      machineId: MACHINE_ID
    });
    console.log(`Payload ready. cells=${matrixCount}, requestUuid=${requestUuid}`);

    console.log('Getting OAuth token…');
    const token = await fetchToken();

    console.log('Sending over WS and waiting for 2 responses…');
    const { ack1, ack2 } = await sendPayloadAndWaitDoubleAck({
      wsUrl: WS_URL,
      token,
      payload,
      timeoutMs: 20000
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
