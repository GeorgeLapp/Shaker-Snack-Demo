/**
 * @file fsm-service-menu.js
 * @description
 *  ES-модуль конечного автомата пользовательской сессии сервисного меню.
 *  Архитектура: BFF -> FSM -> Backend. FSM не знает о UI, он принимает события
 *  от BFF и синхронно/асинхронно вызывает основной бэкенд (REST).
 *
 *  Особенности:
 *   - Чёткие состояния из согласованной таблицы
 *   - Тайм-аут бездействия (SessionTimeout -> Idle)
 *   - Унифицированная обработка 401 (TokenInvalid -> AuthInput)
 *   - Унифицированная обработка 4xx/5xx (BackendError с retryPoint)
 *   - Комментарии и примеры интеграции с BFF
 */

/** @typedef {'Idle'|'AuthInput'|'AuthChecking'|'AuthError'|'Dashboard'
 *  |'CellsListLoading'|'CellsListReady-stocks'|'CellsListReady-capacity'|'CellsListReady-prices'|'CellsListReady-products'|'CellsListReady-config'
 *  |'FillRowProcessing'|'UpdateCellStockProcessing'
 *  |'SetRowCapacityProcessing'|'SetCellCapacityProcessing'
 *  |'SetRowPriceProcessing'|'SetCellPriceProcessing'
 *  |'ProductsListLoading'|'ProductsListReady'|'AssignProductProcessing'
 *  |'CellsStatusProcessing'|'CellsMergeProcessing'|'CellsTypeProcessing'
 *  |'CellsListReload'
 *  |'DiagnosticsTestInput'|'DiagnosticsTestProcessing'|'DiagnosticsTestResults'
 *  |'LogsLoading'|'LogsReady'
 *  |'TokenInvalid'|'BackendError'|'SessionTimeout'} FsmState */

/** @typedef {'UI.OpenSettings'
 * |'Auth.SubmitPin'|'Auth.TryAgain'|'Auth.Logout'
 * |'UI.Navigate.CellsStocks'|'UI.Navigate.CellsCapacity'|'UI.Navigate.CellsPrices'|'UI.Navigate.CellsProducts'|'UI.Navigate.CellsConfig'
 * |'UI.Navigate.DiagnosticsTest'|'UI.Navigate.Logs'
 * |'Cells.FillRow'|'Cells.EditStock'|'Cells.SetRowCapacity'|'Cells.SetCellCapacity'|'Cells.SetRowPrice'|'Cells.SetCellPrice'
 * |'Cells.OpenAssignProduct'|'Products.Assign'
 * |'Cells.SetStatus'|'Cells.Merge'|'Cells.SetType'
 * |'Diagnostics.RunTest'|'UI.Rerun'
 * |'Logs.Search'|'Logs.ToggleFull'
 * |'UI.Retry'|'UI.Back'
 * |'T.SessionExpired'
 * |'__Backend.200'|'__Backend.204'|'__Backend.401'|'__Backend.4xx5xx'} FsmEvent */

/** @typedef {{ id: number, row: number, capacity?: number, stock?: number, price?: number, productId?: number, status?: 'enabled'|'disabled', type?: string }} CellDto */
/** @typedef {{ id: number, name: string }} ProductDto */
/** @typedef {{ ts: string, level: string, msg: string }} LogEntryDto */

/**
 * @typedef {Object} BackendConfig
 * @property {string} baseUrl - Базовый URL основного бэкенда (например, http://localhost:8080/api/v1)
 * @property {number} [requestTimeoutMs=15000] - Тайм-аут запроса к бэкенду
 */

/**
 * @typedef {Object} FsmConfig
 * @property {BackendConfig} backend
 * @property {number} [sessionInactivityMs=180000] - Тайм-аут бездействия для авторизованных экранов
 */

/**
 * @typedef {Object} FsmContext
 * @property {string|null} token
 * @property {CellDto[]} cells
 * @property {ProductDto[]} products
 * @property {LogEntryDto[]} logs
 * @property {string|null} lastScreen
 * @property {string|null} lastError
 * @property {FsmState|null} retryPoint
 * @property {'stocks'|'capacity'|'prices'|'products'|'config'|null} cellsMode
 */

/**
 * Универсальный клиент бэкенда (минималистичный).
 * Не привязан к UI и BFF, только к REST API.
 */
