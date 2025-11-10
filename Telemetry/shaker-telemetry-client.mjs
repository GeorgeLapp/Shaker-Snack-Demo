// file: shaker-telemetry-client.js
// ESM module. Requires Node >=18 (fetch, crypto.randomUUID). Uses 'ws' package.
// npm i ws
import EventEmitter from 'events';
import WebSocket from 'ws';

const DEFAULT_WS_URL = 'ws://185.46.8.39:8315/ws';
const DEFAULT_HTTP_BASE = 'https://dev.ishaker.ru';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class ShakerTelemetryClient extends EventEmitter {
  /**
   * options:
   *  - httpBase (string) base url for registration/token endpoints
   *  - wsUrl (string) websocket url
   *  - serialNumber (string) clientId
   *  - regKey (string) optional registration key (for obtaining secretKey via registration endpoint)
   *  - token (string) optional pre-obtained access token
   *  - tokenExpiresAt (Date|timestamp) optional expiry timestamp
   *  - autoSyncOnConnect (bool) whether to run product/matrix sync after connect
   *  - logger (obj) with debug/info/error methods (console fallback)
   */
  constructor(options = {}) {
    super();
    this.httpBase = options.httpBase || DEFAULT_HTTP_BASE;
    this.wsUrl = options.wsUrl || DEFAULT_WS_URL;
    this.serialNumber = options.serialNumber; // clientId
    this.regKey = options.regKey || null;
    this.secretKey = options.secretKey || null;
    this.accessToken = options.token || null;
    this.tokenExpiresAt = options.tokenExpiresAt || 0;
    this.ws = null;
    this.connected = false;
    this._backoffMs = 1000;
    this._maxBackoffMs = 30_000;
    this._shouldReconnect = true;
    this.machineInfo = null; // result from machineInfo response
    this.productCache = new Map(); // goodId -> product object (KBJU etc)
    this._pendingRequests = new Map(); // requestUuid -> resolve/reject for ack style
    this.autoSyncOnConnect = options.autoSyncOnConnect ?? true;
    this.logger = options.logger ?? console;
  }

  // ---------------------------
  // Registration + OAuth2 (client_credentials)
  // ---------------------------
  async registerIfRequired() {
    if (this.secretKey || !this.regKey) return;
    const url = `${this.httpBase}/api/telemetry-machine-control/machine/registration/${encodeURIComponent(this.regKey)}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`Registration failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    if (!json.secretKey) throw new Error('Registration response missing secretKey');
    this.secretKey = json.secretKey;
    this.logger.info('Received secretKey from registration');
  }

  async obtainToken() {
    // if token still valid for next 30s, reuse
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt - 30000 > now) return this.accessToken;

    if (!this.secretKey) {
      await this.registerIfRequired();
      if (!this.secretKey) throw new Error('No secretKey available for token request');
    }
    const tokenUrl = `${this.httpBase}/oauth/token`;
    const body = new URLSearchParams({
      client_id: this.serialNumber,
      client_secret: this.secretKey,
      grant_type: 'client_credentials'
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Token request failed: ${res.status} ${txt}`);
    }
    const json = await res.json();
    if (!json.access_token) throw new Error('token response missing access_token');
    this.accessToken = json.access_token;
    // try to set expiry from expires_in
    const expiresIn = json.expires_in ? Number(json.expires_in) * 1000 : 60 * 60 * 1000;
    this.tokenExpiresAt = Date.now() + expiresIn;
    this.logger.info('Obtained access token, expires in (ms):', expiresIn);
    return this.accessToken;
  }

  // ---------------------------
  // WebSocket connect / reconnect
  // ---------------------------
  async connect() {
    this._shouldReconnect = true;
    await this._connectOnce();
  }

  async disconnect() {
    this._shouldReconnect = false;
    if (this.ws) {
      try { this.ws.close(1000, 'client_disconnect'); } catch (e) {}
      this.ws = null;
    }
    this.connected = false;
  }

  async _connectOnce() {
    try {
      await this.obtainToken();

      // build ws with Authorization header
      const headers = { Authorization: `Bearer ${this.accessToken}` };
      this.logger.info('Connecting WS ->', this.wsUrl);
      const ws = new WebSocket(this.wsUrl, { headers });

      this.ws = ws;

      ws.on('open', async () => {
        this.logger.info('WebSocket opened');
        this.connected = true;
        this._backoffMs = 1000; // reset backoff
        this.emit('connected');

        // Immediately send machineInfo to fetch ids (per spec)
        try {
          await this.send({ clientId: this.serialNumber, type: 'machineInfo', body: {} });
          this.logger.debug('machineInfo requested');
        } catch (e) {
          this.logger.error('machineInfo send error', e);
        }

        if (this.autoSyncOnConnect) {
          // optionally run base product request and matrix sync flows:
          try {
            await this.requestBaseProducts();
            this.emit('products', Array.from(this.productCache.values()));
          } catch (e) {
            this.logger.warn('Base products sync failed on connect:', e.message);
          }
        }
      });

      ws.on('message', (data) => {
        let obj;
        try {
          obj = JSON.parse(data.toString());
        } catch (e) {
          this.logger.error('Invalid JSON from WS:', data.toString());
          this.emit('error', new Error('Invalid JSON from WS'));
          return;
        }
        this._onMessage(obj);
      });

      ws.on('close', (code, reason) => {
        this.logger.warn('WS closed', code, reason && reason.toString());
        this.connected = false;
        this.emit('disconnected', { code, reason });
        if (this._shouldReconnect) this._reconnectLoop();
      });

      ws.on('error', (err) => {
        this.logger.error('WS error', err);
        this.emit('error', err);
        // ws will emit close after error; reconnection handled there
      });
    } catch (err) {
      this.logger.error('Connect failed:', err.message);
      this.emit('error', err);
      if (this._shouldReconnect) this._reconnectLoop();
    }
  }

  async _reconnectLoop() {
    const backoff = this._backoffMs;
    this.logger.info(`Reconnecting in ${backoff} ms...`);
    await sleep(backoff);
    this._backoffMs = Math.min(this._backoffMs * 2, this._maxBackoffMs);
    if (!this._shouldReconnect) return;
    await this._connectOnce();
  }

  // ---------------------------
  // Low-level send
  // ---------------------------
  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WS not connected');
    }
    const json = JSON.stringify(payload);
    this.logger.debug('WS send:', json);
    this.ws.send(json);
  }

  // helper: fire-and-forget with optional promise ack (not required by spec)
  async sendAndWaitAck(payload, timeout = 5000) {
    // create requestUuid if absent
    if (!payload.body) payload.body = {};
    if (!payload.body.requestUuid) payload.body.requestUuid = cryptoUUID();
    const reqId = payload.body.requestUuid;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(reqId);
        reject(new Error('Ack timeout'));
      }, timeout);
      this._pendingRequests.set(reqId, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      try {
        this.send(payload);
      } catch (err) {
        clearTimeout(timer);
        this._pendingRequests.delete(reqId);
        reject(err);
      }
    });
  }

  // ---------------------------
  // Message handling
  // ---------------------------
  _onMessage(msg) {
    // Basic shape: { clientId, type, body }
    const type = msg.type;
    this.logger.debug('Incoming msg type=', type);

    switch (type) {
      case 'machineInfo':
        // server response with machineId, organizationId, modelId, serialNumber
        this.machineInfo = msg.body;
        this.emit('machineInfo', this.machineInfo);
        break;

      case 'baseProductRequestExportTopic':
        // body: array of products
        if (Array.isArray(msg.body)) {
          for (const p of msg.body) {
            this.productCache.set(String(p.id), p);
          }
          this.emit('products', Array.from(this.productCache.values()));
        }
        break;

      case 'cellStoreExportSnack':
        // push from server with array of changed cells -> authoritative snapshot for those cells
        if (Array.isArray(msg.body)) {
          // emit event for client to apply atomically
          this.emit('pushCells', msg.body);
        }
        break;

      case 'cellVolumeExportSnack':
      case 'snackTopicRes':
        // could be acks to requests containing requestUuid
        this._maybeResolvePending(msg);
        this.emit('ack', msg);
        break;

      default:
        // Sales responses/ecxeptions etc.
        this._maybeResolvePending(msg);
        this.emit('message', msg);
    }
  }

  _maybeResolvePending(msg) {
    // try to find requestUuid in body and resolve pending promise
    const b = msg.body;
    if (!b) return;
    const id = b.requestUuid ?? (Array.isArray(b) && b[0] && b[0].requestUuid) ?? null;
    if (id && this._pendingRequests.has(id)) {
      const p = this._pendingRequests.get(id);
      p.resolve(msg);
      this._pendingRequests.delete(id);
    }
  }

  // ---------------------------
  // High-level API methods (per spec)
  // ---------------------------

  /**
   * Request base product catalog (baseProductRequestExportTopic).
   * Caches results in this.productCache
   */
  async requestBaseProducts() {
    const payload = {
      clientId: this.serialNumber,
      type: 'baseProductRequestExportTopic',
      body: { machineId: this.machineInfo?.id ?? null, organizationId: this.machineInfo?.organizationId ?? null }
    };
    // Fire-and-wait for response: some servers respond with same type
    try {
      await this.sendAndWaitAck(payload, 8000);
    } catch (e) {
      // fallback: send and rely on incoming push of same type
      this.logger.debug('Base products request: wait-ack failed, falling back to fire-and-forget');
      this.send(payload);
    }
  }

  /**
   * Send full matrix snapshot (matrixImportTopicSnack)
   * matrix — array of cell objects per spec. Must validate unique cellNumber
   */
  async importMatrix({ requestUuid = cryptoUUID(), machineId = this.machineInfo?.id, matrix = [] } = {}) {
    // local validation
    validateMatrixClientSide(matrix);

    const payload = {
      clientId: this.serialNumber,
      type: 'matrixImportTopicSnack',
      body: { requestUuid, machineId, matrix }
    };
    return this.sendAndWaitAck(payload, 10_000).catch((e) => {
      // If server returns detailed errors, that will be in msg; here we bubble up
      throw e;
    });
  }

  /**
   * Partial cell updates (cellStoreImportTopicSnack)
   * cells: array {cellNumber, price, goodId, size, volume, maxVolume}
   */
  async updateCells({ requestUuid = cryptoUUID(), machineId = this.machineInfo?.id, cells = [] } = {}) {
    if (!Array.isArray(cells) || cells.length === 0) throw new Error('cells array required');
    // validate cellNumbers exist locally (spec recommends server-side validation; we do best-effort)
    const seen = new Set();
    for (const c of cells) {
      if (seen.has(c.cellNumber)) throw new Error(`Duplicate cellNumber in payload: ${c.cellNumber}`);
      seen.add(c.cellNumber);
      if (typeof c.volume !== 'undefined' && typeof c.maxVolume !== 'undefined' && c.volume > c.maxVolume) {
        this.logger.warn(`Volume > maxVolume for cell ${c.cellNumber}`);
      }
    }
    const payload = {
      clientId: this.serialNumber,
      type: 'cellStoreImportTopicSnack',
      body: { requestUuid, machineId, cells }
    };
    return this.sendAndWaitAck(payload, 8000);
  }

  /**
   * Quick volume update (cellVolumeImportTopicSnack)
   * cells: array {cellNumber, volume}
   */
  async updateVolumes({ requestUuid = cryptoUUID(), machineId = this.machineInfo?.id, cells = [] } = {}) {
    if (!Array.isArray(cells) || cells.length === 0) throw new Error('cells array required');
    for (const c of cells) {
      if (c.volume < 0) throw new Error('volume must be >= 0');
    }
    const payload = {
      clientId: this.serialNumber,
      type: 'cellVolumeImportTopicSnack',
      body: { requestUuid, machineId, cells }
    };
    // server is expected to reply with cellVolumeExportSnack array (which _may_ resolve pending)
    return this.sendAndWaitAck(payload, 8000);
  }

  /**
   * Send sale (saleImportTopicSnack)
   * sale object or array of sale objects
   */
  async reportSale(sale) {
    // sale must contain saleUuid, dateSale (ISO), totalPrice, payments, writeOffs.cellNumber/goodId
    const saleObj = Array.isArray(sale) ? sale : [sale];
    for (const s of saleObj) {
      if (!s.saleUuid) s.saleUuid = cryptoUUID();
      if (!s.dateSale) s.dateSale = new Date().toISOString();
      if (typeof s.totalPrice === 'undefined') throw new Error('totalPrice required');
      // simple sum check
      if (s.payments) {
        const sum = (Array.isArray(s.payments) ? s.payments : [s.payments]).reduce((a, p) => a + (p.price ?? 0), 0);
        if (Math.abs(sum - s.totalPrice) > 0.01) {
          this.logger.warn('payments sum mismatches totalPrice');
        }
      }
    }
    const payload = {
      clientId: this.serialNumber,
      type: 'saleImportTopicSnack',
      body: saleObj
    };
    // sale responses are idempotent by saleUuid on server side
    try {
      return await this.sendAndWaitAck(payload, 8000);
    } catch (e) {
      // If ack not provided, still return; caller can dedupe by saleUuid
      this.logger.debug('sale send ack failed:', e.message);
      this.send(payload);
      return null;
    }
  }

  // ---------------------------
  // Utilities
  // ---------------------------
  getProduct(goodId) {
    return this.productCache.get(String(goodId)) ?? null;
  }

  // For external use: apply pushCells atomically: subscribe to 'pushCells' event
  // Example:
  // client.on('pushCells', async (cells) => { applyAtomically(cells) })
}

// ---------------------------
// Helper functions and validators
// ---------------------------
function cryptoUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validateMatrixClientSide(matrix) {
  if (!Array.isArray(matrix)) throw new Error('matrix must be array');
  const seen = new Set();
  for (const item of matrix) {
    if (typeof item.cellNumber !== 'number') throw new Error('cell.cellNumber must be number');
    if (seen.has(item.cellNumber)) throw new Error(`Duplicate cellNumber in matrix: ${item.cellNumber}`);
    seen.add(item.cellNumber);
    if (typeof item.volume !== 'number') throw new Error(`cell ${item.cellNumber} missing volume`);
    if (typeof item.maxVolume === 'number' && item.volume > item.maxVolume) {
      // client-side should not send overflow, warn
      throw new Error(`cell ${item.cellNumber} volume > maxVolume`);
    }
  }
}

export default ShakerTelemetryClient;
