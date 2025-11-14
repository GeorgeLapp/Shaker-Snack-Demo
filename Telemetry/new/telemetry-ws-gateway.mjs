// telemetry-ws-gateway.mjs
// Основной модуль связи с сервером телеметрии Shaker.
// Отвечает за:
//  - получение OAuth2 access_token;
//  - установку и поддержание WebSocket-соединения;
//  - отправку запросов и ожидание ответов (1 или 2 пакета);
//  - маршрутизацию push-сообщений в модуль телеметрии.
//
// Комментарии — на русском языке.
// Все сообщения/ошибки — на английском языке.

import WebSocket from 'ws';
import { setTimeout as delay } from 'node:timers/promises';

// ===============================
// Константы протокола и таймингов
// ===============================

// Типы сообщений (topics)
export const TYPE_MACHINE_INFO = 'machineInfo';
export const TYPE_BASE_PRODUCT_EXPORT = 'baseProductRequestExportTopic';
export const TYPE_MATRIX_IMPORT_SNACK = 'matrixImportTopicSnack';
export const TYPE_CELL_STORE_IMPORT_SNACK = 'cellStoreImportTopicSnack';
export const TYPE_CELL_VOLUME_IMPORT_SNACK = 'cellVolumeImportTopicSnack';
export const TYPE_SALE_IMPORT_SNACK = 'saleImportTopicSnack';

export const TYPE_SNACK_TOPIC_RES = 'snackTopicRes';
export const TYPE_CELL_VOLUME_EXPORT_SNACK = 'cellVolumeExportSnack';
export const TYPE_CELL_STORE_EXPORT_SNACK = 'cellStoreExportSnack';

// Тайминги
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_RESERVE_MS = 30_000;
const RECONNECT_INITIAL_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

// Типы, у которых один ответный пакет (ACK = результат)
const ONE_PHASE_TYPES = new Set([
  TYPE_MACHINE_INFO,
  TYPE_SALE_IMPORT_SNACK
]);

// Типы, у которых два пакета, и второй имеет тот же type (ACK + данные)
const TWO_PHASE_SAME_TYPE_TYPES = new Set([
  TYPE_BASE_PRODUCT_EXPORT
]);

// Типы, у которых ACK и RESULT имеют разные type
const TWO_PHASE_WITH_RESULT_TYPES = new Map([
  [TYPE_MATRIX_IMPORT_SNACK, TYPE_SNACK_TOPIC_RES],
  [TYPE_CELL_STORE_IMPORT_SNACK, TYPE_SNACK_TOPIC_RES],
  [TYPE_CELL_VOLUME_IMPORT_SNACK, TYPE_CELL_VOLUME_EXPORT_SNACK]
]);

/**
 * @typedef {Object} WsRequestOptions
 * @property {string} type        Тип запроса (topic)
 * @property {any}    body        Тело сообщения (body)
 * @property {number} [timeoutMs] Таймаут ожидания ответа
 */

/**
 * @typedef {Object} WsResponseBundle
 * @property {any} [ack]    Пакет ACK (если есть)
 * @property {any} [result] Основной пакет результата (если есть)
 */

export class TelemetryWsGateway {
  /**
   * @param {object} options
   * @param {string} options.oauthUrl
   * @param {string} options.clientId
   * @param {string} options.clientSecret
   * @param {string} options.wsUrl
   */
  constructor({ oauthUrl, clientId, clientSecret, wsUrl }) {
    this.oauthUrl = oauthUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.wsUrl = wsUrl;

    // состояние токена
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;

    // состояние WebSocket
    this.ws = null;
    this.isConnecting = false;
    this.shouldReconnect = true;
    this.reconnectDelayMs = RECONNECT_INITIAL_DELAY_MS;

    /** @type {Map<string, any>} ожидание по type (ACK) */
    this.pendingByType = new Map();
    /** @type {Map<string, any>} ожидание по requestUuid (RESULT) */
    this.pendingByRequestUuid = new Map();

    /** @type {((msg:any) => void)[]} обработчики push-сообщений */
    this.pushHandlers = [];
  }

  // ============================
  // Общие методы
  // ============================

  /**
   * Регистрация обработчика push-сообщений (инициатива сервера).
   * @param {(msg:any) => void} handler
   */
  onPush(handler) {
    this.pushHandlers.push(handler);
  }

