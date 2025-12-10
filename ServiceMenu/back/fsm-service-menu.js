/**
 * @file fsm-service-menu.js
 * @description
 * ES-модуль конечного автомата (Unified v3.0).
 * Включает расширенный BackendClient для поддержки роли, диагностики и maintenance.
 */

// ... (JSDoc types definitions as before, extended implicitly) ...

/**
 * Универсальный клиент бэкенда.
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
    // cellIds - массив ID ячеек, которые нужно "разлепить"
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
    // Поддержка поиска и пагинации
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
  ProductsAssignProductsAssign: 'Products.Assign',
  ProductsAssignRow: 'Products.AssignRow',
  CellsSetStatus: 'Cells.SetStatus',
  CellsMerge: 'Cells.Merge',
  CellsSplit: 'Cells.Split',
  CellsSetType: 'Cells.SetType',
  // Diag
  DiagRunTest: 'Diagnostics.RunTest',
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
    // Эти сигналы не меняют состояние автомата, но требуют токена
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
          // Сохраняем роль в контексте, если нужно
          this.ctx.role = res.body.role;
          return this._goto('Dashboard', { screen: 'Dashboard', message: `Role: ${this.ctx.role}` });
        }
        if (res.status === 401) return this._goto('AuthError', { screen: 'AuthInput', error: 'Wrong PIN' });
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });
      }
      case Signals.TryAgain: return this._goto('AuthInput', { screen: 'AuthInput' });
      case Signals.Logout: return this._goto('Idle', { screen: 'AuthInput' });

      // Навигация
      case Signals.NavCellsStocks:
      case Signals.NavCellsCapacity:
      case Signals.NavCellsPrices:
      case Signals.NavCellsProducts:
      case Signals.NavCellsConfig:
        return this._loadCellsList(event);

      case Signals.NavDiagTest: return this._goto('DiagnosticsTestInput', { screen: 'Diagnostics/TestInput' });
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

      // ... other setters (Prices, Capacity) logic similar to EditStock ...

      // Diagnostics
      case Signals.DiagRunTest:
        this._requireToken();
        this.state = 'DiagnosticsTestProcessing';
        const res = await this.backend.runDiagnostics(this.ctx.token, payload.cellIds);
        if (res.status === 200) {
          return this._goto('DiagnosticsTestResults', { screen: 'Diagnostics/Results', results: res.body });
        }
        return this._goto('BackendError', { screen: 'Error' }, { status: res.status });

      // Logs
      case Signals.LogsSearch:
        return this._loadLogs({ search: payload.text, limit: 50 });
      case Signals.CellsSplit:
        this._requireToken();
        // Вызываем бэкенд для разделения
        await this.backend.splitCells(this.ctx.token, payload.cellIds);
        return this._reloadCells(); // Перезагружаем список, чтобы увидеть изменения
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