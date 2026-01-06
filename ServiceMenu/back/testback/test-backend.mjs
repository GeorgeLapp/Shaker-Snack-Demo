import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- Telemetry HTTP client ----------------

const MACHINE_CELLS_COUNT = Number(process.env.MACHINE_CELLS_COUNT || 60);

const TELEMETRY_API_BASE_URL =
  (process.env.TELEMETRY_API_BASE_URL || "http://localhost:3002").replace(/\/+$/, "");

const CONTROLLER_API_BASE_URL =
  (process.env.VENDING_CONTROLLER_API_URL || "http://127.0.0.1:5000/api/v1").replace(/\/+$/, "");
const CONTROLLER_REQUEST_TIMEOUT_MS = Number(
  process.env.VENDING_CONTROLLER_REQUEST_TIMEOUT_MS || 10000,
);

const ALLOWED_CELL_TYPES = new Set(["spiral", "conveyor"]);

function normalizeCellType(value, fallback = "spiral") {
  const t = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ALLOWED_CELL_TYPES.has(t) ? t : fallback;
}

let telemetryFetchImplPromise = null;
async function getTelemetryFetch() {
  if (typeof fetch === "function") {
    return fetch;
  }
  if (!telemetryFetchImplPromise) {
    telemetryFetchImplPromise = import("node-fetch").then(({ default: nodeFetch }) => nodeFetch);
  }
  return telemetryFetchImplPromise;
}

async function telemetryFetchJson(path, { method = "GET", body } = {}) {
  const fetchImpl = await getTelemetryFetch();
  const url = `${TELEMETRY_API_BASE_URL}${path}`;

  const init = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetchImpl(url, init);
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore parse error, json остаётся null
    }
  }

  if (!res.ok) {
    const message =
      (json && typeof json.message === "string" && json.message) ||
      `Telemetry HTTP ${res.status}`;
    const err = new Error(message);
    err.statusCode = res.status;
    err.body = json ?? text;
    throw err;
  }

  return json;
}

async function controllerFetchJson(path, { method = "GET", body } = {}) {
  const fetchImpl = await getTelemetryFetch();
  const url = `${CONTROLLER_API_BASE_URL}${path}`;

  const init = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const timeoutMs =
    Number.isFinite(CONTROLLER_REQUEST_TIMEOUT_MS) && CONTROLLER_REQUEST_TIMEOUT_MS > 0
      ? CONTROLLER_REQUEST_TIMEOUT_MS
      : null;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  if (controller) {
    init.signal = controller.signal;
  }

  let res;
  try {
    res = await fetchImpl(url, init);
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    const error = new Error(`Controller request failed: ${err.message || err}`);
    error.statusCode = err?.name === "AbortError" ? 504 : 502;
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore parse error, json stays null
    }
  }

  if (!res.ok) {
    const message =
      (json && json.error && typeof json.error.message === "string" && json.error.message) ||
      `Controller HTTP ${res.status}`;
    const err = new Error(message);
    err.statusCode = res.status;
    err.body = json ?? text;
    throw err;
  }

  return json;
}

async function controllerRequest(path, { method = "GET", body } = {}) {
  const json = await controllerFetchJson(path, { method, body });

  if (!json || typeof json !== "object") {
    const err = new Error("Controller response is empty");
    err.statusCode = 502;
    throw err;
  }

  if (json.success === false) {
    const err = new Error(
      (json.error && json.error.message) || "Controller rejected the command",
    );
    err.statusCode = 502;
    err.code = json.error?.code;
    err.details = json.error?.details;
    throw err;
  }

  return typeof json.data !== "undefined" ? json.data : json;
}

async function controllerMakeDouble(channel) {
  if (!Number.isInteger(channel) || channel <= 0) {
    const err = new Error('controllerMakeDouble: "channel" must be a positive integer');
    err.statusCode = 400;
    throw err;
  }
  return controllerRequest(`/channels/${channel}/mode/double`, { method: "POST" });
}

async function controllerMakeSingle(channel) {
  if (!Number.isInteger(channel) || channel <= 0) {
    const err = new Error('controllerMakeSingle: "channel" must be a positive integer');
    err.statusCode = 400;
    throw err;
  }
  return controllerRequest(`/channels/${channel}/mode/single`, { method: "POST" });
}

async function controllerPollChannels(maxChannel) {
  const q = new URLSearchParams();
  if (Number.isInteger(maxChannel) && maxChannel > 0) {
    q.set("maxChannel", String(maxChannel));
  }
  const query = q.toString();
  const path = query ? `/channels/poll?${query}` : "/channels/poll";
  const data = await controllerRequest(path);
  if (!Array.isArray(data)) {
    const err = new Error("Controller poll response is invalid");
    err.statusCode = 502;
    throw err;
  }
  return data;
}

async function fetchTelemetryMatrix() {
  return telemetryFetchJson("/api/matrix");
}

async function fetchTelemetryCatalog() {
  return telemetryFetchJson("/api/catalog");
}

async function postTelemetryCells(cells) {
  if (!cells || cells.length === 0) return;
  await telemetryFetchJson("/api/telemetry/matrix/cells", {
    method: "POST",
    body: cells,
  });
}

async function postTelemetryVolumes(cells) {
  if (!cells || cells.length === 0) return;
  await telemetryFetchJson("/api/telemetry/matrix/volumes", {
    method: "POST",
    body: cells,
  });
}

// Special "no product" placeholder (id = 0)
const NO_PRODUCT = {
  id: 0,
  brandName: "-",
  productName: "Нет товара",
  imgPath: "/img/products/no-product.png",
  name: "Нет товара",
};

