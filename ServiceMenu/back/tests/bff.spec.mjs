import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import request from 'supertest';

// --- Моки ---
vi.mock('../fsm-service-menu.js', () => {
  const spy = vi.fn();
  class MockFSM {
    constructor() {
      this.state = 'Idle';
      this.handle = spy;
    }
  }
  return { ServiceMenuFSM: MockFSM, __handleSpy: spy };
});
vi.mock('morgan', () => ({ default: () => (_req, _res, next) => next() }));

// --- Динамические импорты после настройки моков ---
const { app } = await import('../bff-server.mjs');
const { __handleSpy: handleSpy } = await import('../fsm-service-menu.js');

// --- Фикстуры ---
const HAPPY_REPLY = { state: 'Dashboard', view: { screen: 'Dashboard' }, meta: { traceId: 't-001' } };
const LOGICAL_ERROR_REPLY = { state: 'Error', view: { screen: 'Error', message: 'Business rule violated' } };

const ROUTES = [
  // UI / Навигация
  { method: 'post', path: '/bff/ui/open-settings', signal: 'UI.OpenSettings', body: {} },
  { method: 'post', path: '/bff/ui/nav/cells-stocks', signal: 'UI.Navigate.CellsStocks', body: {} },
  { method: 'post', path: '/bff/ui/nav/cells-capacity', signal: 'UI.Navigate.CellsCapacity', body: {} },
  { method: 'post', path: '/bff/ui/nav/cells-prices', signal: 'UI.Navigate.CellsPrices', body: {} },
  { method: 'post', path: '/bff/ui/nav/cells-products', signal: 'UI.Navigate.CellsProducts', body: {} },
  { method: 'post', path: '/bff/ui/nav/cells-config', signal: 'UI.Navigate.CellsConfig', body: {} },
  { method: 'post', path: '/bff/ui/nav/diagnostics', signal: 'UI.Navigate.DiagnosticsTest', body: {} },
  { method: 'post', path: '/bff/ui/nav/logs', signal: 'UI.Navigate.Logs', body: {} },
  { method: 'post', path: '/bff/ui/back', signal: 'UI.Back', body: {} },
  { method: 'post', path: '/bff/ui/retry', signal: 'UI.Retry', body: {} },

  // Auth
  { method: 'post', path: '/bff/auth/login', signal: 'Auth.SubmitPin', body: { pin: '1234' } },
  { method: 'post', path: '/bff/auth/logout', signal: 'Auth.Logout', body: {} },

  // Ячейки
  { method: 'post', path: '/bff/cells/stock', signal: 'Cells.EditStock', body: { cellId: 12, stock: 5 } },
  { method: 'post', path: '/bff/cells/fill-row', signal: 'Cells.FillRow', body: { row: 2 } },
  { method: 'post', path: '/bff/cells/capacity/row', signal: 'Cells.SetRowCapacity', body: { row: 3, capacity: 10 } },
  { method: 'post', path: '/bff/cells/capacity/cell', signal: 'Cells.SetCellCapacity', body: { cellId: 7, capacity: 12 } },
  { method: 'post', path: '/bff/cells/price/row', signal: 'Cells.SetRowPrice', body: { row: 1, price: 210.5 } },
  { method: 'post', path: '/bff/cells/price/cell', signal: 'Cells.SetCellPrice', body: { cellId: 5, price: 250 } },
  { method: 'post', path: '/bff/products/open-list', signal: 'Cells.OpenAssignProduct', body: {} },
  { method: 'post', path: '/bff/products/assign', signal: 'Products.Assign', body: { cellId: 5, productId: 101 } },
  { method: 'post', path: '/bff/cells/status', signal: 'Cells.SetStatus', body: { cellIds: [1, 2], status: 'disabled' } },
  { method: 'post', path: '/bff/cells/merge', signal: 'Cells.Merge', body: { cellIds: [10, 11] } },
  { method: 'post', path: '/bff/cells/type', signal: 'Cells.SetType', body: { cellIds: [21, 22], type: 'SPIRAL_BOTTLE' } },

  // Диагностика и логи
  { method: 'post', path: '/bff/diagnostics/run', signal: 'Diagnostics.RunTest', body: { cellIds: [1, 2, 3] } },
  { method: 'post', path: '/bff/diagnostics/rerun', signal: 'UI.Rerun', body: { cellIds: [1, 2, 3] } },
  { method: 'post', path: '/bff/logs/search', signal: 'Logs.Search', body: { text: 'ProductService' } },
  { method: 'post', path: '/bff/logs/full', signal: 'Logs.ToggleFull', body: { on: true } },
];

