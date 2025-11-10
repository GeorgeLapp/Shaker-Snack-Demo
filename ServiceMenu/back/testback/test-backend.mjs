import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- In-memory state (демо-данные) ----------------
let STATE = {
  tokens: new Set(["jwt"]), // допустимый токен
  // простая витрина ячеек
  cells: [
    { id: 1, row: 1, capacity: 10, stock: 3, price: 50, productId: null, status: "enabled", type: "spiral" },
    { id: 2, row: 1, capacity: 10, stock: 0, price: 45, productId: null, status: "enabled", type: "spiral" },
    { id: 7, row: 2, capacity: 12, stock: 5, price: 60, productId: null, status: "enabled", type: "spiral" },
    { id: 10,row: 2, capacity: 10, stock: 3, price: 50, productId: null, status: "enabled", type: "spiral" },
  ],
  products: [{ id: 100, name: "Lays" }, { id: 101, name: "Snickers" }],
  logs: [{ ts: new Date().toISOString(), level: "INFO", msg: "boot" }],
};

// ---------------- Error/Delay injection ----------------
// Вы можете задать для конкретного (method,path) статус ошибки и задержку.
// Механизм одноразовый или N-разовый.
const failures = new Map(); // key -> { status, times, body }
const delays = new Map();   // key -> { ms, times }
const keyOf = (method, path) => `${method.toUpperCase()} ${path}`;

// Утилита: применить инъекцию для реального path (с подстановкой :id)
function matchKey(method, actualPath) {
  // simplest: сначала прямое совпадение
  const direct = keyOf(method, actualPath);
  if (failures.has(direct) || delays.has(direct)) return direct;

  // затем пробуем шаблоны, известные роуты
  const candidates = [
    "/auth/login",
    "/cells",
    "/cells/stock/fill-row",
    "/cells/:id/stock",
    "/cells/capacity/set-for-row",
    "/cells/:id/capacity",
    "/cells/price/set-for-row",
    "/cells/:id/price",
    "/products",
    "/cells/:id/product",
    "/cells/status",
    "/cells/merge",
    "/cells/type",
    "/diagnostics/test-cells",
    "/diagnostics/logs",
  ].map(p => keyOf(method, p));

  for (const k of candidates) {
    const pattern = k.replace(/:[^/]+/g, "[^/]+").replace(/\//g, "\\/");
    const re = new RegExp(`^${pattern}$`);
    if (re.test(direct)) return k;
  }
  return direct; // fallback
}

async function maybeDelay(method, path) {
  const k = matchKey(method, path);
  const inj = delays.get(k);
  if (inj && inj.ms > 0) {
    await new Promise(r => setTimeout(r, inj.ms));
    if (inj.times > 0) inj.times -= 1;
    if (inj.times === 0) delays.delete(k);
  }
}

function maybeFail(req, res) {
  const k = matchKey(req.method, req.path);
  const inj = failures.get(k);
  if (!inj) return false;
  const status = inj.status ?? 500;
  const body = inj.body ?? { error: "Injected error" };
  if (inj.times > 0) inj.times -= 1;
  if (inj.times === 0) failures.delete(k);
  res.status(status).json(body);
  return true;
}

// ---------------- Auth guard ----------------
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || !STATE.tokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---------------- Admin API (только для тестов) ----------------
app.post("/__admin/fail", (req, res) => {
  const { method, path, status = 500, times = 1, body } = req.body || {};
  const k = keyOf(method, path);
  failures.set(k, { status, times, body });
  res.json({ ok: true, applied: { k, status, times } });
});

app.post("/__admin/delay", (req, res) => {
  const { method, path, ms = 0, times = 1 } = req.body || {};
  const k = keyOf(method, path);
  delays.set(k, { ms, times });
  res.json({ ok: true, applied: { k, ms, times } });
});

app.post("/__admin/reset", (req, res) => {
  failures.clear();
  delays.clear();
  // частичный сброс данных
  STATE = {
    ...STATE,
    cells: STATE.cells.map(c => ({ ...c })), // без изменений
    logs: [{ ts: new Date().toISOString(), level: "INFO", msg: "reset" }],
  };
  res.json({ ok: true });
});

// ---------------- Base URL ----------------
const API_PREFIX = "/api/v1";

// ---------------- Endpoints ----------------

// AUTH
app.post(`${API_PREFIX}/auth/login`, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;

  const { pin } = req.body || {};
  if (pin && pin !== "bad") {
    return res.json({ accessToken: "jwt" });
  }
  return res.status(401).json({ error: "Unauthorized" });
});