// ---------------- In-memory state (Emulated Data) ----------------
let STATE = {
  tokens: new Map([["jwt", { role: "ENGINEER", username: "service_eng" }]]),
  // Эмуляция состояния "железа"
  hw: {
    door: "closed",
    temperature: 4.5,
    lighting: true,
    controllerOnline: true,
  },
  cells: [
    { id: 1, row: 1, capacity: 10, stock: 3, price: 50, productId: 100, status: "enabled", type: "spiral" },
    { id: 2, row: 1, capacity: 10, stock: 0, price: 45, productId: null, status: "enabled", type: "spiral" },
    { id: 7, row: 2, capacity: 12, stock: 5, price: 60, productId: null, status: "enabled", type: "spiral" },
    { id: 10,row: 2, capacity: 10, stock: 3, price: 50, productId: null, status: "disabled", type: "spiral" },
  ],
  products: [
    {
      id: 0,
      brandName: "-",
      productName: "Нет товара",
      imgPath: "/img/products/no-product.png",
      name: "Нет товара",
    },
    {
      id: 100,
      brandName: "Lays",
      productName: "Lays Сметана и лук 120 г",
      imgPath: "/img/products/100.png",
      name: "Lays Сметана и лук 120 г",
    },
    {
      id: 101,
      brandName: "Snickers",
      productName: "Snickers 50 г",
      imgPath: "/img/products/101.png",
      name: "Snickers 50 г",
    },
  ],
  logs: [
    { ts: new Date(Date.now() - 100000).toISOString(), level: "INFO", msg: "System boot" },
    { ts: new Date(Date.now() - 50000).toISOString(), level: "WARN", msg: "Door opened" },
    { ts: new Date().toISOString(), level: "INFO", msg: "Service menu accessed" }
  ],
};

// Генератор большого количества логов для теста пагинации
for(let i=0; i<50; i++) {
    STATE.logs.unshift({
        ts: new Date(Date.now() - i * 1000).toISOString(),
        level: i % 5 === 0 ? "ERROR" : "INFO",
        msg: `Simulated log entry #${i} from Controller`
    });
}

// ---------------- Helpers ----------------

function buildCellDtoWithProduct(cell) {
  const productId = cell.productId ?? 0;
  const product = STATE.products.find((p) => p.id === productId);

  // Эмуляция полей диагностики
  const diagInfo = {
    lastError: cell.lastError ?? null,
    updatedAt: cell.motorUpdatedAt ?? null,
    motorStatus: cell.motorStatus ?? "OK",
  };

  if (!product) {
    return { ...cell, productId: 0, imgPath: null, brandName: null, productName: null, ...diagInfo };
  }

  return {
    ...cell,
    productId: product.id,
    imgPath: product.imgPath ?? null,
    brandName: product.brandName ?? null,
    productName: product.productName ?? product.name ?? null,
    ...diagInfo
  };
}

function mapTelemetryMatrixRowsToCells(rows) {
  if (!Array.isArray(rows)) return [];

  const cells = rows
  .map((row) => {
    const cellNumber = Number(row.cell_number ?? row.cellNumber);
    const rowNumber = row.row_number ?? row.rowNumber ?? null;
    const volume = row.volume ?? 0;
    const maxVolume = row.max_volume ?? row.maxVolume ?? 0;
    const goodId = row.good_id ?? row.goodId ?? null;
    const sizeValue = row.size ?? 1;
    const size =
      typeof sizeValue === "number" && Number.isFinite(sizeValue) && sizeValue >= 0
        ? sizeValue
        : 1;
    const enabled = row.enabled ?? 1;
    const motorStatus = row.motor_status ?? row.motorStatus ?? null;
    const motorUpdatedAt = row.updated_at ?? row.updatedAt ?? null;
    const motorError = row.last_error ?? row.lastError ?? null;

    return {
      id: cellNumber,
      row: typeof rowNumber === "number" ? rowNumber : calcRowFromCellId(cellNumber),
      capacity: maxVolume || 0,
      stock: volume || 0,
      price:
        typeof row.price === "number"
          ? row.price
          : typeof row.price_minor === "number"
          ? row.price_minor / 100
          : typeof row.priceMinor === "number"
          ? row.priceMinor / 100
          : 0,
      productId: goodId != null ? Number(goodId) : null,
      status: enabled === 0 ? "disabled" : "enabled",
      type: normalizeCellType(row.type ?? row.cellType, "spiral"),
      size,
      mergedTo: null,
      motorStatus: motorStatus ?? null,
      motorUpdatedAt: motorUpdatedAt ?? null,
      lastError: motorError ?? null,
    };
  })
  .filter(Boolean);

  applyMergedLinksFromSizes(cells);

  return cells;
}

function getCellRowNumber(cell) {
  return typeof cell?.row === "number" ? cell.row : calcRowFromCellId(cell?.id);
}

function applyMergedLinksFromSizes(cells) {
  /** @type {Map<number, any[]>} */
  const byRow = new Map();

  for (const cell of cells) {
    const row = getCellRowNumber(cell) ?? 0;
    const arr = byRow.get(row) || [];
    arr.push(cell);
    byRow.set(row, arr);
  }

  for (const rowCells of byRow.values()) {
    rowCells.sort((a, b) => a.id - b.id);

    let activeMaster = null;
    let remaining = 0;

    for (const cell of rowCells) {
      if (remaining > 0) {
        cell.mergedTo = activeMaster;
        remaining -= 1;
        continue;
      }

      const normalizedSize = Number.isFinite(cell.size) ? Number(cell.size) : 1;
      if (normalizedSize > 1) {
        activeMaster = cell.id;
        remaining = Math.max(0, Math.floor(normalizedSize) - 1);
      } else {
        activeMaster = null;
        remaining = 0;
      }
    }
  }
}

function mapTelemetryCatalogRowsToProducts(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const id = Number(row.id);
    const brandName = row.brand_name ?? row.brandName ?? "-";
    const productName =
      row.taste ?? row.product_name ?? row.productName ?? row.name ?? "";
    const imgPath =
      row.imgPath ?? row.img_url ?? row.imgUrl ?? null;

    return {
      id,
      brandName,
      productName,
      imgPath,
      name: productName,
    };
  });
}

