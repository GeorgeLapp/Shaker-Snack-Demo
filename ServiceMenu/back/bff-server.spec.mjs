// bff-server.spec.mjs
// Рабочий юнит-тест BFF (Vitest + Supertest). ESM-версия.
// Если ранее был "No test suite found", этот файл исправит ситуацию.

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import request from 'supertest';

const importPath = './bff-server.mjs';   // при необходимости поправь
const listenPort = 3001;
const baseURL = `http://localhost:${listenPort}`;

let serverModule;
let fsmMock;
let handleSpy;
let origEnv = {};

async function bootServer() {
  vi.resetModules();
  process.env = { ...process.env, BFF_PORT: String(listenPort) };

  // Мок FSM ДО импорта сервера
  vi.mock('./fsm-service-menu.js', () => {
    const handle = vi.fn();
    class ServiceMenuFSM {
      constructor(opts) {
        this._opts = opts;
        this.handle = handle;
      }
    }
    return { ServiceMenuFSM, __mock__: { handle } };
  });

  fsmMock = await import('./fsm-service-menu.js');
  handleSpy = fsmMock.__mock__.handle;

  // Импортируем сервер — он поднимется на listenPort
  serverModule = await import(importPath);
}

// ——— Базовая SMOKE-проверка, чтобы Vitest точно видел сьют ———
describe('SMOKE: vitest executes this file', () => {
  it('registers test suite', () => {
    expect(true).toBe(true);
  });
});

beforeAll(async () => {
  origEnv = { ...process.env };
  await bootServer();
});

afterAll(async () => {
  process.env = origEnv;
});

beforeEach(() => {
  handleSpy.mockReset();
});

function mockHappy(reply = {
  state: 'Dashboard',
  view: { screen: 'Dashboard' },
  meta: { traceId: 't-001' },
}) {
  handleSpy.mockResolvedValue(reply);
  return reply;
}
function mockLogicalError(reply = {
  state: 'Error',
  view: { screen: 'Error', message: 'Business rule violated' },
}) {
  handleSpy.mockResolvedValue(reply);
  return reply;
}
function mockThrow(err = new Error('boom')) {
  handleSpy.mockRejectedValue(err);
}

async function expect500(res, routePath) {
  expect(res.status).toBe(500);
  expect(res.body?.state).toBe('Error');
  expect(res.body?.view?.screen).toBe('Error');
  expect(res.body?.view?.message).toBe('BFF internal error');
  expect(res.body?.meta?.cause).toBeDefined();
  expect(res.body?.meta?.path).toBe(routePath);
}

const routes = [
  ['post', '/bff/ui/open-settings', 'UI.OpenSettings', {}],
  ['post', '/bff/ui/nav/cells-stocks', 'UI.Navigate.CellsStocks', {}],
  ['post', '/bff/ui/nav/cells-capacity', 'UI.Navigate.CellsCapacity', {}],
  ['post', '/bff/ui/nav/cells-prices', 'UI.Navigate.CellsPrices', {}],
  ['post', '/bff/ui/nav/cells-products', 'UI.Navigate.CellsProducts', {}],
  ['post', '/bff/ui/nav/cells-config', 'UI.Navigate.CellsConfig', {}],
  ['post', '/bff/ui/nav/diagnostics', 'UI.Navigate.DiagnosticsTest', {}],
  ['post', '/bff/ui/nav/logs', 'UI.Navigate.Logs', {}],
  ['post', '/bff/ui/back', 'UI.Back', {}],
  ['post', '/bff/ui/retry', 'UI.Retry', {}],
  ['post', '/bff/auth/login', 'Auth.SubmitPin', { pin: '1234' }],
  ['post', '/bff/auth/logout', 'Auth.Logout', {}],
  ['post', '/bff/cells/stock', 'Cells.EditStock', { cellId: 12, stock: 5 }],
  ['post', '/bff/cells/fill-row', 'Cells.FillRow', { row: 2 }],
  ['post', '/bff/cells/capacity/row', 'Cells.SetRowCapacity', { row: 3, capacity: 10 }],
  ['post', '/bff/cells/capacity/cell', 'Cells.SetCellCapacity', { cellId: 7, capacity: 12 }],
  ['post', '/bff/cells/price/row', 'Cells.SetRowPrice', { row: 1, price: 210.5 }],
  ['post', '/bff/cells/price/cell', 'Cells.SetCellPrice', { cellId: 5, price: 250 }],
  ['post', '/bff/products/open-list', 'Cells.OpenAssignProduct', {}],
  ['post', '/bff/products/assign', 'Products.Assign', { cellId: 5, productId: 101 }],
  ['post', '/bff/cells/status', 'Cells.SetStatus', { cellIds: [1, 2], status: 'disabled' }],
  ['post', '/bff/cells/merge', 'Cells.Merge', { cellIds: [10, 11] }],
  ['post', '/bff/cells/type', 'Cells.SetType', { cellIds: [21, 22], type: 'SPIRAL_BOTTLE' }],
  ['post', '/bff/diagnostics/run', 'Diagnostics.RunTest', { cellIds: [1, 2, 3] }],
  ['post', '/bff/diagnostics/rerun', 'UI.Rerun', { cellIds: [1, 2, 3] }],
  ['post', '/bff/logs/search', 'Logs.Search', { text: 'ProductService' }],
  ['post', '/bff/logs/full', 'Logs.ToggleFull', { on: true }],
];

