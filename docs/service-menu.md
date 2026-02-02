# Документация по модулю сервисного меню (Service Menu, BFF + FSM, Unified v3.0)

## Основной код

- `ServiceMenu/back/bff-server.mjs` — HTTP BFF (Express).
- `ServiceMenu/back/fsm-service-menu.js` — FSM бизнес-логики сервисного меню.
- `ServiceMenu/back/testback/test-backend.mjs` — backend (тестовый стенд, в документации именуется просто “backend”).
- `front/src/app/api/modules/serviceMenu/serviceMenuModule.ts` — клиент фронта.
- `front/src/types/serverInterface/serviceMenuDTO.ts` — DTO/типы ответов и запросов.

---

# 1. Общее описание

Модуль сервисного меню — это **BFF‑сервис**, который принимает запросы от UI и управляет логикой
через конечный автомат (FSM). FSM хранит токен и состояние в памяти и обращается к backend API
сервиса автомата, а также к Telemetry API (для синхронизации каталога).

Ключевые свойства:

- **Stateful:** FSM хранит контекст сессии (token/role/последний экран).
- **UI работает только с BFF**, не обращаясь напрямую к backend.
- **Все запросы UI — POST**, даже для чтения данных.
- Ответы унифицированы: `{ state, view, meta }`.

---

# 2. Архитектура

```text
Front (Service Menu UI)
        |
        | HTTP (POST)
        v
BFF (bff-server.mjs) ----> FSM (fsm-service-menu.js)
                               |
                               +--> Backend API (SVC_BACKEND_URL)
                               |
                               +--> Telemetry API (TELEMETRY_API_BASE_URL)
```

---

# 3. Конфигурация и запуск

## 3.1. Переменные окружения (BFF)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `BFF_PORT` | `3001` | порт BFF |
| `SVC_BACKEND_URL` | `http://localhost:8080/api/v1` | базовый URL backend |
| `TELEMETRY_API_BASE_URL` | `http://localhost:3002` | Telemetry API |

## 3.2. Внутренние параметры FSM

Заданы в коде `ServiceMenu/back/bff-server.mjs` и `ServiceMenu/back/fsm-service-menu.js`:

- `sessionInactivityMs`: `180000` (3 минуты, сброс FSM в `Idle` при неактивности).
- `requestTimeoutMs`: `15000` (таймаут запросов backend).
- `prefetchTimeoutMs`: `5000` (таймаут фонового prefetch после логина).

## 3.3. Пример запуска (Linux)

```bash
export BFF_PORT=3001
export SVC_BACKEND_URL="http://localhost:8080/api/v1"
export TELEMETRY_API_BASE_URL="http://localhost:3002"

node ServiceMenu/back/bff-server.mjs
```

---

# 4. Формат ответов FSM

Все ответы BFF — JSON:

```json
{
  "state": "SomeState",
  "view": { "screen": "ScreenName", "...": "..." },
  "meta": { "status": 200, "warn": "..." }
}
```

Где:

- `state` — состояние FSM;
- `view` — данные для UI (обычно содержит `screen`);
- `meta` — доп. информация (status/warn/error и т.д.).

**Важно:** BFF **не использует cookies** и **не требует Authorization от фронта**.
Токен хранится внутри FSM после `/bff/auth/login`.

**Ошибка BFF (необработанная):**

```json
{
  "state": "Error",
  "meta": { "cause": "Error: ..." }
}
```

HTTP статус в этом случае: `500`.

---

# 5. Модель данных (DTO)

## 5.1. Справочники/enum

**CellTypeEnum:**

- `spiral`
- `conveyor`

**CellStatusEnum:**

- `enabled`
- `disabled`

**StartCalibrationEnum:**

- `STARTED`

**CellStatusPollCalibrationEnum:**

- `SUCCESS`
- `PENDING`
- `ALERT`

## 5.2. Ячейка (CellPrice)

