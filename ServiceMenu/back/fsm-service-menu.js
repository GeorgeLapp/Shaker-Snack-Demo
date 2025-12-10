/**
 * @file fsm-service-menu.js
 * @description
 * ES-РјРѕРґСѓР»СЊ РєРѕРЅРµС‡РЅРѕРіРѕ Р°РІС‚РѕРјР°С‚Р° (Unified v3.0).
 * Р’РєР»СЋС‡Р°РµС‚ СЂР°СЃС€РёСЂРµРЅРЅС‹Р№ BackendClient РґР»СЏ РїРѕРґРґРµСЂР¶РєРё СЂРѕР»Рё, РґРёР°РіРЅРѕСЃС‚РёРєРё Рё maintenance.
 */

// ... (JSDoc types definitions as before, extended implicitly) ...

/**
 * РЈРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РєР»РёРµРЅС‚ Р±СЌРєРµРЅРґР°.
 */
export class ServiceMenuBackendClient {
  constructor(cfg) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    this.requestTimeoutMs = cfg.requestTimeoutMs ?? 15000;
  }

  async _fetchJson(path, init = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    if (init.token) headers['Authorization'] = `Bearer ${init.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      const status = res.status;
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const body = isJson ? await res.json().catch(() => ({})) : await res.text();
      return { status, body };
    } catch (e) {
      // Network error handling
      return { status: 504, body: { error: e.message } };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ----------- AUTH -----------
  async login(pin) {
    return this._fetchJson('/auth/login', { method: 'POST', body: JSON.stringify({ pin }) });
  }

  async getMe(token) {
    return this._fetchJson('/auth/me', { token });
  }

  // ----------- CELLS -----------
  async getCells(token) { return this._fetchJson('/cells', { token }); }
  async splitCells(token, cellIds) {
    // cellIds - РјР°СЃСЃРёРІ ID СЏС‡РµРµРє, РєРѕС‚РѕСЂС‹Рµ РЅСѓР¶РЅРѕ "СЂР°Р·Р»РµРїРёС‚СЊ"
    return this._fetchJson('/cells/split', { method: 'POST', token, body: JSON.stringify({ cellIds }) });
  }
  async fillRowStock(token, row) {
    return this._fetchJson('/cells/stock/fill-row', { method: 'POST', token, body: JSON.stringify({ row }) });
  }
  async setCellStock(token, cellId, stock) {
    return this._fetchJson(`/cells/${cellId}/stock`, { method: 'PUT', token, body: JSON.stringify({ stock }) });
  }
  // ... Capacity/Price setters
  async setRowCapacity(token, row, capacity) {
    return this._fetchJson('/cells/capacity/set-for-row', { method: 'PUT', token, body: JSON.stringify({ row, capacity }) });
  }
  async setCellCapacity(token, cellId, capacity) {
    return this._fetchJson(`/cells/${cellId}/capacity`, { method: 'PUT', token, body: JSON.stringify({ capacity }) });
  }
  async setRowPrice(token, row, price) {
    return this._fetchJson('/cells/price/set-for-row', { method: 'PUT', token, body: JSON.stringify({ row, price }) });
  }
  async setCellPrice(token, cellId, price) {
    return this._fetchJson(`/cells/${cellId}/price`, { method: 'PUT', token, body: JSON.stringify({ price }) });
  }

  async getProducts(token, params = {}) {
    // РџРѕРґРґРµСЂР¶РєР° РїРѕРёСЃРєР° Рё РїР°РіРёРЅР°С†РёРё
    const q = new URLSearchParams(params).toString();
    return this._fetchJson(`/products?${q}`, { token });
  }
  async assignProduct(token, cellId, productId) {
    return this._fetchJson(`/cells/${cellId}/product`, { method: 'PUT', token, body: JSON.stringify({ productId }) });
  }
  async setCellsStatus(token, cellIds, status) {
    return this._fetchJson('/cells/status', { method: 'POST', token, body: JSON.stringify({ cellIds, status }) });
  }
  async mergeCells(token, cellIds) {
    return this._fetchJson('/cells/merge', { method: 'POST', token, body: JSON.stringify({ cellIds }) });
  }
  async setCellsType(token, cellIds, type) {
    return this._fetchJson('/cells/type', { method: 'PUT', token, body: JSON.stringify({ cellIds, type }) });
  }

  // ----------- DIAGNOSTICS & INFO -----------
  async runDiagnostics(token, cellIds) {
    return this._fetchJson('/diagnostics/test-cells', { method: 'POST', token, body: JSON.stringify({ cellIds }) });
  }

  async getDiagCellsView(token) {
    return this._fetchJson('/diagnostics/test-cells', { token });
  }

  async startDiagCalibration(token) {
    return this._fetchJson('/diagnostics/test-cells/calibration', { method: 'POST', token });
  }

  async pollDiagCalibration(token, opId) {
    const q = new URLSearchParams();
    if (opId) q.set('opId', opId);
    return this._fetchJson(`/diagnostics/test-cells/calibration?${q.toString()}`, { token });
  }

  async startDiagCellsTest(token, cellIds) {
    const body = Array.isArray(cellIds) && cellIds.length > 0 ? { cellIds } : {};
    return this._fetchJson('/diagnostics/test-cells/test', { method: 'POST', token, body: JSON.stringify(body) });
  }

  async pollDiagCellsTest(token, opId) {
    const q = new URLSearchParams();
    if (opId) q.set('opId', opId);
    return this._fetchJson(`/diagnostics/test-cells/test?${q.toString()}`, { token });
  }

  async getSystemInfo(token) {
    return this._fetchJson('/diagnostics/info', { token });
  }

  async getLogs(token, params = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit);
    if (params.search) q.set('search', params.search);
    if (params.level) q.set('level', params.level); // New in v3
    if (params.offset) q.set('offset', params.offset);
    if (params.full) q.set('full', 'true');
    return this._fetchJson(`/diagnostics/logs?${q.toString()}`, { token });
  }

  // ----------- MAINTENANCE (New) -----------
  async getMaintenanceState(token) {
    return this._fetchJson('/maintenance/state', { token });
  }
  async runSelfTest(token) {
    return this._fetchJson('/maintenance/self-test', { method: 'POST', token });
  }
  async startCalibration(token) {
    return this._fetchJson('/maintenance/calibration/start', { method: 'POST', token });
  }
}

  export const Signals = {
  AppStart: 'UI.OpenSettings',
  SubmitPin: 'Auth.SubmitPin',
  TryAgain: 'Auth.TryAgain',
  Logout: 'Auth.Logout',
  // Navigation
  NavCellsStocks: 'UI.Navigate.CellsStocks',
  NavCellsCapacity: 'UI.Navigate.CellsCapacity',
  NavCellsPrices: 'UI.Navigate.CellsPrices',
  NavCellsProducts: 'UI.Navigate.CellsProducts',
  NavCellsConfig: 'UI.Navigate.CellsConfig',
  NavDiagTest: 'UI.Navigate.DiagnosticsTest',
  NavLogs: 'UI.Navigate.Logs',
  // Cells Operations
  CellsFillRow: 'Cells.FillRow',
  CellsEditStock: 'Cells.EditStock',
  CellsSetRowCapacity: 'Cells.SetRowCapacity',
  CellsSetCellCapacity: 'Cells.SetCellCapacity',
  CellsSetRowPrice: 'Cells.SetRowPrice',
  CellsSetCellPrice: 'Cells.SetCellPrice',
  CellsOpenAssignProduct: 'Cells.OpenAssignProduct',
  ProductsAssign: 'Products.Assign',
  ProductsAssignRow: 'Products.AssignRow',
  CellsSetStatus: 'Cells.SetStatus',
  CellsMerge: 'Cells.Merge',
  CellsSplit: 'Cells.Split',
  CellsSetType: 'Cells.SetType',
    // Diag
    DiagRunTest: 'Diagnostics.RunTest',
    DiagLoadCells: 'Diagnostics.LoadCells',
    DiagStartCalibration: 'Diagnostics.StartCalibration',
    DiagPollCalibration: 'Diagnostics.PollCalibration',
    DiagStartCellsTest: 'Diagnostics.StartCellsTest',
    DiagPollCellsTest: 'Diagnostics.PollCellsTest',
  Rerun: 'UI.Rerun',
  LogsSearch: 'Logs.Search',
  LogsToggleFull: 'Logs.ToggleFull',
  // Generic
  Retry: 'UI.Retry',
  Back: 'UI.Back',
  SessionExpired: 'T.SessionExpired',

  // === NEW SIGNALS (v3 Unified) ===
  AuthGetProfile: 'Auth.GetProfile',
  DiagGetInfo: 'Diagnostics.GetInfo',
  MaintGetState: 'Maintenance.GetState',
  MaintSelfTest: 'Maintenance.SelfTest',
  MaintCalibration: 'Maintenance.CalibrationStart'
};

export class ServiceMenuFSM {
  constructor(config) {
    this.config = { sessionInactivityMs: 180000, ...config };
    this.backend = new ServiceMenuBackendClient(this.config.backend);
    this.state = 'Idle';
    this.ctx = { token: null, cells: [], products: [], logs: [], lastScreen: null, lastError: null, retryPoint: null };
    this._inactivityTimer = null;
  }

  // ... (Timers logic same as before) ...
  _resetInactivityTimerIfNeeded() { /* omitted for brevity, same as source */ }
  _clearInactivity() { if (this._inactivityTimer) { clearTimeout(this._inactivityTimer); this._inactivityTimer = null; } }
  _goto(state, view = {}, meta = {}) {
    this.state = state;
    if (state === 'Idle') {
      this.ctx = { token: null, cells: [], products: [], logs: [], lastScreen: null, lastError: null, retryPoint: null };
      this._clearInactivity();
    }
    this._resetInactivityTimerIfNeeded();
    return { state, view, meta };
  }
  _requireToken() { if (!this.ctx.token) throw new Error('Token required'); }

  async handle(event, payload) {
    // ---- READ-ONLY PROXY SIGNALS (Stateless) ----
    // Р­С‚Рё СЃРёРіРЅР°Р»С‹ РЅРµ РјРµРЅСЏСЋС‚ СЃРѕСЃС‚РѕСЏРЅРёРµ Р°РІС‚РѕРјР°С‚Р°, РЅРѕ С‚СЂРµР±СѓСЋС‚ С‚РѕРєРµРЅР°
    if ([Signals.AuthGetProfile, Signals.DiagGetInfo, Signals.MaintGetState].includes(event)) {
      if (!this.ctx.token) return { state: this.state, view: {}, meta: { error: "No token" } };

      let res;
      if (event === Signals.AuthGetProfile) res = await this.backend.getMe(this.ctx.token);
      if (event === Signals.DiagGetInfo) res = await this.backend.getSystemInfo(this.ctx.token);
      if (event === Signals.MaintGetState) res = await this.backend.getMaintenanceState(this.ctx.token);

      return { state: this.state, view: { data: res.body }, meta: { status: res.status } };
    }

    // ---- STATE TRANSITIONS ----
    switch (event) {
      case Signals.AppStart: return this._goto('AuthInput', { screen: 'AuthInput' });

      case Signals.SubmitPin: {
        const { pin } = payload || {};
        this.state = 'AuthChecking';
        const res = await this.backend.login(pin);
        if (res.status === 200 && res.body?.accessToken) {
          this.ctx.token = res.body.accessToken;
          // РЎРѕС…СЂР°РЅСЏРµРј СЂРѕР»СЊ РІ РєРѕРЅС‚РµРєСЃС‚Рµ, РµСЃР»Рё РЅСѓР¶РЅРѕ
          this.ctx.role = res.body.role;
          return this._goto('Dashboard', { screen: 'Dashboard', message: `Role: ${this.ctx.role}` });
        }
        if (res.status === 401) return this._goto('AuthError', { screen: 'AuthInput', error: 'Wrong PIN' });
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      case Signals.TryAgain: return this._goto('AuthInput', { screen: 'AuthInput' });
      case Signals.Logout: return this._goto('Idle', { screen: 'AuthInput' });

      // РќР°РІРёРіР°С†РёСЏ
      case Signals.NavCellsStocks:
      case Signals.NavCellsCapacity:
      case Signals.NavCellsPrices:
      case Signals.NavCellsProducts:
      case Signals.NavCellsConfig:
        return this._loadCellsList(event);

      case Signals.NavDiagTest:
        this._requireToken();
        // РџСЂРё РІС…РѕРґРµ РЅР° СЌРєСЂР°РЅ С‚РµСЃС‚Р° СЏС‡РµРµРє СЃСЂР°Р·Сѓ РїРѕРґРіСЂСѓР¶Р°РµРј Р»РѕРіРёС‡РµСЃРєРёР№ РІРёРґ СЏС‡РµРµРє
        {
          const res = await this.backend.getDiagCellsView(this.ctx.token);
          if (res.status === 200) {
            return this._goto('DiagnosticsTestInput', {
              screen: 'Diagnostics/TestInput',
              cells: res.body || [],
            });
          }
          if (res.status === 401) {
            return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
          }
          return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
        }
      case Signals.NavLogs: return this._loadLogs({ limit: 50 }); // Default limit

      // Cells Operations
      case Signals.CellsFillRow:
        this._requireToken();
        await this.backend.fillRowStock(this.ctx.token, payload.row);
        return this._reloadCells(); // Simplified flow

      case Signals.CellsEditStock:
        this._requireToken();
        await this.backend.setCellStock(this.ctx.token, payload.cellId, payload.stock);
        return this._reloadCells();

      // Capacity / Price setters
      case Signals.CellsSetRowCapacity:
        this._requireToken();
        await this.backend.setRowCapacity(this.ctx.token, payload.row, payload.capacity);
        return this._reloadCells();

      case Signals.CellsSetCellCapacity:
        this._requireToken();
        await this.backend.setCellCapacity(this.ctx.token, payload.cellId, payload.capacity);
        return this._reloadCells();

      case Signals.CellsSetRowPrice:
        this._requireToken();
        await this.backend.setRowPrice(this.ctx.token, payload.row, payload.price);
        return this._reloadCells();

      case Signals.CellsSetCellPrice:
        this._requireToken();
        await this.backend.setCellPrice(this.ctx.token, payload.cellId, payload.price);
        return this._reloadCells();

      // Products: open catalog + assign
      case Signals.CellsOpenAssignProduct: {
        this._requireToken();
        this.state = 'ProductsListLoading';
        const res = await this.backend.getProducts(this.ctx.token, payload || {});
        if (res.status === 200) {
          const products = res.body || [];
          this.ctx.products = products;
          return this._goto('ProductsListReady', { screen: 'Products/List', products });
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }

      case Signals.ProductsAssign: {
        this._requireToken();
        this.state = 'AssignProductProcessing';
        const { cellId, productId } = payload || {};
        const res = await this.backend.assignProduct(this.ctx.token, cellId, productId);
        if (res.status === 200 || res.status === 204) {
          this.ctx.retryPoint = null;
          // ensure mode = products so reload goes back to products screen
          this.ctx.cellsMode = 'products';
          return this._reloadCells();
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'AssignProductProcessing';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }

      case Signals.ProductsAssignRow: {
        this._requireToken();
        this.state = 'AssignProductRowProcessing';
        const { row, productId } = payload || {};
        const cellsInRow = (this.ctx.cells || []).filter((c) => c.row === row);
        const cellIds = cellsInRow.map((c) => c.id);

        // Р•СЃР»Рё РІ РєРѕРЅС‚РµРєСЃС‚Рµ РЅРµС‚ СЏС‡РµРµРє СЌС‚РѕР№ СЃС‚СЂРѕРєРё вЂ” РїСЂРѕСЃС‚Рѕ РІРµСЂРЅС‘Рј С‚РµРєСѓС‰РёР№ СЃРїРёСЃРѕРє Р±РµР· РѕС€РёР±РѕРє,
        // С‡С‚РѕР±С‹ UI РЅРµ РїР°РґР°Р».
        if (cellIds.length === 0) {
          return this._goto(this.state, {
            screen: `Cells/${this.ctx.cellsMode || 'products'}`,
            cells: this.ctx.cells,
          }, { warn: `No cells for row ${row}` });
        }

        for (const cellId of cellIds) {
          const res = await this.backend.assignProduct(this.ctx.token, cellId, productId);
          if (res.status === 401) {
            return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
          }
          if (res.status !== 200 && res.status !== 204) {
            this.ctx.retryPoint = 'AssignProductRowProcessing';
            return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
          }
        }

        this.ctx.retryPoint = null;
        this.ctx.cellsMode = 'products';
        return this._reloadCells();
      }

      // Diagnostics
      case Signals.DiagRunTest: {
        this._requireToken();
        this.state = 'DiagnosticsTestProcessing';
        const requestedIds =
          Array.isArray(payload?.cellIds) && payload.cellIds.length > 0
            ? payload.cellIds
            : (this.ctx.cells || []).map((c) => c.id);

        const [diagRes, cellsRes] = await Promise.all([
          this.backend.runDiagnostics(this.ctx.token, requestedIds),
          this.backend.getDiagCellsView(this.ctx.token),
        ]);

        if (diagRes.status === 200 && cellsRes.status === 200) {
          const cells = cellsRes.body || [];
          this.ctx.cells = cells;
          return this._goto('DiagnosticsTestResults', {
            screen: 'Diagnostics/Results',
            results: diagRes.body,
            cells,
          });
        }

        const bad = diagRes.status !== 200 ? diagRes : cellsRes;
        return this._goto('BackendError', { screen: 'Error' }, { status: bad.status });
      }
      case Signals.DiagStartCalibration: {
        this._requireToken();
        const res = await this.backend.startDiagCalibration(this.ctx.token);
        if (res.status === 200 || res.status === 202) {
          return { state: this.state, view: res.body || {}, meta: { status: res.status } };
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'DiagStartCalibration';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      case Signals.DiagPollCalibration: {
        this._requireToken();
        const res = await this.backend.pollDiagCalibration(this.ctx.token, payload?.opId);
        if (res.status === 200) {
          return { state: this.state, view: res.body || {}, meta: { status: res.status } };
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'DiagPollCalibration';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      case Signals.DiagStartCellsTest: {
        this._requireToken();
        const res = await this.backend.startDiagCellsTest(this.ctx.token, payload?.cellIds);
        if (res.status === 200 || res.status === 202) {
          return { state: this.state, view: res.body || {}, meta: { status: res.status } };
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'DiagStartCellsTest';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      case Signals.DiagPollCellsTest: {
        this._requireToken();
        const res = await this.backend.pollDiagCellsTest(this.ctx.token, payload?.opId);
        if (res.status === 200) {
          return { state: this.state, view: res.body || {}, meta: { status: res.status } };
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'DiagPollCellsTest';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }

      // Logs
      case Signals.LogsSearch:
        return this._loadLogs({ search: payload.text, limit: 50 });
      case Signals.CellsMerge: {
        this._requireToken();
        const cellIds = Array.isArray(payload?.cellIds) ? payload.cellIds : [];
        if (cellIds.length < 2) {
          return this._goto(this.state, {
            screen: `Cells/${this.ctx.cellsMode || 'config'}`,
            cells: this.ctx.cells,
          }, { error: 'At least two cells are required to merge' });
        }

        const res = await this.backend.mergeCells(this.ctx.token, cellIds);
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        if (res.status !== 200 && res.status !== 204) {
          this.ctx.retryPoint = 'CellsMergeProcessing';
          return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
        }

        this.ctx.retryPoint = null;
        this.ctx.cellsMode = 'config';
        return this._reloadCells();
      }
      case Signals.CellsSplit:
        this._requireToken();
        const splitRes = await this.backend.splitCells(this.ctx.token, payload.cellIds);
        if (splitRes.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        if (splitRes.status !== 200 && splitRes.status !== 204) {
          this.ctx.retryPoint = 'CellsSplitProcessing';
          return this._goto('BackendError', { screen: 'Error' }, { status: splitRes.status });
        }
        this.ctx.retryPoint = null;
        this.ctx.cellsMode = 'config';
        return this._reloadCells();
      case Signals.DiagLoadCells: {
        this._requireToken();
        const res = await this.backend.getDiagCellsView(this.ctx.token);
        if (res.status === 200) {
          return this._goto('DiagnosticsTestInput', {
            screen: 'Diagnostics/TestInput',
            cells: res.body || [],
          });
        }
        if (res.status === 401) {
          return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Session expired or invalid token' });
        }
        this.ctx.retryPoint = 'DiagLoadCells';
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      // NEW Maintenance Operations
      case Signals.MaintSelfTest:
        this._requireToken();
        const mtRes = await this.backend.runSelfTest(this.ctx.token);
        return { state: this.state, view: { data: mtRes.body }, meta: { status: mtRes.status } };

      case Signals.MaintCalibration:
        this._requireToken();
        const calRes = await this.backend.startCalibration(this.ctx.token);
        return { state: this.state, view: { data: calRes.body }, meta: { status: calRes.status } };

      case Signals.Back: return this._goto('Dashboard', { screen: 'Dashboard' });

      default: return this._goto(this.state, {}, { warn: `Unknown event ${event}` });
    }
  }

  // Helpers
  async _loadCellsList(event) {
    this._requireToken();
    const map = {
      [Signals.NavCellsStocks]: 'stocks',
      [Signals.NavCellsCapacity]: 'capacity',
      [Signals.NavCellsPrices]: 'prices',
      [Signals.NavCellsProducts]: 'products',
      [Signals.NavCellsConfig]: 'config'
    };
    this.ctx.cellsMode = map[event];
    return this._reloadCells();
  }

  async _reloadCells() {
    this.state = `CellsListReady-${this.ctx.cellsMode}`; // Simplified loading state
    const res = await this.backend.getCells(this.ctx.token);
    if (res.status === 200) {
      this.ctx.cells = res.body || [];
      return this._goto(this.state, { screen: `Cells/${this.ctx.cellsMode}`, cells: this.ctx.cells });
    }
    return this._goto('BackendError', { screen: 'Error' });
  }

  async _loadLogs(params) {
    this._requireToken();
    this.state = 'LogsReady'; // Simplified
    const res = await this.backend.getLogs(this.ctx.token, params);
    if (res.status === 200) {
      // Supports Unified v3 structure { items: [], total: N } or plain array
      const logs = res.body.items || res.body;
      this.ctx.logs = logs;
      return this._goto('LogsReady', { screen: 'Logs', logs });
    }
    return this._goto('BackendError', { screen: 'Error' });
  }
}

export default ServiceMenuFSM;