function normalizeCellsSizes(cells) {
  const items = Array.isArray(cells) ? cells.map((c) => ({ ...c })) : [];
  const slavesByMaster = new Map();

  for (const cell of items) {
    if (cell.mergedTo != null) {
      const arr = slavesByMaster.get(cell.mergedTo) || [];
      arr.push(cell.id);
      slavesByMaster.set(cell.mergedTo, arr);
    }
  }

  return items.map((cell) => {
    if (cell.mergedTo != null) {
      // slave: logical size 0, master will hold the combined slot count
      return { ...cell, size: 0 };
    }
    const slaveCount = slavesByMaster.get(cell.id)?.length || 0;
    const size = 1 + slaveCount;
    return { ...cell, size };
  });
}

function expandCellIdsWithLinks(ids) {
  const queue = Array.isArray(ids) ? [...ids] : [];
  const result = new Set();

  while (queue.length) {
    const rawId = queue.pop();
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0 || result.has(id)) continue;

    result.add(id);

    const cell = STATE.cells.find((c) => c.id === id);
    if (!cell) continue;

    if (cell.mergedTo != null) {
      queue.push(cell.mergedTo);
    }

    for (const c of STATE.cells) {
      if (c.mergedTo === id) {
        queue.push(c.id);
      }
    }
  }

  return Array.from(result);
}

function getMergedMasterIds(ids) {
  const masters = new Set();

  for (const rawId of ids || []) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) continue;
    const cell = STATE.cells.find((c) => c.id === id);
    if (!cell) continue;

    const masterId = cell.mergedTo ?? cell.id;
    const hasSlaves = STATE.cells.some((c) => c.mergedTo === masterId);
    if (hasSlaves) {
      masters.add(masterId);
    }
  }

  return Array.from(masters);
}

async function applyControllerMergePairs(pairs) {
  for (const [leftId] of pairs || []) {
    await controllerMakeDouble(leftId);
  }
}

async function applyControllerSplitMasters(masterIds) {
  for (const masterId of masterIds || []) {
    await controllerMakeSingle(masterId);
  }
}

function ensureCellExists(cellId, rowNumber) {
  let cell = STATE.cells.find((c) => c.id === cellId);
  if (cell) return cell;

  const row = rowNumber ?? calcRowFromCellId(cellId);
  cell = {
    id: cellId,
    row,
    capacity: 0,
    stock: 0,
    price: 0,
    productId: NO_PRODUCT.id,
    status: "enabled",
    type: "spiral",
    size: 1,
    mergedTo: null,
    motorStatus: "OK",
    motorUpdatedAt: null,
    lastError: null,
  };

  STATE.cells.push(cell);
  return cell;
}

function persistMotorStatus(cellId, status, message, updatedAt) {
  const idx = STATE.cells.findIndex((c) => c.id === cellId);
  if (idx === -1) return;

  STATE.cells[idx] = {
    ...STATE.cells[idx],
    motorStatus: status ?? STATE.cells[idx].motorStatus ?? "OK",
    lastError: message ?? null,
    motorUpdatedAt: updatedAt ?? new Date().toISOString(),
  };
}

function splitCellsByIds(ids, { clear = false } = {}) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  if (idSet.size === 0) return [];

  const changed = [];
  STATE.cells = STATE.cells.map((c) => {
    if (!idSet.has(c.id)) return c;

    const next = {
      ...c,
      size: 1,
      status: "enabled",
      mergedTo: null,
    };

    if (clear) {
      next.productId = NO_PRODUCT.id;
      next.stock = 0;
      next.capacity = 0;
    }

    changed.push(next);
    return next;
  });

  return changed;
}

async function refreshStateFromTelemetry() {
  try {
    const [matrix, catalog] = await Promise.all([
      fetchTelemetryMatrix(),
      fetchTelemetryCatalog().catch(() => []),
    ]);

    const newCells = mapTelemetryMatrixRowsToCells(matrix);
    const prevCells = Array.isArray(STATE.cells) ? STATE.cells : [];
    const prevById = new Map(prevCells.map((c) => [c.id, c]));

    // Preserve master/slave links (mergedTo) and explicit types while refreshing cells from telemetry
    STATE.cells = newCells.map((cell) => {
      const prev = prevById.get(cell.id);
      const mergedTo =
        typeof cell.mergedTo !== "undefined"
          ? cell.mergedTo
          : prev && typeof prev.mergedTo !== "undefined"
          ? prev.mergedTo
          : null;
      const type = normalizeCellType(prev?.type, cell.type);
      const motorStatus = prev?.motorStatus ?? cell.motorStatus ?? "OK";
      const motorUpdatedAt = prev?.motorUpdatedAt ?? cell.motorUpdatedAt ?? null;
      const lastError = prev?.lastError ?? cell.lastError ?? null;
      return { ...cell, mergedTo, type, motorStatus, motorUpdatedAt, lastError };
    });
    STATE.cells = normalizeCellsSizes(STATE.cells);

    const productsFromTelemetry = mapTelemetryCatalogRowsToProducts(catalog);
    const hasNoProduct = productsFromTelemetry.some((p) => p.id === NO_PRODUCT.id);
    STATE.products = hasNoProduct
      ? productsFromTelemetry
      : [{ ...NO_PRODUCT }, ...productsFromTelemetry];
  } catch (err) {
    console.error("Failed to refresh state from Telemetry:", err.message || err);
  }
}

function buildTelemetryCellPayloadFromStateCell(cell) {
  if (!cell) return null;

  return {
    cellNumber: cell.id,
    rowNumber: cell.row ?? null,
    size: cell.size ?? 1,
    goodId: cell.productId ?? null,
    price: cell.price ?? 0,
    volume: typeof cell.stock === "number" ? cell.stock : undefined,
    maxVolume: typeof cell.capacity === "number" ? cell.capacity : undefined,
    isActive: cell.status !== "disabled",
  };
}

// Простая защита
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || !STATE.tokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Добавляем user context
  req.user = STATE.tokens.get(token);
  next();
}

// Эмуляция задержки сети/железа
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------- API Routes ----------------
const API_PREFIX = "/api/v1";