describe('BFF Service Menu — health & CORS & parser', () => {
  it('GET /bff/health → 200 + {ok:true}', async () => {
    const res = await request(baseURL).get('/bff/health');
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(typeof res.body?.fsmState).toBe('string');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('CORS simple request adds ACAO', async () => {
    mockHappy();
    const res = await request(baseURL)
      .post('/bff/ui/open-settings')
      .set('Origin', 'https://ui.example')
      .send({});
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('CORS preflight (OPTIONS) returns allow headers', async () => {
    const res = await request(baseURL)
      .options('/bff/auth/login')
      .set('Origin', 'https://ui.example')
      .set('Access-Control-Request-Method', 'POST');
    expect([200, 204]).toContain(res.status);
    const allowMethods = (res.headers['access-control-allow-methods'] || '').toUpperCase();
    expect(allowMethods).toContain('POST');
  });

  it('Bad JSON → 400 from express.json', async () => {
    const res = await request(baseURL)
      .post('/bff/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"pin":"1234"'); // битый JSON
    expect(res.status).toBe(400);
  });

  it('Payload > 512KB → 413', async () => {
    const large = 'x'.repeat(600 * 1024);
    const res = await request(baseURL)
      .post('/bff/logs/search')
      .set('Content-Type', 'application/json')
      .send({ text: large });
    expect(res.status).toBe(413);
  });

  it('No Content-Type (plain text) → body becomes {}', async () => {
    mockHappy();
    const res = await request(baseURL)
      .post('/bff/ui/open-settings')
      .send('just text without JSON');
    expect(res.status).toBe(200);
    expect(handleSpy).toHaveBeenCalledWith('UI.OpenSettings', {});
  });
});

describe.each(routes)('BFF route: %s %s → %s', (method, path, signal, payload) => {
  it('Happy path: forwards exact signal+payload and returns FSM reply', async () => {
    const reply = mockHappy();
    const res = await request(baseURL)[method](path).send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(reply);
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(signal, payload ?? {});
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('Logical error (FSM returns Error view) → still 200 passthrough', async () => {
    const reply = mockLogicalError();
    const res = await request(baseURL)[method](path).send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(reply);
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(signal, payload ?? {});
  });

  it('FSM throws → 500 with normalized error body', async () => {
    mockThrow(new Error('backend down'));
    const res = await request(baseURL)[method](path).send(payload);
    await expect500(res, path);
  });

  it('Payload transparency: forwards extra fields as-is', async () => {
    const reply = mockHappy();
    const enriched = { ...(payload ?? {}), _debug: true, nested: { x: 1, arr: [1, 2] } };
    const res = await request(baseURL)[method](path).send(enriched);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(reply);
    expect(handleSpy).toHaveBeenCalledWith(signal, enriched);
  });
});

describe('Domain payload edges are forwarded unchanged', () => {
  it('Cells.EditStock: stock boundaries and types', async () => {
    mockHappy();
    await request(baseURL).post('/bff/cells/stock').send({ cellId: 1, stock: 0 });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.EditStock', { cellId: 1, stock: 0 });

    await request(baseURL).post('/bff/cells/stock').send({ cellId: 1, stock: -1 });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.EditStock', { cellId: 1, stock: -1 });

    await request(baseURL).post('/bff/cells/stock').send({ cellId: 'X', stock: '5' });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.EditStock', { cellId: 'X', stock: '5' });
  });

  it('Auth.SubmitPin: various forms', async () => {
    mockHappy();
    await request(baseURL).post('/bff/auth/login').send({ pin: '' });
    expect(handleSpy).toHaveBeenLastCalledWith('Auth.SubmitPin', { pin: '' });

    await request(baseURL).post('/bff/auth/login').send({ pin: '   1234  ' });
    expect(handleSpy).toHaveBeenLastCalledWith('Auth.SubmitPin', { pin: '   1234  ' });

    await request(baseURL).post('/bff/auth/login').send({});
    expect(handleSpy).toHaveBeenLastCalledWith('Auth.SubmitPin', {});
  });

  it('Price/Capacity edge cases', async () => {
    mockHappy();
    await request(baseURL).post('/bff/cells/price/row').send({ row: 1, price: 0 });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.SetRowPrice', { row: 1, price: 0 });

    await request(baseURL).post('/bff/cells/capacity/cell').send({ cellId: 7, capacity: 0 });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.SetCellCapacity', { cellId: 7, capacity: 0 });

    await request(baseURL).post('/bff/cells/capacity/cell').send({ cellId: 7, capacity: -5 });
    expect(handleSpy).toHaveBeenLastCalledWith('Cells.SetCellCapacity', { cellId: 7, capacity: -5 });
  });

  it('Diagnostics/Logs forms', async () => {
    mockHappy();
    await request(baseURL).post('/bff/diagnostics/run').send({ cellIds: [] });
    expect(handleSpy).toHaveBeenLastCalledWith('Diagnostics.RunTest', { cellIds: [] });

    await request(baseURL).post('/bff/logs/search').send({ text: '' });
    expect(handleSpy).toHaveBeenLastCalledWith('Logs.Search', { text: '' });

    await request(baseURL).post('/bff/logs/full').send({ on: 'yes' });
    expect(handleSpy).toHaveBeenLastCalledWith('Logs.ToggleFull', { on: 'yes' });
  });
});