export class ServiceMenuBackendClient {
  /** @param {BackendConfig} cfg */
  constructor(cfg) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    this.requestTimeoutMs = cfg.requestTimeoutMs ?? 15000;
  }

  /**
   * @private
   * @param {string} path
   * @param {RequestInit & {token?: string}} init
   */
  async _fetchJson(path, init = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    };
    if (init.token) headers['Authorization'] = `Bearer ${init.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      const status = res.status;
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const body = isJson ? await res.json().catch(() => ({})) : await res.text();

      if (status >= 200 && status < 300) return { status, body };
      if (status === 401) return { status, body };
      return { status, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ----------- AUTH -----------
  /** @param {string} pin */
  async login(pin) {
    return this._fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  // ----------- CELLS -----------
  /** @param {string} token */
  async getCells(token) {
    return this._fetchJson('/cells', { token });
  }

  /** @param {string} token @param {number} row */
  async fillRowStock(token, row) {
    return this._fetchJson('/cells/stock/fill-row', {
      method: 'POST',
      token,
      body: JSON.stringify({ row }),
    });
  }

  /** @param {string} token @param {number} cellId @param {number} stock */
  async setCellStock(token, cellId, stock) {
    return this._fetchJson(`/cells/${cellId}/stock`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ stock }),
    });
  }

  /** @param {string} token @param {number} row @param {number} capacity */
  async setRowCapacity(token, row, capacity) {
    return this._fetchJson('/cells/capacity/set-for-row', {
      method: 'PUT',
      token,
      body: JSON.stringify({ row, capacity }),
    });
  }

  /** @param {string} token @param {number} cellId @param {number} capacity */
  async setCellCapacity(token, cellId, capacity) {
    return this._fetchJson(`/cells/${cellId}/capacity`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ capacity }),
    });
  }

  /** @param {string} token @param {number} row @param {number} price */
  async setRowPrice(token, row, price) {
    return this._fetchJson('/cells/price/set-for-row', {
      method: 'PUT',
      token,
      body: JSON.stringify({ row, price }),
    });
  }

  /** @param {string} token @param {number} cellId @param {number} price */
  async setCellPrice(token, cellId, price) {
    return this._fetchJson(`/cells/${cellId}/price`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ price }),
    });
  }

  /** @param {string} token */
  async getProducts(token) {
    return this._fetchJson('/products', { token });
  }

  /** @param {string} token @param {number} cellId @param {number} productId */
  async assignProduct(token, cellId, productId) {
    return this._fetchJson(`/cells/${cellId}/product`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ productId }),
    });
  }

  /** @param {string} token @param {number[]} cellIds @param {'enabled'|'disabled'} status */
  async setCellsStatus(token, cellIds, status) {
    return this._fetchJson('/cells/status', {
      method: 'POST',
      token,
      body: JSON.stringify({ cellIds, status }),
    });
  }

  /** @param {string} token @param {number[]} cellIds */
  async mergeCells(token, cellIds) {
    return this._fetchJson('/cells/merge', {
      method: 'POST',
      token,
      body: JSON.stringify({ cellIds }),
    });
  }

  /** @param {string} token @param {number[]} cellIds @param {string} type */
  async setCellsType(token, cellIds, type) {
    return this._fetchJson('/cells/type', {
      method: 'PUT',
      token,
      body: JSON.stringify({ cellIds, type }),
    });
  }

  // ----------- DIAGNOSTICS -----------
  /** @param {string} token @param {number[]} cellIds */
  async runDiagnostics(token, cellIds) {
    return this._fetchJson('/diagnostics/test-cells', {
      method: 'POST',
      token,
      body: JSON.stringify({ cellIds }),
    });
  }

  // ----------- LOGS -----------
  /** @param {string} token @param {{limit?: number, search?: string, full?: boolean}} [params] */
  async getLogs(token, params = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.full) q.set('full', 'true');
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this._fetchJson(`/diagnostics/logs${qs}`, { token });
  }
}

/**
 * Сигналы, которые переводят автомат в состояние (см. таблицу).
 * На уровне BFF вы вызываете fsm.handle(event, payload).
 */
export const Signals = {
  AppStart:       /** @type {FsmEvent} */('UI.OpenSettings'),
  SubmitPin:      /** @type {FsmEvent} */('Auth.SubmitPin'),
  TryAgain:       /** @type {FsmEvent} */('Auth.TryAgain'),
  Logout:         /** @type {FsmEvent} */('Auth.Logout'),
  NavCellsStocks: /** @type {FsmEvent} */('UI.Navigate.CellsStocks'),
  NavCellsCapacity: /** @type {FsmEvent} */('UI.Navigate.CellsCapacity'),
  NavCellsPrices:   /** @type {FsmEvent} */('UI.Navigate.CellsPrices'),
  NavCellsProducts: /** @type {FsmEvent} */('UI.Navigate.CellsProducts'),
  NavCellsConfig:   /** @type {FsmEvent} */('UI.Navigate.CellsConfig'),
  NavDiagTest:    /** @type {FsmEvent} */('UI.Navigate.DiagnosticsTest'),
  NavLogs:        /** @type {FsmEvent} */('UI.Navigate.Logs'),
  CellsFillRow:   /** @type {FsmEvent} */('Cells.FillRow'),
  CellsEditStock: /** @type {FsmEvent} */('Cells.EditStock'),
  CellsSetRowCapacity: /** @type {FsmEvent} */('Cells.SetRowCapacity'),
  CellsSetCellCapacity: /** @type {FsmEvent} */('Cells.SetCellCapacity'),
  CellsSetRowPrice:    /** @type {FsmEvent} */('Cells.SetRowPrice'),
  CellsSetCellPrice:   /** @type {FsmEvent} */('Cells.SetCellPrice'),
  CellsOpenAssignProduct: /** @type {FsmEvent} */('Cells.OpenAssignProduct'),
  ProductsAssign: /** @type {FsmEvent} */('Products.Assign'),
  CellsSetStatus: /** @type {FsmEvent} */('Cells.SetStatus'),
  CellsMerge:     /** @type {FsmEvent} */('Cells.Merge'),
  CellsSetType:   /** @type {FsmEvent} */('Cells.SetType'),
  DiagRunTest:    /** @type {FsmEvent} */('Diagnostics.RunTest'),
  Rerun:          /** @type {FsmEvent} */('UI.Rerun'),
  LogsSearch:     /** @type {FsmEvent} */('Logs.Search'),
  LogsToggleFull: /** @type {FsmEvent} */('Logs.ToggleFull'),
  Retry:          /** @type {FsmEvent} */('UI.Retry'),
  Back:           /** @type {FsmEvent} */('UI.Back'),
  SessionExpired: /** @type {FsmEvent} */('T.SessionExpired'),
};

/**
 * Результат обработки события: что вернуть BFF для фронтенда.
 * @typedef {Object} FsmReply
 * @property {FsmState} state - Текущее состояние после обработки
 * @property {Object} view - Инструкция для BFF/Frontend (какой экран показать и какими данными наполнить)
 * @property {Object} [meta] - Диагностическая/служебная информация (например, error)
 */

/**
 * Главный класс FSM.
 */
export class ServiceMenuFSM {
  /** @param {FsmConfig} config */
  constructor(config) {
    this.config = {
      sessionInactivityMs: 180000,
      ...config,
    };
    this.backend = new ServiceMenuBackendClient(this.config.backend);
    /** @type {FsmState} */
    this.state = 'Idle';
    /** @type {FsmContext} */
    this.ctx = {
      token: null,
      cells: [],
      products: [],
      logs: [],
      lastScreen: null,
      lastError: null,
      retryPoint: null,
      cellsMode: null,
    };
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._inactivityTimer = null;
  }

  // ---------------- timers ----------------

  _resetInactivityTimerIfNeeded() {
    const interactiveStates = new Set([
      'AuthInput', 'Dashboard',
      'CellsListReady-stocks', 'CellsListReady-capacity', 'CellsListReady-prices',
      'CellsListReady-products', 'CellsListReady-config',
      'ProductsListReady',
      'DiagnosticsTestInput', 'DiagnosticsTestResults',
      'LogsReady',
    ]);
    if (!interactiveStates.has(this.state)) return;
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      // генерируем внутренний сигнал
      this.handle(Signals.SessionExpired).catch(console.error);
    }, this.config.sessionInactivityMs);
  }

  _clearInactivity() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  }

  // ---------------- helpers ----------------

  _goto(state /** @type {FsmState} */, view = {}, meta = {}) {
    this.state = state;
    if (state === 'Idle') {
      // Полная очистка контекста
      this.ctx = {
        token: null, cells: [], products: [], logs: [],
        lastScreen: null, lastError: null, retryPoint: null, cellsMode: null,
      };
      this._clearInactivity();
    }
    this._resetInactivityTimerIfNeeded();
    /** @type {FsmReply} */
    return { state, view, meta };
  }

  _requireToken() {
    if (!this.ctx.token) throw new Error('Token is required in this state');
  }

  // ---------------- public API ----------------

  /**
   * Главный вход: BFF вызывает handle(event, payload)
   * @param {FsmEvent} event
   * @param {any} [payload]
   * @returns {Promise<FsmReply>}
   */
  async handle(event, payload) {
    switch (event) {
      // ---- навигация в сервисное меню (старт) ----
      case Signals.AppStart: {
        // Сигналы в Idle -> AuthInput (UI.OpenSettings)
        return this._fromIdle_toAuthInput();
      }

      // ---- авторизация ----
      case Signals.SubmitPin: {
        const { pin } = payload || {};
        return this._fromAuthInput_toAuthChecking(pin);
      }
      case Signals.TryAgain: {
        if (this.state !== 'AuthError') return this._goto(this.state, {}, { warn: 'Wrong state' });
        return this._fromAuthError_toAuthInput();
      }
      case Signals.Logout: {
        // Принудительный выход из любой точки
        return this._goto('Idle', { screen: 'AuthInput', message: 'Logged out' });
      }

      // ---- навигация из Dashboard ----
      case Signals.NavCellsStocks:
      case Signals.NavCellsCapacity:
      case Signals.NavCellsPrices:
      case Signals.NavCellsProducts:
      case Signals.NavCellsConfig: {
        return this._fromDashboard_toCellsListLoading(event);
      }
      case Signals.NavDiagTest: {
        return this._fromDashboard_toDiagnosticsTestInput();
      }
      case Signals.NavLogs: {
        return this._fromDashboard_toLogsLoading();
      }

      // ---- экраны "Остатки/Глубина/Цены" ----
      case Signals.CellsFillRow: {
        return this._fromCellsStocks_FillRow(payload);
      }
      case Signals.CellsEditStock: {
        return this._fromCellsStocks_EditStock(payload);
      }
      case Signals.CellsSetRowCapacity: {
        return this._fromCellsCapacity_SetRow(payload);
      }
      case Signals.CellsSetCellCapacity: {
        return this._fromCellsCapacity_SetCell(payload);
      }
      case Signals.CellsSetRowPrice: {
        return this._fromCellsPrices_SetRow(payload);
      }
      case Signals.CellsSetCellPrice: {
        return this._fromCellsPrices_SetCell(payload);
      }

      // ---- товары ----
      case Signals.CellsOpenAssignProduct: {
        return this._fromCellsProducts_toProductsListLoading();
      }
      case Signals.ProductsAssign: {
        return this._fromProductsListReady_Assign(payload);
      }

      // ---- конфиг ячеек ----
      case Signals.CellsSetStatus: {
        return this._fromCellsConfig_SetStatus(payload);
      }
      case Signals.CellsMerge: {
        return this._fromCellsConfig_Merge(payload);
      }
      case Signals.CellsSetType: {
        return this._fromCellsConfig_SetType(payload);
      }

      // ---- диагностика ----
      case Signals.DiagRunTest: {
        return this._fromDiagnosticsTestInput_Run(payload);
      }
      case Signals.Rerun: {
        return this._fromDiagnosticsTestResults_Rerun(payload);
      }

      // ---- логи ----
      case Signals.LogsSearch:
      case Signals.LogsToggleFull: {
        return this._fromLogsReady_toLogsLoading(event, payload);
      }

      // ---- общие ----
      case Signals.Retry: {
        return this._retry();
      }
      case Signals.Back: {
        return this._back();
      }
      case Signals.SessionExpired: {
        return this._sessionExpired();
      }

      default:
        return this._goto(this.state, {}, { warn: `Unknown event ${event}` });
    }
  }

  // ---------------- transitions ----------------

  async _fromIdle_toAuthInput() {
    // Очистка контекста уже в _goto('Idle'), но мы можем быть не в Idle
    return this._goto('AuthInput', { screen: 'AuthInput' });
  }

  async _fromAuthInput_toAuthChecking(pin) {
    if (this.state !== 'AuthInput') return this._goto(this.state, {}, { warn: 'Wrong state' });
    if (!pin) return this._goto(this.state, {}, { error: 'PIN is required' });

    this.state = 'AuthChecking';
    const res = await this.backend.login(pin);
    if (res.status === 200 && res.body?.accessToken) {
      this.ctx.token = res.body.accessToken;
      this.ctx.lastScreen = 'Dashboard';
      return this._goto('Dashboard', { screen: 'Dashboard', message: 'Авторизация успешна' });
    }
    if (res.status === 401) {
      this.ctx.lastError = 'AUTH_FAILED';
      return this._goto('AuthError', { screen: 'AuthInput', error: 'Неверный PIN' });
    }
    // прочие ошибки логина как BackendError
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = 'AuthInput';
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  async _fromAuthError_toAuthInput() {
    return this._goto('AuthInput', { screen: 'AuthInput' });
  }

  async _fromDashboard_toCellsListLoading(event) {
    if (this.state !== 'Dashboard') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    /** @type {Record<FsmEvent,'stocks'|'capacity'|'prices'|'products'|'config'>} */
    const map = {
      [Signals.NavCellsStocks]: 'stocks',
      [Signals.NavCellsCapacity]: 'capacity',
      [Signals.NavCellsPrices]: 'prices',
      [Signals.NavCellsProducts]: 'products',
      [Signals.NavCellsConfig]: 'config',
      // @ts-ignore
      default: 'stocks',
    };
    const mode = map[event] ?? 'stocks';
    this.ctx.cellsMode = mode;

    this.state = 'CellsListLoading';
    const res = await this.backend.getCells(this.ctx.token);
    if (res.status === 200) {
      this.ctx.cells = /** @type {CellDto[]} */ (res.body || []);
      return this._goto(
        /** @type {FsmState} */(`CellsListReady-${mode}`),
        { screen: `Cells/${mode}`, cells: this.ctx.cells }
      );
    }
    if (res.status === 401) {
      this.ctx.token = null;
      return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Сессия истекла' });
    }
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = 'CellsListReload'; // ближайшая логичная точка повторной загрузки
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  async _fromDashboard_toDiagnosticsTestInput() {
    if (this.state !== 'Dashboard') return this._goto(this.state, {}, { warn: 'Wrong state' });
    return this._goto('DiagnosticsTestInput', { screen: 'Diagnostics/TestInput' });
  }

  async _fromDashboard_toLogsLoading() {
    if (this.state !== 'Dashboard') return this._goto(this.state, {}, { warn: 'Wrong state' });
    return this._logsReload({ limit: 5000 });
  }

  // Грузит логи из любого состояния (используется Retry)
  async _logsReload(params = { limit: 5000 }) {
    this._requireToken();
    this.state = 'LogsLoading';
    const res = await this.backend.getLogs(this.ctx.token, params);
    if (res.status === 200) {
      this.ctx.logs = /** @type {LogEntryDto[]} */ (res.body || []);
      return this._goto('LogsReady', { screen: 'Logs', logs: this.ctx.logs });
    }
    if (res.status === 401) {
      this.ctx.token = null;
      return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Сессия истекла' });
    }
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = 'LogsLoading';
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  // ----- Cells: Остатки -----
  async _fromCellsStocks_FillRow({ row }) {
    if (this.state !== 'CellsListReady-stocks') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'FillRowProcessing';
    const res = await this.backend.fillRowStock(this.ctx.token, row);
    if (res.status === 204) {
      return this._cellsReload('stocks');
    }
    return this._cellsProcessError(res, 'FillRowProcessing');
  }

  async _fromCellsStocks_EditStock({ cellId, stock }) {
    if (this.state !== 'CellsListReady-stocks') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    if (!(stock >= 0)) return this._goto(this.state, {}, { error: 'Invalid stock' });

    this.state = 'UpdateCellStockProcessing';
    const res = await this.backend.setCellStock(this.ctx.token, cellId, stock);
    if (res.status === 200) {
      return this._cellsReload('stocks');
    }
    return this._cellsProcessError(res, 'UpdateCellStockProcessing');
  }

  // ----- Cells: Глубина -----
  async _fromCellsCapacity_SetRow({ row, capacity }) {
    if (this.state !== 'CellsListReady-capacity') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();
    if (!(capacity > 0)) return this._goto(this.state, {}, { error: 'Invalid capacity' });

    this.state = 'SetRowCapacityProcessing';
    const res = await this.backend.setRowCapacity(this.ctx.token, row, capacity);
    if (res.status === 204) {
      return this._cellsReload('capacity');
    }
    return this._cellsProcessError(res, 'SetRowCapacityProcessing');
  }

  async _fromCellsCapacity_SetCell({ cellId, capacity }) {
    if (this.state !== 'CellsListReady-capacity') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();
    if (!(capacity > 0)) return this._goto(this.state, {}, { error: 'Invalid capacity' });

    this.state = 'SetCellCapacityProcessing';
    const res = await this.backend.setCellCapacity(this.ctx.token, cellId, capacity);
    if (res.status === 200) {
      return this._cellsReload('capacity');
    }
    return this._cellsProcessError(res, 'SetCellCapacityProcessing');
  }

  // ----- Cells: Цены -----
  async _fromCellsPrices_SetRow({ row, price }) {
    if (this.state !== 'CellsListReady-prices') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();
    if (!(price >= 0)) return this._goto(this.state, {}, { error: 'Invalid price' });

    this.state = 'SetRowPriceProcessing';
    const res = await this.backend.setRowPrice(this.ctx.token, row, price);
    if (res.status === 204) {
      return this._cellsReload('prices');
    }
    return this._cellsProcessError(res, 'SetRowPriceProcessing');
  }

  async _fromCellsPrices_SetCell({ cellId, price }) {
    if (this.state !== 'CellsListReady-prices') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();
    if (!(price >= 0)) return this._goto(this.state, {}, { error: 'Invalid price' });

    this.state = 'SetCellPriceProcessing';
    const res = await this.backend.setCellPrice(this.ctx.token, cellId, price);
    if (res.status === 200) {
      return this._cellsReload('prices');
    }
    return this._cellsProcessError(res, 'SetCellPriceProcessing');
  }

  // ----- Cells: Товары -----
  async _fromCellsProducts_toProductsListLoading() {
    if (this.state !== 'CellsListReady-products') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'ProductsListLoading';
    const res = await this.backend.getProducts(this.ctx.token);
    if (res.status === 200) {
      this.ctx.products = /** @type {ProductDto[]} */ (res.body || []);
      return this._goto('ProductsListReady', { screen: 'Products/List', products: this.ctx.products });
    }
    if (res.status === 401) {
      this.ctx.token = null;
      return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Сессия истекла' });
    }
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = 'ProductsListLoading';
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  async _fromProductsListReady_Assign({ cellId, productId }) {
    if (this.state !== 'ProductsListReady') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'AssignProductProcessing';
    const res = await this.backend.assignProduct(this.ctx.token, cellId, productId);
    if (res.status === 200) {
      return this._cellsReload('products');
    }
    return this._cellsProcessError(res, 'AssignProductProcessing');
  }

  // ----- Cells: Конфигурация -----
  async _fromCellsConfig_SetStatus({ cellIds, status }) {
    if (this.state !== 'CellsListReady-config') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'CellsStatusProcessing';
    const res = await this.backend.setCellsStatus(this.ctx.token, cellIds, status);
    if (res.status === 204) {
      return this._cellsReload('config');
    }
    return this._cellsProcessError(res, 'CellsStatusProcessing');
  }

  async _fromCellsConfig_Merge({ cellIds }) {
    if (this.state !== 'CellsListReady-config') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'CellsMergeProcessing';
    const res = await this.backend.mergeCells(this.ctx.token, cellIds);
    if (res.status === 204) {
      return this._cellsReload('config');
    }
    return this._cellsProcessError(res, 'CellsMergeProcessing');
  }

  async _fromCellsConfig_SetType({ cellIds, type }) {
    if (this.state !== 'CellsListReady-config') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'CellsTypeProcessing';
    const res = await this.backend.setCellsType(this.ctx.token, cellIds, type);
    if (res.status === 204) {
      return this._cellsReload('config');
    }
    return this._cellsProcessError(res, 'CellsTypeProcessing');
  }

  // ----- Diagnostics -----
  async _fromDiagnosticsTestInput_Run({ cellIds }) {
    if (this.state !== 'DiagnosticsTestInput') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();

    this.state = 'DiagnosticsTestProcessing';
    const res = await this.backend.runDiagnostics(this.ctx.token, cellIds);
    if (res.status === 200) {
      // ожидаем массив результатов по ячейкам
      return this._goto('DiagnosticsTestResults', { screen: 'Diagnostics/Results', results: res.body });
    }
    return this._processCommonBackend(res, 'DiagnosticsTestProcessing');
  }

  async _fromDiagnosticsTestResults_Rerun({ cellIds }) {
    if (this.state !== 'DiagnosticsTestResults') {
      return this._goto(this.state, {}, { warn: 'Wrong state' });
    }
    this._requireToken();
    this.state = 'DiagnosticsTestProcessing';
    const res = await this.backend.runDiagnostics(this.ctx.token, cellIds);
    if (res.status === 200) {
      return this._goto('DiagnosticsTestResults', { screen: 'Diagnostics/Results', results: res.body });
    }
    return this._processCommonBackend(res, 'DiagnosticsTestProcessing');
  }

  // ----- Logs -----
  async _fromLogsReady_toLogsLoading(event, payload) {
    if (this.state !== 'LogsReady') return this._goto(this.state, {}, { warn: 'Wrong state' });
    this._requireToken();
    const params = (event === Signals.LogsSearch)
      ? { limit: 5000, search: payload?.text }
      : { limit: 5000, full: !!payload?.on };
    return this._logsReload(params);
  }

  // ----- Общие переходы -----

  async _cellsReload(mode /** @type {'stocks'|'capacity'|'prices'|'products'|'config'} */) {
    // общий путь CellsListReload(mode)
    this._requireToken();

    this.state = 'CellsListReload';
    const res = await this.backend.getCells(this.ctx.token);
    if (res.status === 200) {
      this.ctx.cells = /** @type {CellDto[]} */ (res.body || []);
      return this._goto(
        /** @type {FsmState} */(`CellsListReady-${mode}`),
        { screen: `Cells/${mode}`, cells: this.ctx.cells }
      );
    }
    return this._processCommonBackend(res, 'CellsListReload');
  }

  _cellsProcessError(res, retryPoint /** @type {FsmState} */) {
    if (res.status === 401) {
      this.ctx.token = null;
      return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Сессия истекла' });
    }
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = retryPoint;
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  _processCommonBackend(res, retryPoint /** @type {FsmState} */) {
    if (res.status === 401) {
      this.ctx.token = null;
      return this._goto('TokenInvalid', { screen: 'AuthInput', error: 'Сессия истекла' });
    }
    this.ctx.lastError = 'BackendError';
    this.ctx.retryPoint = retryPoint;
    return this._goto('BackendError', { screen: 'Error' }, { status: res.status, body: res.body });
  }

  async _retry() {
    if (this.state !== 'BackendError' || !this.ctx.retryPoint) {
      return this._goto(this.state, {}, { warn: 'Nothing to retry' });
    }
    // Переиспользуем контекст для понимания, что перегружать
    switch (this.ctx.retryPoint) {
      case 'LogsLoading': return this._logsReload({ limit: 5000 });
      case 'ProductsListLoading': return this._fromCellsProducts_toProductsListLoading();
      case 'CellsListReload': {
        const mode = this.ctx.cellsMode ?? 'stocks';
        return this._cellsReload(mode);
      }
      case 'FillRowProcessing':      // откатимся к reload stocks
      case 'UpdateCellStockProcessing':
        return this._cellsReload('stocks');
      case 'SetRowCapacityProcessing':
      case 'SetCellCapacityProcessing':
        return this._cellsReload('capacity');
      case 'SetRowPriceProcessing':
      case 'SetCellPriceProcessing':
        return this._cellsReload('prices');
      case 'AssignProductProcessing':
        return this._cellsReload('products');
      case 'CellsStatusProcessing':
      case 'CellsMergeProcessing':
      case 'CellsTypeProcessing':
        return this._cellsReload('config');
      case 'DiagnosticsTestProcessing':
        // нет знания cellIds; BFF должен переинициировать запуск теста (или хранить payload у себя)
        return this._goto('DiagnosticsTestInput', { screen: 'Diagnostics/TestInput', warn: 'Повторите запуск теста' });
      default:
        return this._goto('Dashboard', { screen: 'Dashboard', warn: 'Return to dashboard' });
    }
  }

  async _back() {
    // Универсально: вернуться к Dashboard из большинства list-экранов и результатов
    const backToDashboard = new Set([
      'CellsListReady-stocks', 'CellsListReady-capacity', 'CellsListReady-prices',
      'CellsListReady-products', 'CellsListReady-config',
      'ProductsListReady', 'DiagnosticsTestResults', 'LogsReady'
    ]);
    if (backToDashboard.has(this.state)) {
      return this._goto('Dashboard', { screen: 'Dashboard' });
    }
    // Из ошибок — к последнему стабильному экрану
    if (this.state === 'BackendError') {
      return this._goto('Dashboard', { screen: 'Dashboard' });
    }
    // По умолчанию — без изменений
    return this._goto(this.state, {}, { info: 'No back transition' });
  }

  async _sessionExpired() {
    // Срабатывает T_session.expired
    if (this._inactivityTimer) this._clearInactivity();
    return this._goto('Idle', { screen: 'AuthInput', message: 'Сессия завершена по тайм-ауту' });
  }
}

/* ===================== ПРИМЕР ИНТЕГРАЦИИ С BFF =====================

import express from 'express';
import { ServiceMenuFSM, Signals } from './fsm-service-menu.js';

const app = express();
app.use(express.json());

const fsm = new ServiceMenuFSM({
  backend: { baseUrl: 'http://localhost:8080/api/v1' },
  sessionInactivityMs: 120000, // 2 минуты
});

// Пример: открыть сервисное меню
app.post('/bff/ui/open-settings', async (req, res) => {
  const reply = await fsm.handle(Signals.AppStart);
  res.json(reply);
});

// Авторизация: отправка PIN
app.post('/bff/auth/login', async (req, res) => {
  const { pin } = req.body;
  const reply = await fsm.handle(Signals.SubmitPin, { pin });
  res.json(reply);
});

// Навигация: остатки/глубина/цены/товары/конфиг
app.post('/bff/ui/nav/cells-stocks', async (req, res) => {
  const reply = await fsm.handle(Signals.NavCellsStocks);
  res.json(reply);
});

// Изменение остатка
app.post('/bff/cells/stock', async (req, res) => {
  const { cellId, stock } = req.body;
  const reply = await fsm.handle(Signals.CellsEditStock, { cellId, stock });
  res.json(reply);
});

// Запуск диагностики
app.post('/bff/diagnostics/run', async (req, res) => {
  const { cellIds } = req.body;
  const reply = await fsm.handle(Signals.DiagRunTest, { cellIds });
  res.json(reply);
});

// Логи: поиск
app.post('/bff/logs/search', async (req, res) => {
  const { text } = req.body;
  const reply = await fsm.handle(Signals.LogsSearch, { text });
  res.json(reply);
});

// Выход
app.post('/bff/auth/logout', async (req, res) => {
  const reply = await fsm.handle(Signals.Logout);
  res.json(reply);
});

app.listen(3001, () => {
  console.log('BFF listening on :3001');
});

==================================================================== */

/* ===================== ПРИМЕР МИНИ-ТЕСТА БЕЗ HTTP ===================

const fsm = new ServiceMenuFSM({
  backend: { baseUrl: 'http://localhost:8080/api/v1' },
});

(async () => {
  console.log(await fsm.handle(Signals.AppStart));              // -> AuthInput
  console.log(await fsm.handle(Signals.SubmitPin, { pin: '1234' })); // -> Dashboard или AuthError
  console.log(await fsm.handle(Signals.NavCellsStocks));         // -> CellsListReady-stocks
  console.log(await fsm.handle(Signals.CellsFillRow, { row: 2 }));   // -> reload stocks
  console.log(await fsm.handle(Signals.Back));                   // -> Dashboard
})();

==================================================================== */

export default ServiceMenuFSM;