// CELLS
app.get(`${API_PREFIX}/cells`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  res.json(STATE.cells);
});

app.post(`${API_PREFIX}/cells/stock/fill-row`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { row } = req.body || {};
  const capacityByRow = {};
  STATE.cells.forEach(c => {
    capacityByRow[c.row] = Math.max(capacityByRow[c.row] || 0, c.capacity || 0);
  });
  const maxCap = capacityByRow[row] || 0;
  STATE.cells = STATE.cells.map(c => (c.row === row ? { ...c, stock: maxCap } : c));
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/:id/stock`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const id = Number(req.params.id);
  const { stock } = req.body || {};
  const i = STATE.cells.findIndex(c => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  STATE.cells[i] = { ...STATE.cells[i], stock };
  res.json({});
});

app.put(`${API_PREFIX}/cells/capacity/set-for-row`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { row, capacity } = req.body || {};
  STATE.cells = STATE.cells.map(c => (c.row === row ? { ...c, capacity } : c));
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/:id/capacity`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const id = Number(req.params.id);
  const { capacity } = req.body || {};
  const i = STATE.cells.findIndex(c => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  STATE.cells[i] = { ...STATE.cells[i], capacity };
  res.json({});
});

app.put(`${API_PREFIX}/cells/price/set-for-row`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { row, price } = req.body || {};
  STATE.cells = STATE.cells.map(c => (c.row === row ? { ...c, price } : c));
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/:id/price`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const id = Number(req.params.id);
  const { price } = req.body || {};
  const i = STATE.cells.findIndex(c => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  STATE.cells[i] = { ...STATE.cells[i], price };
  res.json({});
});

// PRODUCTS
app.get(`${API_PREFIX}/products`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  res.json(STATE.products);
});

app.put(`${API_PREFIX}/cells/:id/product`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const id = Number(req.params.id);
  const { productId } = req.body || {};
  const i = STATE.cells.findIndex(c => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  STATE.cells[i] = { ...STATE.cells[i], productId };
  res.json({});
});

// CONFIG
app.post(`${API_PREFIX}/cells/status`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { cellIds, status } = req.body || {};
  STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, status } : c));
  res.status(204).end();
});

app.post(`${API_PREFIX}/cells/merge`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  // Семантику "объединения" не эмулируем глубоко; считаем успешной
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/type`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { cellIds, type } = req.body || {};
  STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, type } : c));
  res.status(204).end();
});

// DIAGNOSTICS
app.post(`${API_PREFIX}/diagnostics/test-cells`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { cellIds = [] } = req.body || {};
  const results = cellIds.map(id => ({ cellId: id, status: "SUCCESS" }));
  res.json(results);
});

// LOGS
app.get(`${API_PREFIX}/diagnostics/logs`, requireAuth, async (req, res) => {
  await maybeDelay(req.method, req.path);
  if (maybeFail(req, res)) return;
  const { search, full } = req.query;
  let out = [...STATE.logs];
  if (search) out = out.filter(x => (x.msg || "").includes(String(search)));
  if (full) out = out.concat([{ ts: new Date().toISOString(), level: "DEBUG", msg: "full dump chunk" }]);
  res.json(out);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Test backend running at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Admin: POST /__admin/fail, /__admin/delay, /__admin/reset`);
});
