// fsm-service-menu.spec.js
// Запуск: npx vitest run  (или vitest --ui)
// Если используете Jest: замените импорты из 'vitest' на '@jest/globals' и 'jest'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceMenuFSM, Signals } from './fsm-service-menu.js';

// ---------- ВСПОМОГАТЕЛЬНЫЕ ПАТТЕРНЫ ----------
/**
 * Удобный фабричный метод: создаёт FSM с очень коротким тайм-аутом,
 * чтобы легко тестировать SessionTimeout (200мс).
 */
function newFSM() {
  return new ServiceMenuFSM({
    backend: { baseUrl: 'http://localhost:8080/api/v1', requestTimeoutMs: 2000 },
    sessionInactivityMs: 200, // ускорим тест таймера
  });
}

// Быстрые короткие ответы-заглушки:
const ok = (body) => Promise.resolve({ status: 200, body });
const noContent = () => Promise.resolve({ status: 204, body: {} });
const unauthorized = () => Promise.resolve({ status: 401, body: { error: 'Unauthorized' } });
const serverErr = (code = 500) => Promise.resolve({ status: code, body: { error: 'Boom' } });
// Новые статусы:
const badRequest = () => Promise.resolve({ status: 400, body: { error: 'Bad Request' } });
const forbidden = () => Promise.resolve({ status: 403, body: { error: 'Forbidden' } });
const notFound = () => Promise.resolve({ status: 404, body: { error: 'Not Found' } });
const conflict = () => Promise.resolve({ status: 409, body: { error: 'Conflict' } });
const unprocessable = () => Promise.resolve({ status: 422, body: { error: 'Unprocessable' } });
const serviceUnavailable = () => Promise.resolve({ status: 503, body: { error: 'Service Unavailable' } });
const gatewayTimeout = () => Promise.resolve({ status: 504, body: { error: 'Gateway Timeout' } });

// ---------- ГРУППЫ ТЕСТОВ ----------

describe('ServiceMenuFSM — авторизация', () => {
  /** @type {ServiceMenuFSM} */
  let fsm;

  beforeEach(() => {
    vi.useFakeTimers();
    fsm = newFSM();
    // Мокаем клиент бэка: будем затыкать конкретные методы по месту
    // (fsm.backend.* — это jest/vitest.fn())
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') {
        fsm.backend[k] = vi.fn();
      }
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Старт → Idle → AuthInput', async () => {
    expect(fsm.state).toBe('Idle');
    const reply = await fsm.handle(Signals.AppStart);
    expect(reply.state).toBe('AuthInput');
    expect(reply.view.screen).toBe('AuthInput');
  });

  it('Успешный логин: AuthInput → AuthChecking → Dashboard', async () => {
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    await fsm.handle(Signals.AppStart);
    const r = await fsm.handle(Signals.SubmitPin, { pin: '1234' });
    expect(fsm.state).toBe('Dashboard');
    expect(r.view.screen).toBe('Dashboard');
  });

  it('Ошибка логина: 401 → AuthError → TryAgain → AuthInput', async () => {
    fsm.backend.login.mockImplementation(unauthorized);
    await fsm.handle(Signals.AppStart);
    const r1 = await fsm.handle(Signals.SubmitPin, { pin: 'bad' });
    expect(fsm.state).toBe('AuthError');
    expect(r1.view.error).toBe('Неверный PIN');

    const r2 = await fsm.handle(Signals.TryAgain);
    expect(fsm.state).toBe('AuthInput');
    expect(r2.view.screen).toBe('AuthInput');
  });

  it('Пустой PIN — остаёмся в AuthInput с метой об ошибке', async () => {
    await fsm.handle(Signals.AppStart);
    const r = await fsm.handle(Signals.SubmitPin, { pin: '' });
    expect(fsm.state).toBe('AuthInput');
    expect(r.meta.error).toBe('PIN is required');
  });

  it('Logout с любого места уводит в Idle', async () => {
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
    const r = await fsm.handle(Signals.Logout);
    expect(fsm.state).toBe('Idle');
    expect(r.view.message).toBe('Logged out');
  });
});

