# Shaker-Snack-Demo

Демо‑проект автомата Shaker Snack: backend, front, контроллеры и интеграции,
а также полный набор технической документации по ключевым модулям.

---

## Состав репозитория (кратко)

- `back/` — основной backend автомата (покупка, интеграции, API).
- `front/` — клиентское приложение (UI покупки и сервисного меню).
- `ServiceMenu/` — сервисное меню (BFF + FSM + backend).
- `Telemetry/` — модуль телеметрии, локальные API и хранение.
- `Controller/` — контроллер автомата и его HTTP API.
- `Payment/` — платёжный стек и интеграции.
- `mdb-rs232-bridge/` — мост MDB ↔ RS‑232 для cashless устройств.
- `DB/` — базы, схемы и дампы.
- `docs/` — документация по модулям и API.

---

## Документация (актуальные файлы)

- `docs/telemetry.md` — телеметрия: API, формат данных, сценарии.
- `docs/vending-controller-http-api.md` — HTTP API контроллера.
- `docs/vending-controller.md` — описание контроллера и его логики.
- `docs/payment-stack.md` — платёжный стек (архитектура, потоки, API).
- `docs/mdb-rs232-cashless.md` — модуль cashless (мост MDB‑RS232).
- `docs/mdb-rs232-cashless-full-doc-rev3_2.md` — полная ревизия документа по MDB‑RS232 cashless.
- `docs/purchase-module.md` — модуль покупки (frontend ↔ backend).
- `docs/service-menu.md` — сервисное меню (BFF + FSM + frontend навигация).

---

## Быстрые ориентиры

### Сервисное меню

- BFF: `ServiceMenu/back/bff-server.mjs`
- FSM: `ServiceMenu/back/fsm-service-menu.js`
- Backend (тестовый стенд, в документации именуется как “backend”):  
  `ServiceMenu/back/testback/test-backend.mjs`

### Front

- Вход в сервисное меню: `front/src/pages/Client/ProductMatrix/ProductMatrix.tsx`
- Экран сервиса: `front/src/pages/Service/ServiceMenu/`

### Telemetry

- База/хранилище: `Telemetry/`
- Синхронизация каталога: `POST /api/telemetry/catalog/sync`

---

## Примечания по окружению

- Все примеры путей в документации приведены в Linux‑формате.
- UI сервисного меню работает через BFF и не обращается напрямую к backend.

---

## 1) Быстрый старт (запуск компонентов)

Ниже указаны **базовые** команды запуска. В проде используйте свои переменные окружения.

### 1.1. Backend покупки (основной backend)

```bash
cd back
npm install
npm run start
```

По умолчанию слушает порт `4000` (`PORT` в `back/src/server.js`).

### 1.2. Front (UI покупки + сервисное меню)

```bash
cd front
npm install
npm run start
```

По умолчанию Vite стартует на `3000`.

### 1.3. Service Menu: BFF + FSM

```bash
cd ServiceMenu/back
npm install
node bff-server.mjs
```

По умолчанию `BFF_PORT=3001`.

### 1.4. Service Menu: backend (тестовый стенд)

```bash
cd ServiceMenu/back/testback
npm install
npm run start
```

По умолчанию `PORT=8080` (`/api/v1`).

### 1.5. Telemetry API

```bash
node Telemetry/new/telemetry-api.mjs
```

По умолчанию `TELEMETRY_HTTP_PORT=3002`.

---

## 2) Архитектурный обзор (крупными блоками)

```text
Front (UI покупки + сервисное меню)
        |                       |
        | HTTP (REST)           | HTTP (BFF)
        v                       v
Backend покупки (back)     Service Menu BFF (ServiceMenu/back)
        |                       |
        |                      FSM
        |                       |
        +------------------> backend сервисного меню
                                |
                                +--> Telemetry API
                                +--> Controller API
```

Ключевые потоки:

- Покупка: `front` → `back` → платежные устройства/контроллер.
- Сервисное меню: `front` → `ServiceMenu/back` (BFF/FSM) → backend сервиса.
- Телеметрия: `Telemetry/new` предоставляет локальный HTTP API и синхронизирует данные.

---

## 3) Порты и базовые endpoints

| Компонент | Порт (по умолчанию) | Базовый URL | Примечание |
|----------|----------------------|-------------|------------|
| Front | `3000` | `http://localhost:3000` | Vite dev server |
| Backend покупки | `4000` | `http://localhost:4000` | `back/src/server.js` |
| Service Menu BFF | `3001` | `http://localhost:3001` | `ServiceMenu/back/bff-server.mjs` |
| Service Menu backend | `8080` | `http://localhost:8080/api/v1` | `ServiceMenu/back/testback` |
| Telemetry API | `3002` | `http://localhost:3002` | `Telemetry/new/telemetry-api.mjs` |