// === AUTH ===
app.post(`${API_PREFIX}/auth/login`, async (req, res) => {
  await delay(300);
  const { pin } = req.body || {};
  
  if (pin === "0000") return res.status(401).json({ error: "Wrong PIN" });

  // Эмуляция: короткий пин = оператор, длинный = инженер
  const role = (pin && pin.length > 4) ? "ENGINEER" : "OPERATOR";
  const token = "jwt_" + role + "_" + Date.now();
  
  STATE.tokens.set(token, { role, username: role.toLowerCase() });
  
  // Возвращаем роль согласно Unified v3.0
  return res.json({ accessToken: token, role });
});

app.get(`${API_PREFIX}/auth/me`, requireAuth, async (req, res) => {
    res.json(req.user);
});

// === INFO & HARDWARE STATE ===
app.get(`${API_PREFIX}/diagnostics/info`, requireAuth, async (req, res) => {
    // Агрегация данных
    res.json({
        uptime: process.uptime(),
        softwareVersion: "3.0.1-test",
        hardware: STATE.hw
    });
});

app.get(`${API_PREFIX}/maintenance/state`, requireAuth, async (req, res) => {
    // Живое изменение температуры для реалистичности
    STATE.hw.temperature = 4.0 + Math.random(); 
    res.json({
        door: STATE.hw.door,
        tempC: parseFloat(STATE.hw.temperature.toFixed(1)),
        lighting: STATE.hw.lighting,
        errorCount: 0
    });
});

// === CELLS ===
app.get(`${API_PREFIX}/cells`, requireAuth, async (req, res) => {
  await delay(200);
    await refreshStateFromTelemetry();
    const cells = STATE.cells
      .filter((c) => c.mergedTo == null) // hide slave cells on UI lists
      .map(buildCellDtoWithProduct);
    res.json(cells);
});

app.post(`${API_PREFIX}/cells/stock/fill-row`, requireAuth, async (req, res) => {
  await delay(500);
  const { row } = req.body || {};
  // Найти макс capacity в ряду
  const capacityByRow = {};
  STATE.cells.forEach(c => {
    capacityByRow[c.row] = Math.max(capacityByRow[c.row] || 0, c.capacity || 0);
  });
    const maxCap = capacityByRow[row] || 0;
    STATE.cells = STATE.cells.map(c => (c.row === row ? { ...c, stock: maxCap } : c));
    const updatedCells = STATE.cells.filter(c => c.row === row);
    await Promise.all([
      syncTelemetryCellsFromStateCells(updatedCells),
      syncTelemetryVolumesFromStateCells(updatedCells),
    ]);
    res.status(204).end();
  });

app.put(`${API_PREFIX}/cells/:id/stock`, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
    const { stock } = req.body;
    const i = STATE.cells.findIndex(c => c.id === id);
    if (i === -1) return res.status(404).json({ error: "Not found" });
    STATE.cells[i].stock = stock;
    const updated = STATE.cells[i];
    await Promise.all([
      syncTelemetryCellsFromStateCells([updated]),
      syncTelemetryVolumesFromStateCells([updated]),
    ]);
    res.json({});
  });

// ... (Capacity/Price/Product setters similar to previous version, omitted for brevity but assumed present)
// Для полноты примера оставим capacity/price/product update
  app.put(`${API_PREFIX}/cells/:id/capacity`, requireAuth, async (req, res) => {
      const i = STATE.cells.findIndex(c => c.id == req.params.id);
      if (i > -1) {
        STATE.cells[i].capacity = req.body.capacity;
        await syncTelemetryCellsFromStateCells([STATE.cells[i]]);
      }
      res.json({});
  });
  app.put(`${API_PREFIX}/cells/:id/price`, requireAuth, async (req, res) => {
      const i = STATE.cells.findIndex(c => c.id == req.params.id);
      if (i > -1) {
        STATE.cells[i].price = req.body.price;
        await syncTelemetryCellsFromStateCells([STATE.cells[i]]);
      }
      res.json({});
  });
  app.put(`${API_PREFIX}/cells/:id/product`, requireAuth, async (req, res) => {
      const i = STATE.cells.findIndex(c => c.id == req.params.id);
      if (i > -1) {
        STATE.cells[i].productId = req.body.productId;
        await syncTelemetryCellsFromStateCells([STATE.cells[i]]);
      }
      res.json({});
  });
  app.put(`${API_PREFIX}/cells/capacity/set-for-row`, requireAuth, async (req, res) => {
      const { row, capacity } = req.body || {};
      STATE.cells.forEach(c => { if (c.row === row) c.capacity = capacity; });
      const updatedCells = STATE.cells.filter(c => c.row === row);
      await syncTelemetryCellsFromStateCells(updatedCells);
      res.status(204).end();
  });
  app.put(`${API_PREFIX}/cells/price/set-for-row`, requireAuth, async (req, res) => {
      const { row, price } = req.body || {};
      STATE.cells.forEach(c => { if (c.row === row) c.price = price; });
      const updatedCells = STATE.cells.filter(c => c.row === row);
      await syncTelemetryCellsFromStateCells(updatedCells);
      res.status(204).end();
  });


  app.post(`${API_PREFIX}/cells/status`, requireAuth, async (req, res) => {
    const { cellIds, status } = req.body || {};
    STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, status } : c));
    const updatedCells = STATE.cells.filter(c => cellIds?.includes(c.id));
    await syncTelemetryCellsFromStateCells(updatedCells);
    res.status(204).end();
  });

// test-backend.mjs