  /**
   * Обеспечивает наличие валидного access_token.
   */
  async ensureToken() {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt - TOKEN_EXPIRY_RESERVE_MS) {
      return;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials'
    });

    const response = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.access_token || !data.expires_in) {
      throw new Error('OAuth token response is missing required fields');
    }

    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = now + data.expires_in * 1000;
  }

  /**
   * Обеспечивает установленное WebSocket-соединение.
   */
  async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    if (this.isConnecting) {
      while (this.isConnecting) {
        await delay(100);
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    }

    this.isConnecting = true;
    try {
      await this.ensureToken();
      await this.openWs();
      this.reconnectDelayMs = RECONNECT_INITIAL_DELAY_MS;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Непосредственное открытие WebSocket.
   */
  openWs() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'X-Client-Id': this.clientId
        }
      });

      ws.on('open', () => {
        this.ws = ws;
        this.setupWsHandlers();
        resolve();
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Настройка обработчиков событий WebSocket.
   */
  setupWsHandlers() {
    if (!this.ws) return;

    this.ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        console.error('Invalid JSON from telemetry server:', err);
        return;
      }
      this.handleIncoming(msg);
    });

    this.ws.on('close', async () => {
      console.warn('WebSocket connection closed, starting reconnection loop...');
      this.ws = null;

      // Завершаем все pending-запросы с ошибкой
      for (const [, entry] of this.pendingByType) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Connection closed while waiting for response'));
      }
      this.pendingByType.clear();
      this.pendingByRequestUuid.clear();

      if (!this.shouldReconnect) return;

      // Простейший экспоненциальный backoff
      while (!this.ws && this.shouldReconnect) {
        try {
          await delay(this.reconnectDelayMs);
          await this.ensureConnected();
        } catch (err) {
          console.error('Reconnection attempt failed:', err.message);
          this.reconnectDelayMs = Math.min(
            this.reconnectDelayMs * 2,
            RECONNECT_MAX_DELAY_MS
          );
        }
      }
    });
  }

  /**
   * Обработка входящего сообщения от телеметрии.
   * @param {any} msg
   */
  handleIncoming(msg) {
    const { type } = msg;

    // 1) Двухфазные методы с одинаковым типом для ACK и RESULT
    if (TWO_PHASE_SAME_TYPE_TYPES.has(type)) {
      const entry = this.pendingByType.get(type);
      if (!entry) {
        this.dispatchPush(msg);
        return;
      }

      if (Object.prototype.hasOwnProperty.call(msg, 'success')) {
        entry.ack = msg;
        return;
      }

      clearTimeout(entry.timer);
      this.pendingByType.delete(type);
      entry.resolve({ ack: entry.ack, result: msg });
      return;
    }

    // 2) ACK для двухфазных методов с разными типами RESULT
    if (TWO_PHASE_WITH_RESULT_TYPES.has(type)) {
      const entry = this.pendingByType.get(type);
      if (!entry) {
        this.dispatchPush(msg);
        return;
      }
      entry.ack = msg;
      return;
    }

    // 3) RESULT для двухфазных методов с разными типами RESULT
    if ([...TWO_PHASE_WITH_RESULT_TYPES.values()].includes(type)) {
      if (type === TYPE_SNACK_TOPIC_RES && msg.body && msg.body.requestUuid) {
        const entry = this.pendingByRequestUuid.get(msg.body.requestUuid);
        if (!entry) {
          this.dispatchPush(msg);
          return;
        }
        clearTimeout(entry.timer);
        this.pendingByType.delete(entry.type);
        this.pendingByRequestUuid.delete(msg.body.requestUuid);
        entry.resolve({ ack: entry.ack, result: msg });
        return;
      }

      if (type === TYPE_CELL_VOLUME_EXPORT_SNACK) {
        const entry = [...this.pendingByType.values()]
          .find(e => e.resultType === TYPE_CELL_VOLUME_EXPORT_SNACK);
        if (!entry) {
          this.dispatchPush(msg);
          return;
        }
        clearTimeout(entry.timer);
        this.pendingByType.delete(entry.type);
        if (entry.requestUuid) {
          this.pendingByRequestUuid.delete(entry.requestUuid);
        }
        entry.resolve({ ack: entry.ack, result: msg });
        return;
      }

      this.dispatchPush(msg);
      return;
    }

    // 4) Однофазные методы (machineInfo, saleImportTopicSnack)
    if (ONE_PHASE_TYPES.has(type)) {
      const entry = this.pendingByType.get(type);
      if (!entry) {
        this.dispatchPush(msg);
        return;
      }
      clearTimeout(entry.timer);
      this.pendingByType.delete(type);
      entry.resolve({ ack: msg, result: null });
      return;
    }

    // 5) Всё прочее — push-сообщения
    this.dispatchPush(msg);
  }

  /**
   * Рассылает push-сообщение всем подписчикам.
   * @param {any} msg
   */
  dispatchPush(msg) {
    for (const handler of this.pushHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error('Push handler error:', err);
      }
    }
  }

  /**
   * Отправка сообщения в телеметрию и ожидание ответа.
   * @param {WsRequestOptions} options
   * @returns {Promise<WsResponseBundle>}
   */
  async send(options) {
    await this.ensureConnected();

    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const { type } = options;
    const body = options.body || {};

    const resultType = TWO_PHASE_WITH_RESULT_TYPES.get(type) || null;
    const requestUuid = typeof body.requestUuid === 'string' ? body.requestUuid : null;

    const payload = {
      clientId: this.clientId,
      type,
      body
    };

    return new Promise((resolve, reject) => {
      if (this.pendingByType.has(type)) {
        reject(new Error(`Another request of type ${type} is already pending`));
        return;
      }

      const timer = setTimeout(() => {
        this.pendingByType.delete(type);
        if (requestUuid) {
          this.pendingByRequestUuid.delete(requestUuid);
        }
        reject(new Error(`Timeout waiting telemetry response for type ${type}`));
      }, timeoutMs);

      const entry = {
        type,
        requestUuid,
        resultType,
        ack: null,
        resolve,
        reject,
        timer
      };

      this.pendingByType.set(type, entry);
      if (requestUuid) {
        this.pendingByRequestUuid.set(requestUuid, entry);
      }

      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pendingByType.delete(type);
        if (requestUuid) {
          this.pendingByRequestUuid.delete(requestUuid);
        }
        reject(err);
      }
    });
  }
}