Минимальные маршруты:

- Покупка: `GET /api/product-matrix`, `POST /api/start-sale`, `POST /api/issue-product`.
- Сервисное меню: `/bff/*` (см. `docs/service-menu.md`).
- Телеметрия: `/api/telemetry/*`, `/api/matrix`, `/api/catalog`.

---

## 4) Карта документации

- `docs/telemetry.md` — телеметрия: API, формат данных, сценарии синхронизации.
- `docs/vending-controller-http-api.md` — HTTP API контроллера автомата.
- `docs/vending-controller.md` — описание контроллера и его логики.
- `docs/payment-stack.md` — платёжный стек: архитектура и потоки.
- `docs/mdb-rs232-cashless.md` — модуль cashless (мост MDB‑RS232).
- `docs/mdb-rs232-cashless-full-doc-rev3_2.md` — полная ревизия документа по MDB‑RS232 cashless.
- `docs/purchase-module.md` — модуль покупки (front ↔ back).
- `docs/service-menu.md` — сервисное меню (BFF + FSM + frontend навигация).

Дополнительные документы в репозитории:

- `back/README.md` — краткие заметки по запуску и структуре backend.
- `front/README.md` — краткие заметки по запуску фронта и инфраструктуре UI.
- `front/PageInformation.md` — перечень экранов UI и их назначение.
- `Payment/product-first-scenario.md` — сценарий Product‑First и поведение платёжного потока.

---

## Единый реестр документов (с версиями)

Если версия не указана явно в файле/названии — считается «без версии».

| Документ | Назначение | Версия/редакция |
|----------|------------|----------------|
| `docs/telemetry.md` | Телеметрия: API, данные, сценарии | без версии |
| `docs/vending-controller-http-api.md` | HTTP API контроллера | без версии |
| `docs/vending-controller.md` | Описание контроллера | без версии |
| `docs/payment-stack.md` | Платёжный стек | без версии |
| `docs/mdb-rs232-cashless.md` | MDB‑RS232 cashless (кратко) | без версии |
| `docs/mdb-rs232-cashless-full-doc-rev3_2.md` | MDB‑RS232 cashless (полная ревизия) | rev3_2 |
| `docs/purchase-module.md` | Модуль покупки | без версии |
| `docs/service-menu.md` | Сервисное меню | без версии |
| `back/README.md` | Backend заметки | без версии |
| `front/README.md` | Frontend заметки | без версии |
| `front/PageInformation.md` | Экраны UI | без версии |
| `Payment/product-first-scenario.md` | Сценарий Product‑First | без версии |

---

## 5) Окружение и переменные (.env)

Ниже перечислены **ключевые** переменные, которые реально используются кодом.
Полный список и детали — в соответствующих документах.

### 5.1. Backend покупки (`back`)

- `PORT` — порт API (по умолчанию `4000`).
- `STATIC_ROUTE_PREFIX` — префикс статических файлов (по умолчанию `/media`).
- `STATIC_MEDIA_ROOT` — путь к каталогу с медиа (`SnackMedia`).

### 5.2. Service Menu (BFF)

- `BFF_PORT` — порт BFF (по умолчанию `3001`).
- `SVC_BACKEND_URL` — backend сервисного меню (по умолчанию `http://localhost:8080/api/v1`).
- `TELEMETRY_API_BASE_URL` — Telemetry API (по умолчанию `http://localhost:3002`).

### 5.3. Telemetry

- `TELEMETRY_HTTP_PORT` — порт API телеметрии (по умолчанию `3002`).
- `TELEMETRY_WS_URL` — WebSocket сервер телеметрии.
- `TELEMETRY_OAUTH_URL` — OAuth2 token endpoint.
- `TELEMETRY_CLIENT_ID` / `TELEMETRY_CLIENT_SECRET` — креды автомата.
- `TELEMETRY_DB_PATH` — путь к локальной SQLite (`Telemetry/goods.db`).
- `TELEMETRY_PRODUCT_IMAGES_DIR` — каталог картинок (`SnackMedia`).

### 5.4. Front (Vite env)

- `VITE_APP_SNACK_API_URL` — base URL backend покупки (для медиа).
- `VITE_APP_SNACK_MEDIA_PREFIX` — префикс для медиа (обычно `/media`).
- `VITE_APP_SNACK_API_SERVICE_URL` — base URL BFF сервисного меню.
