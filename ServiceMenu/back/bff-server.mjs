// bff-server.mjs
// Express BFF для сервисного меню. Проксирует действия фронтенда в сигналы FSM и возвращает FsmReply.
// Требования: Node.js 20+, "type": "module" в package.json, установлен express.
// Настройте путь к FSM по вашему проекту.

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Импорт конечного автомата (обновите путь при интеграции)
import { ServiceMenuFSM } from './fsm-service-menu.js'; // ← убедитесь, что файл и экспорт совпадают

// ---------------- Конфигурация ----------------
const PORT = process.env.BFF_PORT || 3001;
const BACKEND_BASE_URL = process.env.SVC_BACKEND_URL || 'http://localhost:8080/api/v1';
const SESSION_INACTIVITY_MS = Number(process.env.SESSION_INACTIVITY_MS || 180000); // 3 min
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

// ---------------- Инициализация FSM ----------------
const fsm = new ServiceMenuFSM({
  backend: {
    baseUrl: BACKEND_BASE_URL,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  },
  sessionInactivityMs: SESSION_INACTIVITY_MS,
});

// ---------------- Инициализация Express ----------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(morgan('dev'));

// Хелпер: единая обёртка маршрутов, чтобы не дублировать try/catch
function bindRoute(method, path, signal) {
  app[method](path, async (req, res) => {
    try {
      const payload = req.body ?? {};
      const reply = await fsm.handle(signal, payload);
      res.json(reply);
    } catch (err) {
      // Фоллбэк на случай непойманных исключений
      console.error(`[BFF] Unhandled error for ${path}:`, err);
      res.status(500).json({
        state: 'Error',
        view: {
          screen: 'Error',
          message: 'BFF internal error',
        },
        meta: {
          cause: String(err?.message || err),
          path,
        },
      });
    }
  });
}

// ---------------- Маршруты BFF (Frontend → BFF) ----------------
bindRoute('post', '/bff/ui/open-settings', 'UI.OpenSettings');
bindRoute('post', '/bff/auth/login', 'Auth.SubmitPin');
bindRoute('post', '/bff/ui/nav/cells-stocks', 'UI.Navigate.CellsStocks');
bindRoute('post', '/bff/ui/nav/cells-capacity', 'UI.Navigate.CellsCapacity');
bindRoute('post', '/bff/ui/nav/cells-prices', 'UI.Navigate.CellsPrices');
bindRoute('post', '/bff/ui/nav/cells-products', 'UI.Navigate.CellsProducts');
bindRoute('post', '/bff/ui/nav/cells-config', 'UI.Navigate.CellsConfig');
bindRoute('post', '/bff/ui/nav/diagnostics', 'UI.Navigate.DiagnosticsTest');
bindRoute('post', '/bff/ui/nav/logs', 'UI.Navigate.Logs');

bindRoute('post', '/bff/cells/stock', 'Cells.EditStock');
bindRoute('post', '/bff/cells/fill-row', 'Cells.FillRow');
bindRoute('post', '/bff/cells/capacity/row', 'Cells.SetRowCapacity');
bindRoute('post', '/bff/cells/capacity/cell', 'Cells.SetCellCapacity');
bindRoute('post', '/bff/cells/price/row', 'Cells.SetRowPrice');
bindRoute('post', '/bff/cells/price/cell', 'Cells.SetCellPrice');

bindRoute('post', '/bff/products/open-list', 'Cells.OpenAssignProduct');
bindRoute('post', '/bff/products/assign', 'Products.Assign');

bindRoute('post', '/bff/cells/status', 'Cells.SetStatus');
bindRoute('post', '/bff/cells/merge', 'Cells.Merge');
bindRoute('post', '/bff/cells/type', 'Cells.SetType');

bindRoute('post', '/bff/diagnostics/run', 'Diagnostics.RunTest');
bindRoute('post', '/bff/diagnostics/rerun', 'UI.Rerun');

bindRoute('post', '/bff/logs/search', 'Logs.Search');
bindRoute('post', '/bff/logs/full', 'Logs.ToggleFull');

bindRoute('post', '/bff/ui/back', 'UI.Back');
bindRoute('post', '/bff/ui/retry', 'UI.Retry');
bindRoute('post', '/bff/auth/logout', 'Auth.Logout');

// Healthcheck
app.get('/bff/health', (_req, res) => {
  res.json({ ok: true, fsmState: fsm.state ?? 'unknown' });
});
/*
app.listen(PORT, () => {
  console.log(`[BFF] Service Menu BFF listening on http://localhost:${PORT}`);
  console.log(`[BFF] Backend base URL: ${BACKEND_BASE_URL}`);
});
*/
// Экспортируем app для тестов. В тестовом окружении порт не слушаем.
export { app, fsm };
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[BFF] Service Menu BFF listening on http://localhost:${PORT}`);
    console.log(`[BFF] Backend base URL: ${BACKEND_BASE_URL}`);
  });
}