app.post(`${API_PREFIX}/cells/merge`, requireAuth, async (req, res) => {
  await refreshStateFromTelemetry();

  const { cellIds, row } = req.body || {};

  // 1) Собираем candidateIds: либо из body.cellIds, либо по row (1..10 в ряду)
  let candidateIds = [];
  let targetRow = Number.isInteger(row) ? row : null;

  if (Array.isArray(cellIds) && cellIds.length > 0) {
    candidateIds = cellIds;
  } else if (targetRow != null) {
    const startId = (targetRow - 1) * 10 + 1;
    candidateIds = Array.from({ length: 10 }, (_, i) => startId + i);
    candidateIds.forEach((id) => ensureCellExists(id, targetRow));
  }

  // 2) Нормализация: уникальные, положительные int, порядок сохраняем
  const seen = new Set();
  const ids = [];
  for (const raw of candidateIds) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length < 2) {
    return res.status(400).json({ error: "Need at least 2 valid cells to merge" });
  }

  const buildIndex = () => {
    const byId = new Map();
    const idxById = new Map();
    const masterHasSlave = new Set(); // id мастера, у которого есть slave (кто-то mergedTo == masterId)

    for (let i = 0; i < STATE.cells.length; i++) {
      const c = STATE.cells[i];
      byId.set(c.id, c);
      idxById.set(c.id, i);
      if (c.mergedTo != null) masterHasSlave.add(c.mergedTo);
    }

    return { byId, idxById, masterHasSlave };
  };

  const { byId: byId0, masterHasSlave: masterHasSlave0 } = buildIndex();

  // 3) Проверяем существование и что все в одном ряду
  const cells0 = ids.map((id) => byId0.get(id));
  if (cells0.some((c) => !c)) {
    return res.status(404).json({ error: "One or more cells not found" });
  }

  const rows = new Set(cells0.map((c) => getCellRowNumber(c)));
  if (rows.size > 1) {
    return res.status(400).json({ error: "Cells must be in the same row to merge" });
  }
  if (targetRow == null) targetRow = Array.from(rows)[0];

  const isMergedId = (id, byId, masterHasSlave) => {
    const c = byId.get(id);
    if (!c) return false;
    return c.mergedTo != null || masterHasSlave.has(c.id);
  };

  const updatedIds = new Set();

  const validatePairBasics = (a, b) => {
    const left = Math.min(a, b);
    const right = Math.max(a, b);

    if (right !== left + 1) {
      return { ok: false, error: `Cells ${a} and ${b} must be adjacent` };
    }

    const ca = STATE.cells.find((c) => c.id === left);
    const cb = STATE.cells.find((c) => c.id === right);
    if (!ca || !cb) return { ok: false, error: `Cell ${!ca ? left : right} not found` };

    const ra = getCellRowNumber(ca);
    const rb = getCellRowNumber(cb);
    if (ra == null || rb == null || ra !== rb) {
      return { ok: false, error: `Cells ${a} and ${b} must be in the same row` };
    }

    return { ok: true, left, right };
  };

  const applyMerge = (leftId, rightId, idxById, byId, masterHasSlave) => {
    const leftIdx = idxById.get(leftId);
    const rightIdx = idxById.get(rightId);
    if (leftIdx == null || rightIdx == null) {
      return { ok: false, error: "One or more cells not found" };
    }

    const leftCell = byId.get(leftId);
    const rightCell = byId.get(rightId);
    if (!leftCell || !rightCell) {
      return { ok: false, error: "One or more cells not found" };
    }

    // Можно мержить только две "одиночные" ячейки (не master и не slave), size=1
    const leftIsMerged = leftCell.mergedTo != null || masterHasSlave.has(leftId);
    const rightIsMerged = rightCell.mergedTo != null || masterHasSlave.has(rightId);
    if (leftIsMerged || rightIsMerged) {
      return { ok: false, error: `Cannot merge already merged cells (${leftId}, ${rightId})` };
    }
    if (leftCell.size !== 1 || rightCell.size !== 1) {
      return { ok: false, error: `Cells must be size=1 to merge (${leftId}, ${rightId})` };
    }

    // Применяем merge: left = master, right = slave
    STATE.cells[leftIdx] = {
      ...STATE.cells[leftIdx],
      size: 2,
      status: "enabled",
      mergedTo: null,
    };
    STATE.cells[rightIdx] = {
      ...STATE.cells[rightIdx],
      status: "disabled",
      mergedTo: leftId,
      size: 0,
    };

    masterHasSlave.add(leftId);
    updatedIds.add(leftId);
    updatedIds.add(rightId);

    return { ok: true };
  };

  // 4) Ровно 2 ячейки: просто merge, но merged-ячейки запрещены
  if (ids.length === 2) {
    const { byId, idxById, masterHasSlave } = buildIndex();

    if (isMergedId(ids[0], byId, masterHasSlave) || isMergedId(ids[1], byId, masterHasSlave)) {
      return res.status(400).json({ error: "Merging already merged cells is not allowed for 2-cell merge" });
    }

    const basics = validatePairBasics(ids[0], ids[1]);
    if (!basics.ok) return res.status(400).json({ error: basics.error });

    try {
      await applyControllerMergePairs([[basics.left, basics.right]]);
    } catch (err) {
      return res
        .status(err.statusCode || 502)
        .json({ error: err.message || "Controller merge failed" });
    }

    const r = applyMerge(basics.left, basics.right, idxById, byId, masterHasSlave);
    if (!r.ok) return res.status(400).json({ error: r.error });

    STATE.cells = normalizeCellsSizes(STATE.cells);

    await delay(200);
    const changedCells = STATE.cells.filter((c) => updatedIds.has(c.id));
    await syncTelemetryCellsFromStateCells(changedCells);
    return res.status(204).end();
  }

  // 5) >2 ячейки: если среди них есть merged — сначала split, потом merge попарно по порядку
  {
    // Определяем merged среди выбранных (на текущем состоянии ДО split)
    const { byId, masterHasSlave } = buildIndex();
    const mergedInSelection = ids.filter((id) => isMergedId(id, byId, masterHasSlave));

    // Валидируем пары заранее (по порядку ids), чтобы не делать "тихий пропуск"
    const pairs = [];
    for (let i = 0; i + 1 < ids.length; i += 2) {
      const a = ids[i];
      const b = ids[i + 1];
      const basics = validatePairBasics(a, b);
      if (!basics.ok) {
        return res.status(400).json({ error: basics.error });
      }
      pairs.push([basics.left, basics.right]); // внутри пары нормализуем left/right
    }

    // Если есть merged среди выбранных — сплитим их (включая связки)
    if (mergedInSelection.length > 0) {
      const idsToSplit = expandCellIdsWithLinks(mergedInSelection);
      const masterIdsToSplit = getMergedMasterIds(idsToSplit);
      if (masterIdsToSplit.length > 0) {
        try {
          await applyControllerSplitMasters(masterIdsToSplit);
        } catch (err) {
          return res
            .status(err.statusCode || 502)
            .json({ error: err.message || "Controller split failed" });
        }
      }
      const splitted = splitCellsByIds(idsToSplit, { clear: false });
      for (const c of splitted) updatedIds.add(c.id);
      STATE.cells = normalizeCellsSizes(STATE.cells);
    }

    try {
      await applyControllerMergePairs(pairs);
    } catch (err) {
      return res
        .status(err.statusCode || 502)
        .json({ error: err.message || "Controller merge failed" });
    }

    // После split пересобираем индексы и выполняем merge попарно
    const { byId: byId2, idxById: idxById2, masterHasSlave: masterHasSlave2 } = buildIndex();

    for (const [leftId, rightId] of pairs) {
      const r = applyMerge(leftId, rightId, idxById2, byId2, masterHasSlave2);
      if (!r.ok) {
        // Здесь уже split мог произойти — но merge делаем строго: если пара невалидна, возвращаем ошибку
        return res.status(400).json({ error: r.error });
      }
    }

    STATE.cells = normalizeCellsSizes(STATE.cells);

    await delay(200);
    const changedCells = STATE.cells.filter((c) => updatedIds.has(c.id));
    await syncTelemetryCellsFromStateCells(changedCells);
    return res.status(204).end();
  }
});