describe('ServiceMenuFSM — таймер бездействия', () => {
  let fsm;

  beforeEach(() => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
  });

  afterEach(() => vi.useRealTimers());

  it('В интерактивных состояниях истечение таймера → SessionTimeout → Idle', async () => {
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' }); // Dashboard (интерактивное)
    expect(fsm.state).toBe('Dashboard');

    // Прокручиваем таймер неактивности:
    vi.advanceTimersByTime(250);
    // FSM сам сгенерирует внутренний сигнал и уедет в Idle
    // handle вызывается внутри; чуть подождём промисы
    await vi.waitFor(() => expect(fsm.state).toBe('Idle'));
  });
});

describe('ServiceMenuFSM — загрузка списков ячеек во всех режимах', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 1, row: 1 }]));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    [Signals.NavCellsStocks, 'CellsListReady-stocks', 'Cells/stocks'],
    [Signals.NavCellsCapacity, 'CellsListReady-capacity', 'Cells/capacity'],
    [Signals.NavCellsPrices, 'CellsListReady-prices', 'Cells/prices'],
    [Signals.NavCellsProducts, 'CellsListReady-products', 'Cells/products'],
    [Signals.NavCellsConfig, 'CellsListReady-config', 'Cells/config'],
  ])('Навигация %s загружает список и приходит в %s', async (signal, expectedState, expectedScreen) => {
    const r = await fsm.handle(signal);
    expect(fsm.state).toBe(expectedState);
    expect(r.view.screen).toBe(expectedScreen);
    expect(r.view.cells).toEqual([{ id: 1, row: 1 }]);
  });

  it('401 при getCells → TokenInvalid → AuthInput', async () => {
    fsm.backend.getCells.mockImplementationOnce(unauthorized);
    const r = await fsm.handle(Signals.NavCellsStocks);
    expect(fsm.state).toBe('TokenInvalid');
    expect(r.view.error).toMatch(/Сессия истекла/);
  });

  it('5xx при getCells → BackendError c retryPoint', async () => {
    fsm.backend.getCells.mockImplementationOnce(() => serverErr());   // 500 один раз
    const r = await fsm.handle(Signals.NavCellsPrices);
    expect(fsm.state).toBe('BackendError');
    expect(r.meta.status).toBe(500);
    expect(fsm.ctx.retryPoint).toBe('CellsListReload');
  });
});

