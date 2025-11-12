#!/usr/bin/env node
// send-cellstore-cli.mjs
//
// Назначение: ТОЛЬКО авторизация и отправка.
// Этот скрипт получает access_token, открывает WebSocket, отправляет ГОТОВЫЙ
// JSON (который отдаёт telemetry-payload.mjs) и корректно ждёт два ответа:
//   (A) быстрый ACK: { type: "cellStoreImportTopicSnack", success: true, message: "", body: null }
//   (B) финальный:   { type: "snackTopicRes", body: { requestUuid, success, updatedCells, errors } }
//
// Запуск:
//   node send-cellstore-cli.mjs [goods.db] [--cells 12,45]
//
// Переменные окружения:
//   SHAKER_CLIENT_ID, SHAKER_CLIENT_SECRET, SHAKER_MACHINE_ID
//   SHAKER_WS_URL (по умолчанию ws://185.46.8.39:8315/ws)
//   SHAKER_TOKEN_URL (по умолчанию из инструкции)
//   SHAKER_ACK_TIMEOUT_MS=15000
//   SHAKER_FINAL_TIMEOUT_MS=30000
//   SHAKER_PING_MS=15000 (0 — отключить)
//
// Зависимости: ws ; (логика БД — в telemetry-payload.mjs)

import path from 'node:path';
import process from 'node:process';
import WebSocket from 'ws';
import {
  buildCellStoreMessageForAll,
  buildCellStoreMessageForCells
} from './telemetry-payload.mjs';

const TOKEN_URL = process.env.SHAKER_TOKEN_URL
  || 'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';
const WS_URL = process.env.SHAKER_WS_URL || 'ws://185.46.8.39:8315/ws';
const CLIENT_ID = process.env.SHAKER_CLIENT_ID || 'snack_02';
const CLIENT_SECRET = process.env.SHAKER_CLIENT_SECRET || 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';
const MACHINE_ID = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001';

const ACK_TIMEOUT_MS = Number(process.env.SHAKER_ACK_TIMEOUT_MS || 15000);
const FINAL_TIMEOUT_MS = Number(process.env.SHAKER_FINAL_TIMEOUT_MS || 30000);
const PING_MS = Number(process.env.SHAKER_PING_MS || 15000);

// -------------------- разбор аргументов --------------------
const argv = process.argv.slice(2);
let dbPath = 'goods.db';
let cellsArg = "1,2,4,5,6,7";

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a) continue;
  if (a === '--cells') {
    cellsArg = argv[i + 1] || '';
    i++;
  } else if (!a.startsWith('--')) {
    dbPath = a;
  }
}
dbPath = path.resolve(dbPath);

function parseCellsList(s) {
  if (!s) return [];
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(n => Number(n))
    .filter(n => Number.isInteger(n) && n >= 0);
}

// -------------------- авторизация --------------------
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
  const j = await res.json();
  if (!j.access_token) throw new Error('No access_token');
  return j.access_token;
}

// -------------------- ожидание ACK → финал --------------------
function waitAckThenFinal(ws, reqType, requestUuid, { ackTimeoutMs, finalTimeoutMs }) {
  return new Promise((resolve, reject) => {
    let ack = false;
    let final = null;
    const inbox = [];

    let ackTimer = setTimeout(() => {
      if (!ack) {
        cleanup();
        reject(new Error(`No ACK within ${ackTimeoutMs}ms`));
      }
    }, ackTimeoutMs);

    let finalTimer = null;
    function armFinalTimer() {
      if (finalTimer) clearTimeout(finalTimer);
      finalTimer = setTimeout(() => {
        cleanup();
        resolve({ ackOnly: true, messages: inbox, matched: null });
      }, finalTimeoutMs);
    }

    function cleanup() {
      if (ackTimer) clearTimeout(ackTimer);
      if (finalTimer) clearTimeout(finalTimer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
      ws.off('error', onError);
    }

    function onMessage(buf) {
      let msg = null;
      try { msg = JSON.parse(buf.toString()); } catch {}
      if (!msg) return;

      inbox.push(msg);
      try { console.log('[WS] ←', JSON.stringify(msg)); } catch {}

      // быстрый ACK
      if (!ack && msg.type === reqType && msg.success === true && (msg.body == null)) {
        ack = true;
        clearTimeout(ackTimer);
        armFinalTimer();
        return;
      }

      // финал
      if (msg.type === 'snackTopicRes' && msg.body?.requestUuid === requestUuid) {
        final = msg;
        cleanup();
        resolve({ ackOnly: false, messages: inbox, matched: final });
      }
    }

    function onClose(code, reason) {
      if (!final) {
        cleanup();
        reject(new Error(`WS closed before final: ${code} ${reason}`));
      }
    }
    function onError(err) {
      cleanup();
      reject(err);
    }

    ws.on('message', onMessage);
    ws.on('close', onClose);
    ws.on('error', onError);
  });
}

// -------------------- отправка --------------------
async function sendMessageOverWs(msg) {
  const token = await fetchToken();
  const ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${token}` } });
  let pingTimer = null;

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log(`[WS] connected. Sending ${msg.type} (requestUuid=${msg.body?.requestUuid})`);
      ws.send(JSON.stringify(msg), err => {
        if (err) {
          ws.close();
          reject(err);
          return;
        }
        waitAckThenFinal(ws, msg.type, msg.body.requestUuid, {
          ackTimeoutMs: ACK_TIMEOUT_MS,
          finalTimeoutMs: FINAL_TIMEOUT_MS
        })
          .then(res => {
            try { ws.close(1000, 'done'); } catch {}
            resolve(res);
          })
          .catch(e => {
            try { ws.close(); } catch {}
            reject(e);
          });
      });

      if (PING_MS > 0) {
        pingTimer = setInterval(() => { try { ws.ping(); } catch {} }, PING_MS);
      }
    });

    ws.on('close', () => { if (pingTimer) clearInterval(pingTimer); });
    ws.on('error', () => { if (pingTimer) clearInterval(pingTimer); });
  });
}

// -------------------- main --------------------
(async () => {
  console.log(`→ БД: ${dbPath}`);
  console.log(`→ WS: ${WS_URL}`);
  console.log(`→ clientId: ${CLIENT_ID} | machineId: ${MACHINE_ID}`);

  // готовим ГОТОВОЕ сообщение (чтение/валидация/маппинг делает telemetry-payload.mjs)
  let msg;
  const list = parseCellsList(cellsArg);

  if (list.length > 0) {
    console.log(`Preparing payload for cells: ${list.join(', ')}`);
    msg = await buildCellStoreMessageForCells({
      dbPath,
      clientId: CLIENT_ID,
      machineId: MACHINE_ID,
      cellNumbers: list,
    });
  } else {
    console.log('Preparing payload for ALL enabled cells…');
    msg = await buildCellStoreMessageForAll({
      dbPath,
      clientId: CLIENT_ID,
      machineId: MACHINE_ID,
    });
  }

  // авторизация + отправка + ожидание 2х ответов
  const result = await sendMessageOverWs(msg);

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  if (!result.ackOnly && result.matched?.body?.success === false) {
    console.log('\n⚠ Ошибки по ячейкам:');
    console.log(JSON.stringify(result.matched.body.errors, null, 2));
  }
})().catch((err) => {
  console.error('✖ Ошибка:', err?.message || err);
  process.exit(1);
});
