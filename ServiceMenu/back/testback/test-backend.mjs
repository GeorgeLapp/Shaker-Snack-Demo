import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

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
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/:id/stock`, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { stock } = req.body;
  const i = STATE.cells.findIndex(c => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  STATE.cells[i].stock = stock;
  res.json({});
});

// ... (Capacity/Price/Product setters similar to previous version, omitted for brevity but assumed present)
// Для полноты примера оставим capacity/price/product update
app.put(`${API_PREFIX}/cells/:id/capacity`, requireAuth, (req, res) => {
    const i = STATE.cells.findIndex(c => c.id == req.params.id);
    if(i>-1) STATE.cells[i].capacity = req.body.capacity;
    res.json({});
});
app.put(`${API_PREFIX}/cells/:id/price`, requireAuth, (req, res) => {
    const i = STATE.cells.findIndex(c => c.id == req.params.id);
    if(i>-1) STATE.cells[i].price = req.body.price;
    res.json({});
});
app.put(`${API_PREFIX}/cells/:id/product`, requireAuth, (req, res) => {
    const i = STATE.cells.findIndex(c => c.id == req.params.id);
    if(i>-1) STATE.cells[i].productId = req.body.productId;
    res.json({});
});
app.put(`${API_PREFIX}/cells/capacity/set-for-row`, requireAuth, (req, res) => {
    STATE.cells.forEach(c => { if(c.row === req.body.row) c.capacity = req.body.capacity; });
    res.status(204).end();
});
app.put(`${API_PREFIX}/cells/price/set-for-row`, requireAuth, (req, res) => {
    STATE.cells.forEach(c => { if(c.row === req.body.row) c.price = req.body.price; });
    res.status(204).end();
});


app.post(`${API_PREFIX}/cells/status`, requireAuth, async (req, res) => {
  const { cellIds, status } = req.body || {};
  STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, status } : c));
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
  res.status(204).end();
});

app.put(`${API_PREFIX}/cells/type`, requireAuth, async (req, res) => {
    const { cellIds, type } = req.body || {};
    STATE.cells = STATE.cells.map(c => (cellIds?.includes(c.id) ? { ...c, type } : c));
    res.status(204).end();
});

// === PRODUCTS ===
app.get(`${API_PREFIX}/products`, requireAuth, async (req, res) => {
  await delay(100);
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
  const { cellIds = [] } = req.body;
  const results = [];
  
  for (const id of cellIds) {
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


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Test backend (Unified v3.0) running at http://localhost:${PORT}${API_PREFIX}`);
});