Используется в экранах `Cells/*`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | id ячейки |
| `row` | number | номер ряда |
| `imgPath` | string | путь до картинки |
| `brandName` | string | бренд |
| `productName` | string | название продукта |
| `capacity` | number | вместимость |
| `stock` | number | остаток |
| `price` | number | цена |
| `productId` | number | id продукта |
| `status` | `enabled | disabled` | статус |
| `type` | `spiral | conveyor` | тип |
| `size` | number | размер/ширина ячейки |
| `lastError` | string \\| null | последняя ошибка |
| `mergedTo` | number \\| null | id мастера, если ячейка объединена |
| `updatedAt` | string | ISO‑время обновления |

**Примечание:** в UI‑типах `mergedTo` может быть описан как `boolean | null`,
но в backend всегда приходит **числовой id мастера** или `null`.

## 5.3. Диагностика (CellDiagnostics)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | id ячейки |
| `row` | number | ряд |
| `capacity` | number | вместимость |
| `stock` | number | остаток |
| `status` | string | статус (в backend встречается `OK/ERROR`) |
| `lastError` | string \\| null | последняя ошибка |
| `motors` | Motor[] | список моторов |
| `productId` | number | id продукта |
| `productName` | string | название |
| `imgPath` | string | путь до картинки |
| `updatedAt` | string | ISO‑время |

**Motor:**

| Поле | Тип | Описание |
|------|-----|----------|
| `cellId` | number | id ячейки |
| `capacity` | number | вместимость |
| `stock` | number | остаток |
| `status` | string | статус (OK/ERROR/...) |
| `lastError` | string \\| null | ошибка |
| `updatedAt` | string | ISO‑время |

## 5.4. Каталог товаров (OpenListItem)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | id продукта |
| `name` | string | название продукта |
| `imgPath` | string | путь до картинки |

## 5.5. Калибровка (PollCalibrationDTO)

| Поле | Тип | Описание |
|------|-----|----------|
| `view.opId` | string | id операции |
| `view.done` | boolean | завершена ли калибровка |
| `view.cells[].cellId` | number | id ячейки |
| `view.cells[].status` | `SUCCESS | PENDING | ALERT` | статус |
| `view.cells[].message` | string \\| null | сообщение (`CALIBRATED` / `CALIBRATION_FAILED`) |
| `view.cells[].updatedAt` | string | ISO‑время |

---

# 6. HTTP API BFF (для фронта)

**Все методы — `POST`, если не указано иное.**

## 6.1. UI навигация

| Метод | URL | Назначение |
|-------|-----|------------|
| POST | `/bff/ui/open-settings` | открыть меню (AuthInput) |
| POST | `/bff/ui/nav/cells-stocks` | экран остатков |
| POST | `/bff/ui/nav/cells-capacity` | экран вместимости |
| POST | `/bff/ui/nav/cells-prices` | экран цен |
| POST | `/bff/ui/nav/cells-products` | экран товаров |
| POST | `/bff/ui/nav/cells-config` | экран конфигурации |
| POST | `/bff/ui/nav/diagnostics` | экран диагностики |
| POST | `/bff/ui/nav/logs` | экран логов |
| POST | `/bff/ui/back` | назад в Dashboard |
| POST | `/bff/ui/retry` | retry после ошибки (сигнал зарезервирован) |

**Пример ответа** (`POST /bff/ui/open-settings`):

```json
{
  "state": "AuthInput",
  "view": { "screen": "AuthInput" },
  "meta": {}
}
```

## 6.2. Авторизация

### `POST /bff/auth/login`

Запрос:

```json
{ "pin": "1234" }
```

Ответ (пример):

```json
{
  "state": "Dashboard",
  "view": { "screen": "Dashboard", "message": "Role: ENGINEER" },
  "meta": {}
}
```

Пример ошибки (неверный PIN):

```json
{
  "state": "AuthError",
  "view": { "screen": "AuthInput", "error": "Wrong PIN" },
  "meta": {}
}
```

### `POST /bff/auth/logout`

Сбрасывает контекст FSM и возвращает `AuthInput`.

### `POST /bff/auth/me`

Возвращает профиль пользователя из backend:

```json
{
  "state": "<current>",
  "view": { "data": { "role": "...", "username": "..." } },
  "meta": { "status": 200 }
}
```

Если токена нет:

```json
{ "state": "<current>", "view": {}, "meta": { "error": "No token" } }
```

## 6.3. Работа с ячейками

### `POST /bff/cells/stock`

```json
{ "cellId": 12, "stock": 5 }
```