app.post(`${API_PREFIX}/cells/split`, requireAuth, async (req, res) => {
  const { cellIds } = req.body || {};

  const targetIds = new Set();
  if (Array.isArray(cellIds)) {
    for (const id of cellIds) {
      const numId = Number(id);
      if (!Number.isInteger(numId) || numId <= 0) continue;
      const cell = STATE.cells.find((c) => c.id === numId);
      if (!cell) continue;

      targetIds.add(numId);
      if (cell.mergedTo != null) {
        targetIds.add(cell.mergedTo);
      }
      const slaves = STATE.cells.filter((c) => c.mergedTo === numId).map((c) => c.id);
      slaves.forEach((sid) => targetIds.add(sid));
    }
  }

  const masterIdsToSplit = getMergedMasterIds(Array.from(targetIds));
  if (masterIdsToSplit.length > 0) {
    try {
      await applyControllerSplitMasters(masterIdsToSplit);
    } catch (err) {
      return res
        .status(err.statusCode || 502)
        .json({ error: err.message || "Controller split failed" });
    }
  }

  if (targetIds.size > 0) {
    splitCellsByIds(Array.from(targetIds), { clear: true });
    STATE.cells = normalizeCellsSizes(STATE.cells);
  }
  
  // ???? ??????? ??????????? ????? ???????? ? ?????????? ?????????
  await delay(200);
  const changedCells = STATE.cells.filter(c => targetIds.has(c.id));
  await syncTelemetryCellsFromStateCells(changedCells);
  res.status(204).end();
});
  app.put(`${API_PREFIX}/cells/type`, requireAuth, async (req, res) => {
      const { cellIds, type } = req.body || {};
      const normalizedType = normalizeCellType(type, null);
      const ids = Array.isArray(cellIds)
        ? cellIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (ids.length === 0) {
        return res.status(400).json({ error: "cellIds are required" });
      }
      if (!normalizedType) {
        return res.status(400).json({ error: "Invalid type. Allowed: spiral, conveyor" });
      }

      STATE.cells = STATE.cells.map((c) =>
        ids.includes(c.id) ? { ...c, type: normalizedType } : c
      );
      const updatedCells = STATE.cells.filter((c) => ids.includes(c.id));
      await syncTelemetryCellsFromStateCells(updatedCells);
      res.status(204).end();
  });

// === PRODUCTS ===
  app.get(`${API_PREFIX}/products`, requireAuth, async (req, res) => {
    await delay(100);
    await refreshStateFromTelemetry();
  // Обработка пагинации и поиска (Unified v3.0)
  let { search, page, limit } = req.query;
  let result = STATE.products;
  
  if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => (p.productName || "").toLowerCase().includes(s));
  }
  
  // Mapping to DTO
  const mapped = result.map((p) => ({
    id: p.id,
    name: p.productName || p.name,
    brandName: p.brandName ?? null,
    productName: p.productName ?? p.name ?? null,
    imgPath: p.imgPath ?? null,
  }));

  // Simple slice for pagination (if needed)
  if (limit) {
      const start = (Number(page)||0) * Number(limit);
      res.json(mapped.slice(start, start + Number(limit)));
  } else {
      res.json(mapped);
  }
});

// Diagnostics helpers: logical view & async operations

function calcRowFromCellId(cellId) {
  const id = Number(cellId);
  if (!Number.isFinite(id) || id <= 0) return null;
  // 10 cells per row (1..10, 11..20, ...)
  return Math.floor((id - 1) / 10) + 1;
}

function buildMotorDtoFromCell(cell) {
  return {
    cellId: cell.id,
    status: cell.motorStatus ?? cell.status,
    stock: cell.stock,
    capacity: cell.capacity,
    lastError: cell.lastError ?? null,
    updatedAt: cell.motorUpdatedAt ?? cell.updatedAt ?? null,
  };
}

