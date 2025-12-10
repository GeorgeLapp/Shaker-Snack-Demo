import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- Telemetry HTTP client ----------------

const TELEMETRY_API_BASE_URL =
  (process.env.TELEMETRY_API_BASE_URL || "http://localhost:3002").replace(/\/+$/, "");

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
    lastError: cell.stock === 0 ? null : (Math.random() > 0.95 ? "LAST_RUN_ERR" : null),
    updatedAt: new Date().toISOString()
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

  return rows.map((row) => {
    const cellNumber = Number(row.cell_number ?? row.cellNumber);
    const rowNumber = row.row_number ?? row.rowNumber ?? null;
    const volume = row.volume ?? 0;
    const maxVolume = row.max_volume ?? row.maxVolume ?? 0;
    const goodId = row.good_id ?? row.goodId ?? null;
    const size = row.size ?? 1;
    const enabled = row.enabled ?? 1;

    return {
      id: cellNumber,
      row: typeof rowNumber === "number" ? rowNumber : null,
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
      type: "spiral",
      size,
      mergedTo: null,
    };
  });
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

async function refreshStateFromTelemetry() {
  try {
    const [matrix, catalog] = await Promise.all([
      fetchTelemetryMatrix(),
      fetchTelemetryCatalog().catch(() => []),
    ]);

    STATE.cells = mapTelemetryMatrixRowsToCells(matrix);
    STATE.products = mapTelemetryCatalogRowsToProducts(catalog);
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
    const cells = STATE.cells.map(buildCellDtoWithProduct);
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
  const { cellIds } = req.body || {}; 
  // Ожидаем массив [id_master, id_slave] (обычно левая и правая ячейка)
  
  if (!Array.isArray(cellIds) || cellIds.length < 2) {
      return res.status(400).json({ error: "Need at least 2 cells to merge" });
  }

  const masterId = cellIds[0];
  const slaveIds = cellIds.slice(1);

  // 1. Находим Master-ячейку
  const masterIndex = STATE.cells.findIndex(c => c.id === masterId);
  if (masterIndex === -1) return res.status(404).json({ error: "Master cell not found" });

  // 2. Обновляем Master: увеличиваем размер
  // Предполагаем, что объединение идет с соседом, size становится 2
  STATE.cells[masterIndex].size = 2; 
  STATE.cells[masterIndex].status = 'enabled'; // При объединении обычно включаем

  // 3. Обновляем Slave-ячейки: они должны исчезнуть из UI или стать "linked"
  // В эмуляторе просто помечаем их как mergedTo (чтобы фронт их скрыл или отрисовал заглушку)
  STATE.cells = STATE.cells.map(c => {
      if (slaveIds.includes(c.id)) {
          return {
              ...c,
              status: 'disabled', // Отключаем мотор ведомой ячейки
              mergedTo: masterId, // Ссылка на мастера
              size: 0             // Размер 0, чтобы не занимала место в grid (зависит от логики UI)
          };
      }
      return c;
  });

  await delay(200);
  const changedCells = STATE.cells.filter(c => c.id === masterId || slaveIds.includes(c.id));
  await syncTelemetryCellsFromStateCells(changedCells);
  res.status(204).end();
});
app.post(`${API_PREFIX}/cells/split`, requireAuth, async (req, res) => {
  const { cellIds } = req.body || {};
  
  if (Array.isArray(cellIds)) {
      STATE.cells = STATE.cells.map(c => {
          // Если ID ячейки есть в списке на разделение
          if (cellIds.includes(c.id)) {
              return { 
                  ...c, 
                  // Возвращаем дефолтные параметры одиночной ячейки
                  size: 1,       // Размер 1 (было 2 при merge)
                  status: 'enabled', 
                  mergedTo: null // Удаляем ссылку на "родителя", если она была
              };
          }
          return c;
      });
  }
  
  // Имитация задержки записи в контроллер
    await delay(200);
    const changedCells = Array.isArray(cellIds)
      ? STATE.cells.filter(c => cellIds.includes(c.id))
      : [];
    await syncTelemetryCellsFromStateCells(changedCells);
    res.status(204).end();
  });

  app.put(`${API_PREFIX}/cells/type`, requireAuth, async (req, res) => {
      const { cellIds, type } = req.body || {};
      STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, type } : c));
      const updatedCells = STATE.cells.filter(c => cellIds?.includes(c.id));
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


function buildTelemetryVolumePayloadFromStateCell(cell) {
  if (!cell) return null;

  return {
    cellNumber: cell.id,
    volume: typeof cell.stock === "number" ? cell.stock : 0,
  };
}

async function syncTelemetryCellsFromStateCells(cells) {
  const payload = (cells || [])
    .map(buildTelemetryCellPayloadFromStateCell)
    .filter(Boolean);

  if (!payload.length) return;

  try {
    await postTelemetryCells(payload);
  } catch (err) {
    console.error("Failed to sync Telemetry cells:", err.message || err);
  }
}

async function syncTelemetryVolumesFromStateCells(cells) {
  const payload = (cells || [])
    .map(buildTelemetryVolumePayloadFromStateCell)
    .filter(Boolean);

  if (!payload.length) return;

  try {
    await postTelemetryVolumes(payload);
  } catch (err) {
    console.error("Failed to sync Telemetry volumes:", err.message || err);
  }
}

// Test backend port configuration
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Test backend (Unified v3.0) running at http://localhost:${PORT}${API_PREFIX}`);
});