describe('ServiceMenuFSM — операции Остатки/Глубина/Цены (+ reload)', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 10, row: 2, capacity: 10, stock: 3, price: 50 }]));

    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
  });

  afterEach(() => vi.useRealTimers());

  it('FillRow: stocks → processing → reload → CellsListReady-stocks', async () => {
    await fsm.handle(Signals.NavCellsStocks);
    fsm.backend.fillRowStock.mockImplementationOnce(noContent);

    const r1 = await fsm.handle(Signals.CellsFillRow, { row: 2 });
    expect(fsm.state).toBe('CellsListReady-stocks');
    expect(r1.view.cells[0].id).toBe(10);
  });

  it('EditStock: guard не пропускает отрицательный stock', async () => {
    await fsm.handle(Signals.NavCellsStocks);
    const r = await fsm.handle(Signals.CellsEditStock, { cellId: 10, stock: -1 });
    expect(fsm.state).toBe('CellsListReady-stocks');
    expect(r.meta.error).toBe('Invalid stock');
  });

  it('SetRowCapacity + SetCellCapacity: capacity>0, ok + reload', async () => {
    await fsm.handle(Signals.NavCellsCapacity);
    fsm.backend.setRowCapacity.mockImplementationOnce(() => noContent());
    fsm.backend.setCellCapacity.mockImplementationOnce(() => ok({}));

    const r1 = await fsm.handle(Signals.CellsSetRowCapacity, { row: 2, capacity: 12 });
    expect(fsm.state).toBe('CellsListReady-capacity');
    const r2 = await fsm.handle(Signals.CellsSetCellCapacity, { cellId: 10, capacity: 11 });
    expect(fsm.state).toBe('CellsListReady-capacity');
    expect(r1.view.cells.length).toBe(1);
    expect(r2.view.cells.length).toBe(1);
  });

  it('SetRowPrice + SetCellPrice: price≥0, ok + reload', async () => {
    await fsm.handle(Signals.NavCellsPrices);
    fsm.backend.setRowPrice.mockImplementationOnce(() => noContent());
    fsm.backend.setCellPrice.mockImplementationOnce(() => ok({}));

    const r1 = await fsm.handle(Signals.CellsSetRowPrice, { row: 2, price: 60 });
    const r2 = await fsm.handle(Signals.CellsSetCellPrice, { cellId: 10, price: 55 });
    expect(r1.state).toBe('CellsListReady-prices');
    expect(r2.state).toBe('CellsListReady-prices');
  });

  it('Любая операция с 401 → TokenInvalid', async () => {
    await fsm.handle(Signals.NavCellsPrices);
    fsm.backend.setCellPrice.mockImplementationOnce(unauthorized);
    const r = await fsm.handle(Signals.CellsSetCellPrice, { cellId: 10, price: 10 });
    expect(fsm.state).toBe('TokenInvalid');
    expect(r.view.error).toMatch(/Сессия истекла/);
  });

  it('Любая операция с 5xx → BackendError с корректным retryPoint', async () => {
    await fsm.handle(Signals.NavCellsCapacity);
    fsm.backend.setCellCapacity.mockImplementationOnce(serverErr);
    await fsm.handle(Signals.CellsSetCellCapacity, { cellId: 10, capacity: 5 });
    expect(fsm.state).toBe('BackendError');
    expect(fsm.ctx.retryPoint).toBe('SetCellCapacityProcessing');
  });
});

describe('ServiceMenuFSM — товары (catalog + assign + reload)', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 7, row: 1 }]));
    fsm.backend.getProducts.mockImplementation(() => ok([{ id: 100, name: 'Lays' }]));
    fsm.backend.assignProduct.mockImplementation(() => ok({}));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
    await fsm.handle(Signals.NavCellsProducts);
  });

  afterEach(() => vi.useRealTimers());

  it('Открыть каталог → ProductsListReady', async () => {
    const r = await fsm.handle(Signals.CellsOpenAssignProduct);
    expect(fsm.state).toBe('ProductsListReady');
    expect(r.view.products[0].name).toBe('Lays');
  });

  it('Назначить товар → Assign → reload → CellsListReady-products', async () => {
    await fsm.handle(Signals.CellsOpenAssignProduct);
    const r = await fsm.handle(Signals.ProductsAssign, { cellId: 7, productId: 100 });
    expect(fsm.state).toBe('CellsListReady-products');
    expect(r.view.cells).toEqual([{ id: 7, row: 1 }]);
  });

  it('401 на getProducts → TokenInvalid', async () => {
    fsm.backend.getProducts.mockImplementationOnce(() => unauthorized());
    const r = await fsm.handle(Signals.CellsOpenAssignProduct);
    expect(fsm.state).toBe('TokenInvalid');
    expect(r.view.error).toMatch(/Сессия истекла/);
  });

  it('5xx на assign → BackendError, retryPoint=AssignProductProcessing', async () => {
    await fsm.handle(Signals.CellsOpenAssignProduct);
    fsm.backend.assignProduct.mockImplementationOnce(() => serverErr());
    await fsm.handle(Signals.ProductsAssign, { cellId: 7, productId: 100 });
    expect(fsm.state).toBe('BackendError');
    expect(fsm.ctx.retryPoint).toBe('AssignProductProcessing');
  });
});