// Logical representation for test-cells screen:
// master/standalone cells only, with slave motors attached to their master.
function buildDiagnosticCellsView() {
  const cellsWithProduct = (STATE.cells || []).map(buildCellDtoWithProduct);
  const byId = new Map(cellsWithProduct.map((c) => [c.id, c]));

  const slavesByMaster = new Map();
  for (const cell of cellsWithProduct) {
    if (cell.mergedTo != null) {
      const masterId = cell.mergedTo;
      if (!slavesByMaster.has(masterId)) {
        slavesByMaster.set(masterId, []);
      }
      slavesByMaster.get(masterId).push(cell);
    }
  }

  const result = [];
  const total = MACHINE_CELLS_COUNT;

  for (let logicalId = 1; logicalId <= total; logicalId++) {
    const master = byId.get(logicalId);
    if (master?.mergedTo != null) {
      continue;
    }
    const motors = [];

    if (master) {
      motors.push(buildMotorDtoFromCell(master));
    }

    const slaves = slavesByMaster.get(logicalId) || [];
    for (const slave of slaves) {
      motors.push(buildMotorDtoFromCell(slave));
    }

    const row = master?.row ?? calcRowFromCellId(logicalId);
    const productId = master?.productId ?? 0;
    const productName = master?.productName ?? null;

    result.push({
      id: logicalId,
      row,
      productId,
      productName,
      stock: master?.stock ?? 0,
      capacity: master?.capacity ?? 0,
      imgPath: master?.imgPath ?? null,
      status: master?.status ?? "disabled",
      lastError: master?.lastError ?? null,
      updatedAt: master?.updatedAt ?? null,
      motors,
    });
  }

  return result;
}

let currentCalibrationOp = null;
let currentTestOp = null;