### `POST /bff/cells/fill-row`

```json
{ "row": 2 }
```

### `POST /bff/cells/capacity/row`

```json
{ "row": 3, "capacity": 10 }
```

### `POST /bff/cells/capacity/cell`

```json
{ "cellId": 7, "capacity": 12 }
```

### `POST /bff/cells/price/row`

```json
{ "row": 1, "price": 210.5 }
```

### `POST /bff/cells/price/cell`

```json
{ "cellId": 5, "price": 250 }
```

### `POST /bff/cells/status`

```json
{ "cellIds": [1,2], "status": "disabled" }
```

### `POST /bff/cells/merge`

```json
{ "cellIds": [10,11] }
```

### `POST /bff/cells/split`

```json
{ "cellIds": [10,11] }
```

### `POST /bff/cells/type`

```json
{ "cellIds": [21,22], "type": "conveyor" }
```

## 6.4. Товары

### `POST /bff/products/open-list`

Возвращает список продуктов для назначения.

### `POST /bff/products/assign`

```json
{ "cellId": 5, "productId": 101 }
```

### `POST /bff/products/assign-row`

```json
{ "row": 2, "productId": 101, "scope": "all" }
```

## 6.5. Диагностика

### `POST /bff/diagnostics/run`

```json
{ "cellIds": [1,2,3] }
```

### `POST /bff/diagnostics/rerun`

Повтор последнего теста (сигнал зарезервирован, UI не использует).

### `POST /bff/diagnostics/test-cells/load`

Загрузить диагностический список ячеек.

### `POST /bff/diagnostics/test-cells/calibration/start`

### `POST /bff/diagnostics/test-cells/calibration/poll`

### `POST /bff/diagnostics/test-cells/test/start`

### `POST /bff/diagnostics/test-cells/test/poll`

### `POST /bff/diagnostics/info`

Информация о системе (uptime, версии, hardware).

## 6.6. Логи

### `POST /bff/logs/search`

```json
{ "text": "error" }
```

### `POST /bff/logs/full`

Сигнал зарезервирован, но не обработан в FSM.

## 6.7. Maintenance

### `POST /bff/maintenance/state`

Возвращает текущие параметры автомата (дверь, температура, и т.п.).

### `POST /bff/maintenance/self-test`

Запуск self‑test, возвращает результат.

### `POST /bff/maintenance/calibration`

Запуск калибровки (возвращает `opId`).

## 6.8. Health‑check

`GET /bff/health`:

```json
{ "ok": true, "fsmState": "..." }
```

---

# 7. Сценарии (front ↔ back)

## 7.1. Вход в сервисное меню

- `POST /bff/ui/open-settings` → `AuthInput`.
- `POST /bff/auth/login` с PIN → `Dashboard`.
- При ошибке PIN → `AuthError`.

## 7.2. Навигация по ячейкам

`POST /bff/ui/nav/cells-prices` → FSM загрузит `cells` → экран `Cells/prices`.

## 7.3. Назначение товара

- `POST /bff/products/open-list` → список продуктов.
- `POST /bff/products/assign` или `/assign-row`.
- FSM обновляет `cells` и возвращает экран `Cells/products`.

## 7.4. Диагностика

- `POST /bff/ui/nav/diagnostics`
- `POST /bff/diagnostics/test-cells/calibration/start`
- `POST /bff/diagnostics/test-cells/calibration/poll` до `done=true`.

## 7.5. Логи

- `POST /bff/ui/nav/logs` → последние логи.
- `POST /bff/logs/search` → фильтрация.

---

# 8. Ограничения и особенности

- BFF stateful, рассчитан на одиночную сессию UI.
- Токен хранится в памяти FSM, не в localStorage.
- `sessionInactivityMs` сбрасывает FSM в `Idle`.
- Некоторые сигналы в BFF объявлены, но не реализованы в FSM:
  - `UI.Retry`
  - `UI.Rerun`
  - `Logs.ToggleFull`

---

# 9. Backend API (SVC_BACKEND_URL) — контракт, который ожидает FSM

FSM обращается к backend по `SVC_BACKEND_URL` и ожидает JSON. Токен передаётся в заголовке:

```
Authorization: Bearer <token>
```

