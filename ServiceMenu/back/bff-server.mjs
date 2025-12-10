// bff-server.mjs
// Express BFF (Unified v3.0)

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ServiceMenuFSM, Signals } from './fsm-service-menu.js';

// ---------------- Конфигурация ----------------
const PORT = process.env.BFF_PORT || 3001;
const BACKEND_BASE_URL = process.env.SVC_BACKEND_URL || 'http://localhost:8080/api/v1';

// ---------------- Инициализация FSM ----------------
const fsm = new ServiceMenuFSM({
  backend: {
    baseUrl: BACKEND_BASE_URL,
    requestTimeoutMs: 15000,
  },
  sessionInactivityMs: 180000,
});

// ---------------- Инициализация Express ----------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(morgan('dev'));

function bindRoute(method, path, signal) {
  app[method](path, async (req, res) => {
    try {
      const payload = req.body ?? {};
      // Для GET запросов payload пустой или query, но FSM принимает объект
      // В FSM handle мы добавили кейсы, которые не требуют payload для простых GET
      const reply = await fsm.handle(signal, payload);
      res.json(reply);
    } catch (err) {
      console.error(`[BFF] Unhandled error for ${path}:`, err);
      res.status(500).json({ state: 'Error', meta: { cause: String(err) } });
    }
  });
}

// ---------------- Маршруты BFF ----------------

// UI Navigation
bindRoute('post', '/bff/ui/open-settings', Signals.AppStart);
bindRoute('post', '/bff/ui/nav/cells-stocks', Signals.NavCellsStocks);
bindRoute('post', '/bff/ui/nav/cells-capacity', Signals.NavCellsCapacity);
bindRoute('post', '/bff/ui/nav/cells-prices', Signals.NavCellsPrices);
bindRoute('post', '/bff/ui/nav/cells-products', Signals.NavCellsProducts);
bindRoute('post', '/bff/ui/nav/cells-config', Signals.NavCellsConfig);
bindRoute('post', '/bff/ui/nav/diagnostics', Signals.NavDiagTest);
bindRoute('post', '/bff/ui/nav/logs', Signals.NavLogs);
bindRoute('post', '/bff/ui/back', Signals.Back);
bindRoute('post', '/bff/ui/retry', Signals.Retry);

// Auth
bindRoute('post', '/bff/auth/login', Signals.SubmitPin);
bindRoute('post', '/bff/auth/logout', Signals.Logout);
// NEW v3: Получение профиля (например, для отображения "Engineer" в хедере)
bindRoute('post', '/bff/auth/me', Signals.AuthGetProfile); 

// Cells Actions
bindRoute('post', '/bff/cells/stock', Signals.CellsEditStock);
bindRoute('post', '/bff/cells/fill-row', Signals.CellsFillRow);
bindRoute('post', '/bff/cells/capacity/row', Signals.CellsSetRowCapacity);
bindRoute('post', '/bff/cells/capacity/cell', Signals.CellsSetCellCapacity);
bindRoute('post', '/bff/cells/price/row', Signals.CellsSetRowPrice);
bindRoute('post', '/bff/cells/price/cell', Signals.CellsSetCellPrice);
bindRoute('post', '/bff/cells/status', Signals.CellsSetStatus);
bindRoute('post', '/bff/cells/merge', Signals.CellsMerge);
bindRoute('post', '/bff/cells/split', Signals.CellsSplit);
bindRoute('post', '/bff/cells/type', Signals.CellsSetType);

// Products
bindRoute('post', '/bff/products/open-list', Signals.CellsOpenAssignProduct);
bindRoute('post', '/bff/products/assign', Signals.ProductsAssign);
bindRoute('post', '/bff/products/assign-row', Signals.ProductsAssignRow);

// Diagnostics & Logs
bindRoute('post', '/bff/diagnostics/run', Signals.DiagRunTest);
bindRoute('post', '/bff/diagnostics/rerun', Signals.Rerun);
bindRoute('post', '/bff/logs/search', Signals.LogsSearch);
bindRoute('post', '/bff/logs/full', Signals.LogsToggleFull);
// NEW v3: Info
bindRoute('post', '/bff/diagnostics/info', Signals.DiagGetInfo); 

// Maintenance (NEW v3)
// Обратите внимание: фронт все еще шлет POST на BFF, даже если это GET данных,
// так как BFF проксирует команды. Но можно поддержать и GET в bindRoute, если нужно.
bindRoute('post', '/bff/maintenance/state', Signals.MaintGetState);
bindRoute('post', '/bff/maintenance/self-test', Signals.MaintSelfTest);
bindRoute('post', '/bff/maintenance/calibration', Signals.MaintCalibration);


// Health
app.get('/bff/health', (_req, res) => {
  res.json({ ok: true, fsmState: fsm.state });
});

export { app, fsm };
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[BFF] v3.0 listening on http://localhost:${PORT}`);
  });
}