function createCellsOperation(kind, cellIds) {
  const normalized = Array.from(
    new Set(
      (cellIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ).sort((a, b) => a - b);

  const op = {
    id: `${kind}_${Date.now()}`,
    kind,
    cellIds: normalized,
    statusByCell: new Map(),
    nextIndex: 0,
    finished: normalized.length === 0,
  };

  return op;
}

function advanceOperation(op, chunkSize = 4) {
  if (!op || op.finished) return;

  const slice = op.cellIds.slice(op.nextIndex, op.nextIndex + chunkSize);

  for (const cellId of slice) {
    const isError = op.kind === "test" && Math.random() < 0.1;
    const status = isError ? "ERROR" : "SUCCESS";
    const message =
      op.kind === "calibration"
        ? isError
          ? "CALIBRATION_FAILED"
          : "CALIBRATED"
        : isError
        ? "MOTOR_JAMMED_OVERCURRENT"
        : "OK";

    op.statusByCell.set(cellId, {
      status,
      message,
      updatedAt: new Date().toISOString(),
    });

    persistMotorStatus(
      cellId,
      status,
      status === "ERROR" ? message : null,
      new Date().toISOString()
    );

    STATE.logs.unshift({
      ts: new Date().toISOString(),
      level: isError ? "ERROR" : "INFO",
      msg: `${op.kind === "calibration" ? "Calibration" : "Test"} cell #${cellId}: ${status}`,
    });
  }

  op.nextIndex += slice.length;
  if (op.nextIndex >= op.cellIds.length) {
    op.finished = true;
  }
}

function operationToResponse(op) {
  if (!op) return null;

  return {
    opId: op.id,
    done: op.finished,
    cells: op.cellIds.map((cellId) => {
      const st = op.statusByCell.get(cellId);
      return {
        cellId,
        status: st?.status ?? "PENDING",
        message: st?.message ?? null,
        updatedAt: st?.updatedAt ?? null,
      };
    }),
  };
}

async function buildCalibrationOpFromController() {
  const ids = Array.from({ length: MACHINE_CELLS_COUNT }, (_, i) => i + 1);
  const results = await controllerPollChannels(MACHINE_CELLS_COUNT);
  const resultMap = new Map();

  for (const item of results) {
    const channel = Number(item?.channel);
    if (Number.isInteger(channel) && channel > 0) {
      resultMap.set(channel, item);
    }
  }

  const op = createCellsOperation("calibration", ids);

  for (const cellId of ids) {
    const res = resultMap.get(cellId);
    const isOk = res && res.status === "ok" && res.exists === true;
    const status = isOk ? "SUCCESS" : "ERROR";
    const message = isOk ? "CALIBRATED" : "CALIBRATION_FAILED";
    const updatedAt = new Date().toISOString();

    op.statusByCell.set(cellId, {
      status,
      message,
      updatedAt,
    });

    persistMotorStatus(cellId, status, isOk ? null : message, updatedAt);

    STATE.logs.unshift({
      ts: updatedAt,
      level: isOk ? "INFO" : "ERROR",
      msg: `Calibration cell #${cellId}: ${status}`,
    });
  }

  op.nextIndex = op.cellIds.length;
  op.finished = true;

  return op;
}

// Logical cells view for diagnostics/test-cells screen
app.get(`${API_PREFIX}/diagnostics/test-cells`, requireAuth, async (req, res) => {
  await refreshStateFromTelemetry();
  const cells = buildDiagnosticCellsView();
  res.json(cells);
});

// Start calibration for all cells (mock) and return opId
app.post(`${API_PREFIX}/diagnostics/test-cells/calibration`, requireAuth, async (req, res) => {
  await refreshStateFromTelemetry();
  try {
    currentCalibrationOp = await buildCalibrationOpFromController();
  } catch (err) {
    return res
      .status(err.statusCode || 502)
      .json({ error: err.message || "Controller calibration failed" });
  }
  res.json({ opId: currentCalibrationOp.id, status: "STARTED" });
});

// Long-poll style status for calibration
app.get(`${API_PREFIX}/diagnostics/test-cells/calibration`, requireAuth, async (req, res) => {
  if (!currentCalibrationOp) {
    return res.status(404).json({ error: "No calibration in progress" });
  }

  const { opId } = req.query || {};
  if (opId && opId !== currentCalibrationOp.id) {
    return res.status(404).json({ error: "Calibration op not found" });
  }

  await delay(300);
  advanceOperation(currentCalibrationOp);
  const payload = operationToResponse(currentCalibrationOp);
  res.json(payload);
});

// Start auto-test for selected cells (or all)
app.post(`${API_PREFIX}/diagnostics/test-cells/test`, requireAuth, async (req, res) => {
  await refreshStateFromTelemetry();
  const { cellIds } = req.body || {};
  const ids =
    Array.isArray(cellIds) && cellIds.length > 0
      ? cellIds
      : Array.from({ length: MACHINE_CELLS_COUNT }, (_, i) => i + 1);

  currentTestOp = createCellsOperation("test", ids);
  advanceOperation(currentTestOp);
  res.json({ opId: currentTestOp.id, status: "STARTED" });
});

// Long-poll style status for auto-test
app.get(`${API_PREFIX}/diagnostics/test-cells/test`, requireAuth, async (req, res) => {
  if (!currentTestOp) {
    return res.status(404).json({ error: "No test in progress" });
  }

  const { opId } = req.query || {};
  if (opId && opId !== currentTestOp.id) {
    return res.status(404).json({ error: "Test op not found" });
  }

  await delay(300);
  advanceOperation(currentTestOp);
  const payload = operationToResponse(currentTestOp);
  res.json(payload);
});

// === DIAGNOSTICS & LOGS ===

// Эмуляция реального теста моторов с задержками
app.post(`${API_PREFIX}/diagnostics/test-cells`, requireAuth, async (req, res) => {
  await refreshStateFromTelemetry();
  const { cellIds } = req.body || {};
  const idsToTest =
    Array.isArray(cellIds) && cellIds.length > 0
      ? cellIds
      : STATE.cells.map((c) => c.id);

  const results = [];
  
  for (const id of idsToTest) {
      // Имитируем время вращения мотора (300мс)
      await delay(300); 
      
      // Имитируем случайную ошибку (10% вероятность)
      const isError = Math.random() < 0.1;
      const result = {
          cellId: id,
          status: isError ? "ERROR" : "SUCCESS",
          message: isError ? "MOTOR_JAMMED_OVERCURRENT" : "OK"
      };
      
      // Логируем результат
      STATE.logs.unshift({
          ts: new Date().toISOString(),
          level: isError ? "ERROR" : "INFO",
          msg: `Test cell #${id}: ${result.status}`
      });
      
      results.push(result);
  }
  
  res.json(results);
});

// Логи с фильтрацией (Unified v3.0)
app.get(`${API_PREFIX}/diagnostics/logs`, requireAuth, async (req, res) => {
  let { search, full, level, limit, offset } = req.query;
  
  let out = [...STATE.logs];
  
  // Filter by Level
  if (level) {
      out = out.filter(x => x.level === level);
  }
  
  // Filter by Text
  if (search) {
      const s = String(search).toLowerCase();
      out = out.filter(x => (x.msg || "").toLowerCase().includes(s));
  }
  
  // Pagination
  const start = Number(offset) || 0;
  const end = start + (Number(limit) || 5000);
  
  res.json({
      items: out.slice(start, end),
      total: out.length
  });
});

// === MAINTENANCE (Unified v3.0) ===

app.post(`${API_PREFIX}/maintenance/self-test`, requireAuth, async (req, res) => {
    await delay(1500); // Долгий тест
    res.json({ status: "OK", details: "All sensors nominal" });
});

app.post(`${API_PREFIX}/maintenance/calibration/start`, requireAuth, async (req, res) => {
    // Возвращаем ID операции, фронт может поллить статус
    res.json({ opId: "cal_" + Date.now(), status: "STARTED" });
});


  let telemetryNeedsFullSync = true;

  function buildTelemetryCellsPayloadFromStateCells(cells) {
    return (cells || [])
      .map(buildTelemetryCellPayloadFromStateCell)
      .filter(Boolean);
  }

  function buildTelemetryVolumePayloadFromStateCell(cell) {
  if (!cell) return null;

  return {
    cellNumber: cell.id,
    volume: typeof cell.stock === "number" ? cell.stock : 0,
  };
}

  function buildTelemetryVolumesPayloadFromStateCells(cells) {
    return (cells || [])
      .map(buildTelemetryVolumePayloadFromStateCell)
      .filter(Boolean);
  }
  
  async function sendTelemetryCellsPayload(payload) {
    if (!payload.length) return true;
  
    try {
      await postTelemetryCells(payload);
      return true;
    } catch (err) {
      console.error("Failed to sync Telemetry cells:", err.message || err);
      return false;
    }
  }
  
  async function sendTelemetryVolumesPayload(payload) {
    if (!payload.length) return true;
  
    try {
      await postTelemetryVolumes(payload);
      return true;
    } catch (err) {
      console.error("Failed to sync Telemetry volumes:", err.message || err);
      return false;
    }
  }
  
  async function syncTelemetryFullMatrixIfNeeded() {
    if (!telemetryNeedsFullSync) return true;
  
    const cells = Array.isArray(STATE.cells) ? STATE.cells : [];
    const cellsPayload = buildTelemetryCellsPayloadFromStateCells(cells);
    const volumesPayload = buildTelemetryVolumesPayloadFromStateCells(cells);
    const [cellsOk, volumesOk] = await Promise.all([
      sendTelemetryCellsPayload(cellsPayload),
      sendTelemetryVolumesPayload(volumesPayload),
    ]);
  
    const ok = cellsOk && volumesOk;
    if (ok) {
      telemetryNeedsFullSync = false;
    }
  
    return ok;
  }
  
  async function syncTelemetryCellsFromStateCells(cells) {
    await syncTelemetryFullMatrixIfNeeded();
    const payload = buildTelemetryCellsPayloadFromStateCells(cells);
    const ok = await sendTelemetryCellsPayload(payload);
    if (!ok) {
      telemetryNeedsFullSync = true;
    }
    return ok;
  }
  
  async function syncTelemetryVolumesFromStateCells(cells) {
    await syncTelemetryFullMatrixIfNeeded();
    const payload = buildTelemetryVolumesPayloadFromStateCells(cells);
    const ok = await sendTelemetryVolumesPayload(payload);
    if (!ok) {
      telemetryNeedsFullSync = true;
    }
    return ok;
  }
  
  // Test backend port configuration
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Test backend (Unified v3.0) running at http://localhost:${PORT}${API_PREFIX}`);
    syncTelemetryFullMatrixIfNeeded().then((ok) => {
      if (!ok) {
        console.warn("Telemetry full matrix sync deferred until connection is available.");
      }
    });
  });