Логика обработки статусов:

- `200/204` → успех
- `401` → `TokenInvalid`
- остальное → `BackendError`

Формат ошибок backend:

```json
{ "error": "Human readable message" }
```

Общая ошибка для всех защищённых методов:

```json
{ "error": "Unauthorized" }
```

## 9.1. Auth

### `POST /auth/login`

```json
{ "pin": "1234" }
```

Ответ:

```json
{ "accessToken": "jwt...", "role": "ENGINEER" }
```

### `GET /auth/me`

```json
{ "role": "ENGINEER", "username": "service_eng" }
```

## 9.2. Cells

### `GET /cells`

Ответ: массив `CellPrice`.

### `POST /cells/split`

```json
{ "cellIds": [10, 11] }
```

### `POST /cells/stock/fill-row`

```json
{ "row": 2 }
```

### `PUT /cells/{cellId}/stock`

```json
{ "stock": 5 }
```

### `PUT /cells/capacity/set-for-row`

```json
{ "row": 3, "capacity": 10 }
```

### `PUT /cells/{cellId}/capacity`

```json
{ "capacity": 12 }
```

### `PUT /cells/price/set-for-row`

```json
{ "row": 1, "price": 210.5 }
```

### `PUT /cells/{cellId}/price`

```json
{ "price": 250 }
```

### `PUT /cells/{cellId}/product`

```json
{ "productId": 101 }
```

### `POST /cells/status`

```json
{ "cellIds": [1,2], "status": "disabled" }
```

### `POST /cells/merge`

```json
{ "cellIds": [10,11] }
```

### `PUT /cells/type`

```json
{ "cellIds": [21,22], "type": "conveyor" }
```

## 9.3. Products

### `GET /products?search=&page=&limit=`

Ответ: массив товаров.

## 9.4. Diagnostics

### `GET /diagnostics/test-cells`

Ответ: массив `CellDiagnostics`.

### `POST /diagnostics/test-cells`

```json
{ "cellIds": [1,2,3] }
```

### `POST /diagnostics/test-cells/calibration`

Ответ:

```json
{ "opId": "cal_...", "status": "STARTED" }
```

### `GET /diagnostics/test-cells/calibration?opId=...`

Ответ:

```json
{
  "opId": "cal_...",
  "done": false,
  "cells": [
    { "cellId": 1, "status": "PENDING", "message": null, "updatedAt": "..." }
  ]
}
```

### `POST /diagnostics/test-cells/test`

Ответ:

```json
{ "opId": "test_...", "status": "STARTED" }
```

### `GET /diagnostics/test-cells/test?opId=...`

Ответ:

```json
{
  "opId": "test_...",
  "done": true,
  "cells": [
    { "cellId": 1, "status": "SUCCESS", "message": "OK", "updatedAt": "..." }
  ]
}
```

### `GET /diagnostics/info`

```json
{ "uptime": 12345, "softwareVersion": "3.0.1", "hardware": { "door": "closed", "tempC": 4.4, "lighting": true } }
```

### `GET /diagnostics/logs?search=&level=&limit=&offset=&full=`

```json
{
  "items": [
    { "ts": "2026-02-02T11:59:00.000Z", "level": "INFO", "msg": "System boot" }
  ],
  "total": 1
}
```

## 9.5. Maintenance

### `GET /maintenance/state`

```json
{ "door": "closed", "tempC": 4.4, "lighting": true }
```

### `POST /maintenance/self-test`

```json
{ "status": "OK", "details": "All sensors nominal" }
```

### `POST /maintenance/calibration/start`

```json
{ "opId": "cal_...", "status": "STARTED" }
```

---

# 10. Telemetry API (используется FSM)

FSM выполняет синхронизацию каталога:

```
POST {TELEMETRY_API_BASE_URL}/api/telemetry/catalog/sync
```

Ответ используется только для prefetch‑логики (статус 200 = успех).

---

# 11. Таблица соответствия BFF → Backend