describe('ServiceMenuFSM — конфиг ячеек (status/merge/type + reload)', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 1, row: 1 }, { id: 2, row: 1 }]));
    fsm.backend.setCellsStatus.mockImplementation(noContent);
    fsm.backend.mergeCells.mockImplementation(noContent);
    fsm.backend.setCellsType.mockImplementation(noContent);
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
    await fsm.handle(Signals.NavCellsConfig);
  });

  afterEach(() => vi.useRealTimers());

  it('SetStatus → reload config', async () => {
    const r = await fsm.handle(Signals.CellsSetStatus, { cellIds: [1, 2], status: 'disabled' });
    expect(fsm.state).toBe('CellsListReady-config');
    expect(r.view.cells.length).toBe(2);
  });

  it('Merge → reload config', async () => {
    const r = await fsm.handle(Signals.CellsMerge, { cellIds: [1, 2] });
    expect(fsm.state).toBe('CellsListReady-config');
    expect(r.view.cells.length).toBe(2);
  });

  it('SetType → reload config', async () => {
    const r = await fsm.handle(Signals.CellsSetType, { cellIds: [1, 2], type: 'spiral' });
    expect(fsm.state).toBe('CellsListReady-config');
    expect(r.view.cells.length).toBe(2);
  });
});

describe('ServiceMenuFSM — диагностика (run + results + rerun)', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
  });

  afterEach(() => vi.useRealTimers());

  it('Запуск диагностики → результаты', async () => {
    await fsm.handle(Signals.NavDiagTest);
    fsm.backend.runDiagnostics.mockImplementation(() => ok([{ cellId: 1, status: 'SUCCESS' }]));
    const r = await fsm.handle(Signals.DiagRunTest, { cellIds: [1] });
    expect(fsm.state).toBe('DiagnosticsTestResults');
    expect(r.view.results[0].status).toBe('SUCCESS');
  });

  it('Повторный запуск из Results → опять Results', async () => {
    await fsm.handle(Signals.NavDiagTest);
    fsm.backend.runDiagnostics.mockImplementation(() => ok([{ cellId: 1, status: 'SUCCESS' }]));
    await fsm.handle(Signals.DiagRunTest, { cellIds: [1] });
    const r = await fsm.handle(Signals.Rerun, { cellIds: [1] });
    expect(fsm.state).toBe('DiagnosticsTestResults');
    expect(r.view.results[0].cellId).toBe(1);
  });

  it('5xx в диагностике → BackendError → Retry возвращает на TestInput', async () => {
    await fsm.handle(Signals.NavDiagTest);
    fsm.backend.runDiagnostics.mockImplementation(serverErr);
    await fsm.handle(Signals.DiagRunTest, { cellIds: [1] });
    expect(fsm.state).toBe('BackendError');
    const rRetry = await fsm.handle(Signals.Retry);
    expect(rRetry.state).toBe('DiagnosticsTestInput');
  });
});

describe('ServiceMenuFSM — логи (default, search, full) + 401 + 5xx', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getLogs.mockImplementation(() => ok([{ ts: 't', level: 'INFO', msg: 'hi' }]));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
  });

  afterEach(() => vi.useRealTimers());

  it('Загрузка логов по умолчанию из Dashboard', async () => {
    const r = await fsm.handle(Signals.NavLogs);
    expect(fsm.state).toBe('LogsReady');
    expect(r.view.logs.length).toBe(1);
  });

  it('Поиск в логах', async () => {
    await fsm.handle(Signals.NavLogs);
    fsm.backend.getLogs.mockImplementationOnce(() => ok([{ ts: 't2', level: 'WARN', msg: 'query' }]));
    const r = await fsm.handle(Signals.LogsSearch, { text: 'query' });
    expect(fsm.state).toBe('LogsReady');
    expect(r.view.logs[0].msg).toBe('query');
  });

  it('Переключение на полный лог', async () => {
    await fsm.handle(Signals.NavLogs);
    fsm.backend.getLogs.mockImplementationOnce(() => ok([{ ts: 't3', level: 'DEBUG', msg: 'full' }]));
    const r = await fsm.handle(Signals.LogsToggleFull, { on: true });
    expect(fsm.state).toBe('LogsReady');
    expect(r.view.logs[0].msg).toBe('full');
  });

  it('401 при загрузке логов → TokenInvalid', async () => {
    await fsm.handle(Signals.NavLogs);
    fsm.backend.getLogs.mockImplementationOnce(unauthorized);
    const r = await fsm.handle(Signals.LogsSearch, { text: 'x' });
    expect(fsm.state).toBe('TokenInvalid');
    expect(r.view.error).toMatch(/Сессия истекла/);
  });

  it('5xx при загрузке логов → BackendError → Retry возвращает в LogsLoading', async () => {
    await fsm.handle(Signals.NavLogs);
    fsm.backend.getLogs.mockImplementationOnce(() => serverErr());
    // все последующие вызовы после Retry — успешные
    fsm.backend.getLogs.mockImplementation(() => ok([{ ts: 't-ok', level: 'INFO', msg: 'ok after retry' }]));

    // а ЗАТЕМ дефолт — успешный на все последующие вызовы:
    fsm.backend.getLogs.mockImplementation(() => ok([{ ts: 't-ok', level: 'INFO', msg: 'ok after retry' }]));
    await fsm.handle(Signals.LogsSearch, { text: 'x' });
    expect(fsm.state).toBe('BackendError');
    const r = await fsm.handle(Signals.Retry);
    // FSM сам вызовет повтор логов из Dashboard-пути
    expect(['LogsReady', 'LogsLoading']).toContain(r.state);
  });
});