beforeEach(() => {
  handleSpy.mockReset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BFF Service Menu — health & CORS & parser', () => {
  it('GET /bff/health → 200 и ok:true', async () => {
    const res = await request(app).get('/bff/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('fsmState');
  });

  it('CORS: простой запрос имеет заголовок Access-Control-Allow-Origin', async () => {
    handleSpy.mockResolvedValue(HAPPY_REPLY);
    const res = await request(app)
      .post('/bff/ui/open-settings')
      .set('Origin', 'https://ui.example')
      .send({});
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('CORS: preflight OPTIONS', async () => {
    const res = await request(app)
      .options('/bff/auth/login')
      .set('Origin', 'https://ui.example')
      .set('Access-Control-Request-Method', 'POST');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('Невалидный JSON → 400', async () => {
    const res = await request(app)
      .post('/bff/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"pin": "1234"'); // обрезанный JSON
    expect(res.status).toBe(400);
  });

  it('Тело больше лимита 512kb → 413', async () => {
    handleSpy.mockResolvedValue(HAPPY_REPLY); // не должно дойти
    const big = 'a'.repeat(600 * 1024);
    const res = await request(app)
      .post('/bff/logs/search')
      .set('Content-Type', 'application/json')
      .send({ text: big });
    expect(res.status).toBe(413);
  });
});

describe('BFF Service Menu — параметризованные маршруты', () => {
  it.each(ROUTES.map((r) => [r.path, r]))('%s → happy-path (200, прозрачный ответ)', async (_label, r) => {
    handleSpy.mockResolvedValueOnce(HAPPY_REPLY);
    const res = await request(app)[r.method](r.path).send(r.body || {});
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(HAPPY_REPLY);
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(r.signal, r.body || {});
  });

  it.each(ROUTES.map((r) => [r.path, r]))('%s → FSM вернул "логическую ошибку" (тоже 200)', async (_label, r) => {
    handleSpy.mockResolvedValueOnce(LOGICAL_ERROR_REPLY);
    const res = await request(app)[r.method](r.path).send(r.body || {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(LOGICAL_ERROR_REPLY);
    expect(handleSpy).toHaveBeenCalledWith(r.signal, r.body || {});
  });

  it.each(ROUTES.map((r) => [r.path, r]))('%s → Исключение из FSM → 500, тело с meta.cause/path', async (_label, r) => {
    handleSpy.mockRejectedValueOnce(new Error('boom'));
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app)[r.method](r.path).send(r.body || {});
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      state: 'Error',
      view: { screen: 'Error', message: 'BFF internal error' },
      meta: { cause: 'boom', path: r.path },
    });
    expect(spyErr).toHaveBeenCalledTimes(1);
  });

  it.each(ROUTES.map((r) => [r.path, r]))('%s → Прозрачность payload (доп. поля не теряются)', async (_label, r) => {
    const payload = { ...(r.body || {}), _debug: true, nested: { x: 1, arr: [1, 2] } };
    handleSpy.mockResolvedValueOnce(HAPPY_REPLY);
    const res = await request(app)[r.method](r.path).send(payload);
    expect(res.status).toBe(200);
    expect(handleSpy).toHaveBeenCalledWith(r.signal, payload);
  });
});

describe('Payload edge-cases', () => {
  it('Auth.SubmitPin: строки/пусто пробрасываются как есть', async () => {
    handleSpy.mockResolvedValueOnce(HAPPY_REPLY);
    const res = await request(app).post('/bff/auth/login').send({ pin: '' });
    expect(res.status).toBe(200);
    expect(handleSpy).toHaveBeenCalledWith('Auth.SubmitPin', { pin: '' });
  });

  it('Cells.EditStock: отрицательные/большие значения не валидируются в BFF', async () => {
    handleSpy.mockResolvedValueOnce(HAPPY_REPLY);
    const payload = { cellId: 1, stock: -10 };
    const res = await request(app).post('/bff/cells/stock').send(payload);
    expect(res.status).toBe(200);
    expect(handleSpy).toHaveBeenCalledWith('Cells.EditStock', payload);
  });

  it('Logs.ToggleFull: нестандартные типы проходят как есть', async () => {
    handleSpy.mockResolvedValueOnce(HAPPY_REPLY);
    const payload = { on: 'yes' }; // специально строка
    const res = await request(app).post('/bff/logs/full').send(payload);
    expect(res.status).toBe(200);
    expect(handleSpy).toHaveBeenCalledWith('Logs.ToggleFull', payload);
  });
});