| BFF endpoint | Signal | Backend endpoint | Метод | Описание |
|-------------|--------|------------------|-------|----------|
| `/bff/auth/login` | `Auth.SubmitPin` | `/auth/login` | POST | Авторизация по PIN |
| `/bff/auth/me` | `Auth.GetProfile` | `/auth/me` | GET | Профиль пользователя |
| `/bff/ui/nav/cells-*` | `UI.Navigate.*` | `/cells` | GET | Загрузка списка ячеек |
| `/bff/cells/stock` | `Cells.EditStock` | `/cells/{cellId}/stock` | PUT | Изменение остатка |
| `/bff/cells/fill-row` | `Cells.FillRow` | `/cells/stock/fill-row` | POST | Заполнение ряда |
| `/bff/cells/capacity/row` | `Cells.SetRowCapacity` | `/cells/capacity/set-for-row` | PUT | Вместимость ряда |
| `/bff/cells/capacity/cell` | `Cells.SetCellCapacity` | `/cells/{cellId}/capacity` | PUT | Вместимость ячейки |
| `/bff/cells/price/row` | `Cells.SetRowPrice` | `/cells/price/set-for-row` | PUT | Цена ряда |
| `/bff/cells/price/cell` | `Cells.SetCellPrice` | `/cells/{cellId}/price` | PUT | Цена ячейки |
| `/bff/cells/status` | `Cells.SetStatus` | `/cells/status` | POST | Вкл/выкл ячеек |
| `/bff/cells/merge` | `Cells.Merge` | `/cells/merge` | POST | Объединение |
| `/bff/cells/split` | `Cells.Split` | `/cells/split` | POST | Разъединение |
| `/bff/cells/type` | `Cells.SetType` | `/cells/type` | PUT | Тип ячеек |
| `/bff/products/open-list` | `Cells.OpenAssignProduct` | `/products` | GET | Список товаров |
| `/bff/products/assign` | `Products.Assign` | `/cells/{cellId}/product` | PUT | Назначить товар |
| `/bff/products/assign-row` | `Products.AssignRow` | `/cells/{cellId}/product` | PUT | Назначить товар ряду (итерация) |
| `/bff/ui/nav/diagnostics` | `UI.Navigate.DiagnosticsTest` | `/diagnostics/test-cells` | GET | Диагностический список |
| `/bff/diagnostics/run` | `Diagnostics.RunTest` | `/diagnostics/test-cells` | POST | Тест ячеек |
| `/bff/diagnostics/test-cells/load` | `Diagnostics.LoadCells` | `/diagnostics/test-cells` | GET | Обновить список |
| `/bff/diagnostics/test-cells/calibration/start` | `Diagnostics.StartCalibration` | `/diagnostics/test-cells/calibration` | POST | Запуск калибровки |
| `/bff/diagnostics/test-cells/calibration/poll` | `Diagnostics.PollCalibration` | `/diagnostics/test-cells/calibration` | GET | Статус калибровки |
| `/bff/diagnostics/test-cells/test/start` | `Diagnostics.StartCellsTest` | `/diagnostics/test-cells/test` | POST | Запуск теста |
| `/bff/diagnostics/test-cells/test/poll` | `Diagnostics.PollCellsTest` | `/diagnostics/test-cells/test` | GET | Статус теста |
| `/bff/diagnostics/info` | `Diagnostics.GetInfo` | `/diagnostics/info` | GET | Системная информация |
| `/bff/ui/nav/logs` | `UI.Navigate.Logs` | `/diagnostics/logs` | GET | Логи (базово) |
| `/bff/logs/search` | `Logs.Search` | `/diagnostics/logs?search=` | GET | Поиск по логам |
| `/bff/maintenance/state` | `Maintenance.GetState` | `/maintenance/state` | GET | Состояние |
| `/bff/maintenance/self-test` | `Maintenance.SelfTest` | `/maintenance/self-test` | POST | Self‑test |
| `/bff/maintenance/calibration` | `Maintenance.CalibrationStart` | `/maintenance/calibration/start` | POST | Калибровка |

---

# 12. Справочник ошибок backend (расширенный)

Ниже перечислены сообщения, которые реально возвращает backend
(`ServiceMenu/back/testback/test-backend.mjs`).