describe('ServiceMenuFSM — Back/Retry/Unknown/Guards', () => {
  let fsm;

  beforeEach(async () => {
    vi.useFakeTimers();
    fsm = newFSM();
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
      if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
    }
    fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 1, row: 1 }]));
    await fsm.handle(Signals.AppStart);
    await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
  });

  // --------------------------------------------------------------------
  // ДОПОЛНИТЕЛЬНЫЕ КЕЙСЫ ПО СТАТУС-КОДАМ (кроме 200/204/401/500)
  // Проверяем, что любые 4xx/5xx (кроме 401) приводят к BackendError
  // с корректным retryPoint для каждого маршрута.
  // --------------------------------------------------------------------
  describe('ServiceMenuFSM — расширенные статусы бэкенда', () => {
    let fsm;

    beforeEach(async () => {
      vi.useFakeTimers();
      fsm = newFSM();
      // заглушки
      for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fsm.backend))) {
        if (typeof fsm.backend[k] === 'function') fsm.backend[k] = vi.fn();
      }
      fsm.backend.login.mockImplementation(() => ok({ accessToken: 'jwt' }));
      fsm.backend.getCells.mockImplementation(() => ok([{ id: 10, row: 2, capacity: 10, stock: 3, price: 50 }]));

      await fsm.handle(Signals.AppStart);
      await fsm.handle(Signals.SubmitPin, { pin: 'ok' });
    });

    afterEach(() => vi.useRealTimers());

    it.each([
      ['GET /cells', () => fsm.handle(Signals.NavCellsPrices), () => fsm.backend.getCells.mockImplementationOnce(() => badRequest()), 'CellsListReload'],
      ['GET /cells (403)', () => fsm.handle(Signals.NavCellsCapacity), () => fsm.backend.getCells.mockImplementationOnce(() => forbidden()), 'CellsListReload'],
      ['GET /cells (404)', () => fsm.handle(Signals.NavCellsProducts), () => fsm.backend.getCells.mockImplementationOnce(() => notFound()), 'CellsListReload'],
      ['GET /cells (409)', () => fsm.handle(Signals.NavCellsStocks), () => fsm.backend.getCells.mockImplementationOnce(() => conflict()), 'CellsListReload'],
      ['GET /cells (422)', () => fsm.handle(Signals.NavCellsConfig), () => fsm.backend.getCells.mockImplementationOnce(() => unprocessable()), 'CellsListReload'],
      ['GET /cells (503)', () => fsm.handle(Signals.NavCellsPrices), () => fsm.backend.getCells.mockImplementationOnce(() => serviceUnavailable()), 'CellsListReload'],
      ['GET /cells (504)', () => fsm.handle(Signals.NavCellsPrices), () => fsm.backend.getCells.mockImplementationOnce(() => gatewayTimeout()), 'CellsListReload'],
    ])('%s → BackendError + retryPoint', async (_label, doNav, injectFail, expectedRetry) => {
      injectFail(); // 4xx/5xx
      const r = await doNav();
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe(expectedRetry);
      expect(r.meta.status).toBeDefined();
    });

    it('PUT /cells/:id/stock → 404 → BackendError (retryPoint=UpdateCellStockProcessing)', async () => {
      await fsm.handle(Signals.NavCellsStocks);
      fsm.backend.setCellStock.mockImplementationOnce(() => notFound());
      const r = await fsm.handle(Signals.CellsEditStock, { cellId: 999, stock: 1 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('UpdateCellStockProcessing');
      expect(r.meta.status).toBe(404);
    });

    it('PUT /cells/:id/capacity → 404 → BackendError (retryPoint=SetCellCapacityProcessing)', async () => {
      await fsm.handle(Signals.NavCellsCapacity);
      fsm.backend.setCellCapacity.mockImplementationOnce(() => notFound());
      const r = await fsm.handle(Signals.CellsSetCellCapacity, { cellId: 999, capacity: 5 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('SetCellCapacityProcessing');
      expect(r.meta.status).toBe(404);
    });

    it('PUT /cells/capacity/set-for-row → 503 → BackendError (retryPoint=SetRowCapacityProcessing)', async () => {
      await fsm.handle(Signals.NavCellsCapacity);
      fsm.backend.setRowCapacity.mockImplementationOnce(() => serviceUnavailable());
      const r = await fsm.handle(Signals.CellsSetRowCapacity, { row: 2, capacity: 11 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('SetRowCapacityProcessing');
      expect(r.meta.status).toBe(503);
    });

    it('PUT /cells/:id/price → 422 → BackendError (retryPoint=SetCellPriceProcessing)', async () => {
      await fsm.handle(Signals.NavCellsPrices);
      fsm.backend.setCellPrice.mockImplementationOnce(() => unprocessable());
      const r = await fsm.handle(Signals.CellsSetCellPrice, { cellId: 10, price: 123 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('SetCellPriceProcessing');
      expect(r.meta.status).toBe(422);
    });

    it('PUT /cells/price/set-for-row → 504 → BackendError (retryPoint=SetRowPriceProcessing)', async () => {
      await fsm.handle(Signals.NavCellsPrices);
      fsm.backend.setRowPrice.mockImplementationOnce(() => gatewayTimeout());
      const r = await fsm.handle(Signals.CellsSetRowPrice, { row: 2, price: 99 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('SetRowPriceProcessing');
      expect(r.meta.status).toBe(504);
    });

    it('GET /products → 403 → BackendError (retryPoint=ProductsListLoading)', async () => {
      await fsm.handle(Signals.NavCellsProducts);
      fsm.backend.getProducts.mockImplementationOnce(() => forbidden());
      const r = await fsm.handle(Signals.CellsOpenAssignProduct);
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('ProductsListLoading');
      expect(r.meta.status).toBe(403);
    });

    it('PUT /cells/:id/product → 404 → BackendError (retryPoint=AssignProductProcessing)', async () => {
      await fsm.handle(Signals.NavCellsProducts);
      fsm.backend.getProducts.mockImplementationOnce(() => ok([{ id: 100, name: 'Lays' }]));
      await fsm.handle(Signals.CellsOpenAssignProduct);
      fsm.backend.assignProduct.mockImplementationOnce(() => notFound());
      const r = await fsm.handle(Signals.ProductsAssign, { cellId: 999, productId: 100 });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('AssignProductProcessing');
      expect(r.meta.status).toBe(404);
    });

    it('POST /cells/merge → 409 → BackendError (retryPoint=CellsMergeProcessing)', async () => {
      await fsm.handle(Signals.NavCellsConfig);
      fsm.backend.mergeCells.mockImplementationOnce(() => conflict());
      const r = await fsm.handle(Signals.CellsMerge, { cellIds: [1, 2] });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('CellsMergeProcessing');
      expect(r.meta.status).toBe(409);
    });

    it('POST /cells/status → 422 → BackendError (retryPoint=CellsStatusProcessing)', async () => {
      await fsm.handle(Signals.NavCellsConfig);
      fsm.backend.setCellsStatus.mockImplementationOnce(() => unprocessable());
      const r = await fsm.handle(Signals.CellsSetStatus, { cellIds: [1, 2], status: 'disabled' });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('CellsStatusProcessing');
      expect(r.meta.status).toBe(422);
    });
    it('PUT /cells/type → 503 → BackendError (retryPoint=CellsTypeProcessing)', async () => {
      await fsm.handle(Signals.NavCellsConfig);
      fsm.backend.setCellsType.mockImplementationOnce(() => serviceUnavailable());
      const r = await fsm.handle(Signals.CellsSetType, { cellIds: [1], type: 'spiral' });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('CellsTypeProcessing');
      expect(r.meta.status).toBe(503);
    });

    it('POST /diagnostics/test-cells → 503 → BackendError (retryPoint=DiagnosticsTestProcessing)', async () => {
      await fsm.handle(Signals.NavDiagTest);
      fsm.backend.runDiagnostics.mockImplementationOnce(() => serviceUnavailable());
      const r = await fsm.handle(Signals.DiagRunTest, { cellIds: [1] });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('DiagnosticsTestProcessing');
      expect(r.meta.status).toBe(503);
    });

    it('GET /diagnostics/logs → 403 → BackendError (retryPoint=LogsLoading) + Retry успешен', async () => {
      // 1) дефолтный успешный ответ для первичного входа на экран логов
      fsm.backend.getLogs.mockImplementation(() => ok([{ ts: 't0', level: 'INFO', msg: 'init' }]));
      await fsm.handle(Signals.NavLogs); // LogsReady

      // 2) следующий вызов (поиск) отдаёт 403
      fsm.backend.getLogs.mockImplementationOnce(() => forbidden());
      const r1 = await fsm.handle(Signals.LogsSearch, { text: 'q' });
      expect(fsm.state).toBe('BackendError');
      expect(fsm.ctx.retryPoint).toBe('LogsLoading');
      expect(r1.meta.status).toBe(403);

      // 3) на повторе — снова дефолтный успех
      fsm.backend.getLogs.mockImplementation(() => ok([{ ts: 't1', level: 'INFO', msg: 'ok after retry' }]));
      const r2 = await fsm.handle(Signals.Retry);
      expect(['LogsLoading', 'LogsReady']).toContain(r2.state);
    });
  });
  afterEach(() => vi.useRealTimers());

  it('Back из list-экранов → Dashboard', async () => {
    await fsm.handle(Signals.NavCellsProducts);
    const r = await fsm.handle(Signals.Back);
    expect(fsm.state).toBe('Dashboard');
    expect(r.view.screen).toBe('Dashboard');
  });

  it('Retry без BackendError ничего не делает', async () => {
    const r = await fsm.handle(Signals.Retry);
    expect(r.meta?.warn).toBe('Nothing to retry');
  });

  it('Unknown event → warn и без смены состояния', async () => {
    const r = await fsm.handle(/** @type any */('UNKNOWN_SIGNAL'));
    expect(r.meta.warn).toMatch(/Unknown event/);
  });

  it('Гварды: отрицательная цена/ёмкость → остаёмся на месте с ошибкой', async () => {
    await fsm.handle(Signals.NavCellsPrices);
    const r1 = await fsm.handle(Signals.CellsSetCellPrice, { cellId: 1, price: -5 });
    expect(r1.meta.error).toBe('Invalid price');

    // сначала вернёмся на Dashboard (навигация разрешена только оттуда)
    const back = await fsm.handle(Signals.Back);
    expect(fsm.state).toBe('Dashboard');
    // теперь идём в режим capacity
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 1, row: 1 }]));
    await fsm.handle(Signals.NavCellsCapacity);
    expect(fsm.state).toBe('CellsListReady-capacity');
    fsm.backend.getCells.mockImplementation(() => ok([{ id: 1, row: 1 }]));
    const r2 = await fsm.handle(Signals.CellsSetCellCapacity, { cellId: 1, capacity: 0 });
    expect(r2.meta.error).toBe('Invalid capacity');
  });
});