## 12.1. Auth

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Wrong PIN` | 401 | `POST /auth/login` | неверный PIN |
| `Unauthorized` | 401 | `GET /auth/me` и др. | отсутствует/невалидный токен |

## 12.2. Cells (общие)

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Not found` | 404 | `PUT /cells/{id}/stock` | ячейка не найдена |
| `cellIds are required` | 400 | `PUT /cells/type` | список пуст |
| `Invalid type. Allowed: spiral, conveyor` | 400 | `PUT /cells/type` | неверный тип |
| `Controller split failed` | 502 | `POST /cells/split` | ошибка контроллера |

## 12.3. Cells (merge)

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Need at least 2 valid cells to merge` | 400 | `POST /cells/merge` | недостаточно ячеек |
| `One or more cells not found` | 404 | `POST /cells/merge` | часть ячеек отсутствует |
| `Cells must be in the same row to merge` | 400 | `POST /cells/merge` | разные ряды |
| `Cells X and Y must be adjacent` | 400 | `POST /cells/merge` | не соседние |
| `Cannot merge already merged cells (X, Y)` | 400 | `POST /cells/merge` | уже merged |
| `Cells must be size=1 to merge (X, Y)` | 400 | `POST /cells/merge` | размер > 1 |
| `Merging already merged cells is not allowed for 2-cell merge` | 400 | `POST /cells/merge` | запрет для 2 ячеек |
| `Controller merge failed` | 502 | `POST /cells/merge` | ошибка контроллера |

## 12.4. Diagnostics

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Controller calibration failed` | 502 | `POST /diagnostics/test-cells/calibration` | ошибка контроллера |
| `No calibration in progress` | 404 | `GET /diagnostics/test-cells/calibration` | нет активной калибровки |
| `Calibration op not found` | 404 | `GET /diagnostics/test-cells/calibration` | неверный `opId` |
| `No test in progress` | 404 | `GET /diagnostics/test-cells/test` | нет активного теста |
| `Test op not found` | 404 | `GET /diagnostics/test-cells/test` | неверный `opId` |

## 12.5. Logs

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Unauthorized` | 401 | `GET /diagnostics/logs` | невалидный токен |

## 12.6. Maintenance

| Сообщение | HTTP | Где | Комментарий |
|-----------|------|-----|-------------|
| `Unauthorized` | 401 | `GET /maintenance/state` | невалидный токен |

---

# 13. Взаимодействие с фронтом и навигация (максимально подробно)

Ниже описано фактическое поведение фронта (React) и то,
какие вызовы BFF выполняются при каждом пользовательском действии.

## 13.1. Точки входа и маршруты (route map)

Сервисное меню живёт внутри клиентского приложения (`ClientPage`)
и открывается поверх экрана покупки.

| Маршрут | Экран/компонент | Назначение | Ключевые запросы |
|--------|------------------|-----------|------------------|
| `/` | `ProductMatrix` | Матрица товаров для покупки | `getProductMatrixAction()` |
| `/product/:cellId` | `Product` | Карточка товара | (покупка) |
| `/menu` | `ServiceMenu` | Главное меню сервисного режима | нет прямых запросов |
| `/menu/cellControl` | `CellsControl` | Управление ячейками | `POST /bff/ui/nav/cells-*` |
| `/menu/cellControl/changeProducts` | `ChangeCellsControlProducts` | Назначение товара | `POST /bff/products/open-list` |
| `/menu/diagnostics` | `CellsDiagnostics` | Диагностика | `POST /bff/ui/nav/diagnostics` |

**Важно:** фронт использует базовый URL `serviceMenuBaseUrl`,
который берётся из `VITE_APP_SNACK_API_SERVICE_URL`.

## 13.2. Открытие сервисного меню из покупки

Источник входа — кнопка со стрелкой на экране матрицы товаров (`ProductMatrix`).

Последовательность:

1) Пользователь нажимает кнопку входа в сервисное меню.
2) Фронт **сразу** вызывает `POST /bff/ui/open-settings`.
3) Открывается модалка `AuthorizationModal`.
4) **Локальная проверка PIN**: допускается только `shaker2026`.
   - если PIN неверный — показывается ошибка и запросы в BFF не отправляются;
5) Если PIN валиден — `POST /bff/auth/login` с `{ pin: "shaker2026" }`.
6) Далее фронт выполняет `navigate('/menu')`.

**Особенность:** переход в `/menu` происходит после dispatch,
даже если backend авторизацию отклонит.

## 13.3. Главное меню сервиса (`/menu`)

Экран содержит два пункта:

- **Управление ячейками** → `/menu/cellControl`
- **Диагностика** → `/menu/diagnostics`

Кнопка закрытия (иконка `X`) выполняет:

```
navigate('/', { state: { refreshProductMatrix: Date.now() } })
```

## 13.4. Обновление матрицы товаров после выхода

`ClientPage` отслеживает смену маршрутов:

- Если пользователь **выходит** из `/menu*`, вызывается `getProductMatrixAction({ cacheBust })`.
- Если после выхода приложение получает фокус, матрица товаров также обновляется.

Итого: после сервисного меню всегда обновляется матрица товаров.

## 13.5. Управление ячейками (`/menu/cellControl`)

### 13.5.1. Вкладки

Верхний "Назад" выполняет `POST /bff/ui/back` и `navigate('/menu')`.

Вкладки:

- **Цены** — вкладка по умолчанию.
- **Товары**
- **Конфигурация**

При смене вкладки:

1) `POST /bff/ui/back`
2) `setSelectedCellControlTab(<tab>)`
3) активная вкладка выполняет загрузку данных.

### 13.5.2. Вкладка "Цены"

- `POST /bff/ui/nav/cells-prices` при монтировании.
- Клик по ячейке → модалка изменения цены для ячейки.
- Кнопка "Изменить цену всех ячеек в полке" → изменение цены ряда.
- Если цены в ряду одинаковы — значение предзаполняется, иначе поле пустое.

Запросы:

- `POST /bff/cells/price/cell` `{ cellId, price }`
- `POST /bff/cells/price/row` `{ row, price }`

### 13.5.3. Вкладка "Товары"

- `POST /bff/ui/nav/cells-products` при монтировании.
- Клик по ячейке или кнопка "Изменить товары в полке" → переход
  в `/menu/cellControl/changeProducts`.

### 13.5.4. Экран "Изменить товар"

- При открытии: `POST /bff/products/open-list`.
- Поиск — только на фронте (фильтр по названию).
- Назначение:
  - `POST /bff/products/assign` `{ cellId, productId }`
  - `POST /bff/products/assign-row` `{ row, productId, scope: "all" }`

После назначения:

1) `resetChangeCellsProducts`
2) `POST /bff/ui/back`
3) `navigate('/menu/cellControl')`

### 13.5.5. Вкладка "Конфигурация"

- `POST /bff/ui/nav/cells-config` при монтировании.
- Выбор ячеек: одиночные клики или "Выбрать всю полку".
- Действия:
  - `POST /bff/cells/status` (вкл/выкл)
  - `POST /bff/cells/type` (тип)
  - `POST /bff/cells/merge` (объединить)
  - `POST /bff/cells/split` (разъединить)

После действия выделение сбрасывается.

## 13.6. Диагностика (`/menu/diagnostics`)

### 13.6.1. Навигация

Активна только вкладка **"Тест ячеек"**.
Кнопка "Назад" → `POST /bff/ui/back` и `navigate('/menu')`.

### 13.6.2. Калибровка

Последовательность:

1) `POST /bff/ui/nav/diagnostics`
2) `POST /bff/diagnostics/test-cells/load`
3) `POST /bff/diagnostics/test-cells/calibration/start`
4) `POST /bff/diagnostics/test-cells/calibration/poll` каждые 5 сек до `done=true`

Кнопка "Тест" в UI выключена, логика частичного теста закомментирована.

## 13.7. Ошибки и повтор

Если запросы завершаются ошибкой или `meta.warn` не пустой:

- UI показывает компонент `Error`.
- Кнопка "Повторить" вызывает `POST /bff/ui/retry`.

## 13.8. Нормализация ссылок на картинки

Фронт нормализует `imgPath` через `buildServiceMenuUrl`:

- базовый URL: `VITE_APP_SNACK_API_URL` (по умолчанию `http://localhost:4000`);
- префикс media: `VITE_APP_SNACK_MEDIA_PREFIX` (по умолчанию `/media`);
- если `productId` = 0 → показывается `ICON_EMPTY_DATA_URL`.
