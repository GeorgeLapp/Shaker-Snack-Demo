Документация по платёжному стеку Shaker Snack (backend).

Файлы и модули:
- `back/src/server.js`
- `back/src/controllers/clientController.js`
- `back/src/services/paymentDevice.js`
- `back/src/services/mdb-rs232-cashless.mjs`
- `back/src/services/vendingControllerClient.js`

---

# 1. Общее описание

Платёжный стек отвечает за полный цикл продажи:

1) принимает запросы от фронта через HTTP API;
2) валидирует `cellNumber` через телеметрию;
3) инициирует оплату на cashless-ридере через MDB-RS232 мост;
4) запускает выдачу товара через контроллер автомата;
5) завершает сессию на ридере (success/failure/cleanup).

Текущая реализация использует **Product First** сценарий: ридер в idle отключён,
а оплата начинается после выбора товара (VEND REQUEST от VMC).

---

# 2. Архитектура и зависимости

## 2.1. Компонентная схема

```text
+-------------------+        HTTP         +---------------------------+
| Front / Service   | <------------------> | back/src/server.js       |
| Menu UI           |                     | (HTTP API, CORS, media)   |
+-------------------+                     +---------------------------+
                                             |           |         |
                                             | HTTP      | HTTP    | RS-232
                                             v           v         v
+----------------------------------+  +----------------+  +------------------+
| Telemetry API                    |  | Vending        |  | Cashless reader  |
| /api/matrix, /api/catalog        |  | Controller API |  | via MDB-RS232    |
| (Telemetry/new/telemetry-api)    |  | /vend/simple   |  | bridge (Wafer)   |
+----------------------------------+  +----------------+  +------------------+
```

Примечание: схемы корректно отображаются в моноширинном шрифте.

## 2.2. Ключевые связи

- **Telemetry API** — источник матрицы и цен.
- **Vending Controller API** — выдача товара.
- **MDB-RS232 bridge** — связь с ридером.

---

# 3. Сценарии продаж (Product First)

## 3.1. Успешная продажа (happy path)

```text
Front            Backend                 Reader                 Vending Controller
  | POST /start-sale |                      |                          |
  |----------------->|                      |                          |
  |                  | validate cellNumber  |                          |
  |                  | -> Telemetry /api/*  |                          |
  |                  | readerEnable         |                          |
  |                  | vendRequest(price)   |                          |
  |                  |--------------------->|                          |
  |                  |   vendApproved       |                          |
  |                  |<---------------------|                          |
  |   {success:true} |                      |                          |
  |<-----------------|                      |                          |
  | POST /issue-product                     |                          |
  |----------------->| vendProduct(channel) |------------------------->|
  |                  |  ok                  |<-------------------------|
  |                  | vendSuccess          |                          |
  |                  | sessionComplete      |                          |
  |                  | readerDisable        |                          |
  |   {success:true} |                      |                          |
  |<-----------------|                      |                          |
```

## 3.2. Отказ/таймаут оплаты

- `start-sale` завершится ошибкой (HTTP 402/409/504 и т.д.).
- Сессия на ридере закрывается best-effort:
  - `vendCancel` → `sessionComplete` → `readerDisable`.

## 3.3. Отмена продажи оператором

`POST /api/cancel-sale` вызывает `cancelPayment()`:

- отправляет `vendCancel`;
- завершает сессию (`sessionComplete`);
- отключает ридер (`readerDisable`).

---

# 4. HTTP API backend

Базовый адрес: `http://<host>:<PORT>` (по умолчанию `4000`).

## 4.1. Формат ответов

- Успешные ответы возвращают либо объект `{ "success": true }`,
  либо массив данных (например, матрицу товаров).
- Ошибки возвращаются в формате:

```json
{
  "message": "Human readable error text"
}
```

HTTP-код ошибки задаётся по месту возникновения (валидация, телеметрия,
платёжный драйвер, vending controller).

## 4.2. `GET /api/product-matrix`

Возвращает матрицу товаров, нормализованную из телеметрии.

**Пример ответа:**

```json
[
  {
    "id": 11,
    "productId": 501,
    "cellNumber": 11,
    "rowNumber": 2,
    "price": 180,
    "imgPath": "protein_bar.png",
    "brandName": "Shaker",
    "productName": "Protein Bar",
    "description": "Vanilla 60g",
    "calories": 220,
    "proteins": 20,
    "fats": 7,
    "carbohydrates": 18
  }
]
```

## 4.3. `POST /api/start-sale`

Старт оплаты на ридере (Product First).

**Запрос:**

```json
{
  "cellNumber": 11
}
```

**Успешный ответ:**

```json
{
  "success": true
}
```

**Типовые ошибки:**

| HTTP | Сообщение (пример) | Причина |
|------|--------------------|---------|
| 400  | `cellNumber is required` | `cellNumber` отсутствует |
| 400  | `cellNumber must be a positive integer` | неверный формат |
| 404  | `Product not found for the provided cellNumber` | ячейка отсутствует или выключена |
| 409  | `Another payment session is already in progress` | активна другая сессия |
| 402  | `Payment was declined by reader` | отказ оплаты |
| 499  | `Payment was cancelled` | отмена |
| 504  | `Timed out waiting for payment approval` | таймаут ожидания |
| 503  | `Payment serial port is not configured` | не настроен порт |
| 503  | `Payment driver module is not available` | нет модуля/зависимости |

## 4.4. `POST /api/issue-product`

Команда на выдачу товара через контроллер автомата.

**Запрос:**

```json
{
  "cellNumber": 11
}
```

**Успешный ответ:**

```json
{
  "success": true
}
```

**Ошибки:**

- `400/404` — невалидная или отсутствующая ячейка (валидация по телеметрии).
- `502` — ошибка запроса к Vending Controller API или неожиданный ответ.

При ошибке выдачи **всегда** вызывается `finalizePaymentAfterVend`
с `success=false` (refund если поддерживается ридером).

## 4.5. `POST /api/cancel-sale`

Отмена текущей платежной сессии.

**Запрос:**

```json
{
  "cellNumber": 11
}
```

**Ответ:**

```json
{
  "success": true
}
```

Примечание: отмена применяется к **текущей активной** сессии,
даже если `cellNumber` не совпадает.

---

# 5. Валидация через телеметрию

Backend обращается к Telemetry HTTP API:

- `GET {TELEMETRY_API_BASE_URL}/api/matrix`
- `GET {TELEMETRY_API_BASE_URL}/api/catalog`

Нормализация данных:

- учитываются только строки с `enabled !== 0`;
- `cellNumber` берётся из `cell_number` или `cellNumber`;
- `price`:
  - если есть `price` — используется напрямую;
  - иначе `price_minor / 100` (из матрицы или каталога);
- `imgPath`:
  - если это URL — отдаётся как есть;
  - иначе используется только имя файла (последний сегмент пути).

---

# 6. Модуль оплаты `paymentDevice.js`

## 6.1. Инициализация оборудования

При старте сервера вызывается `warmupPaymentDevice()`:

1) `open()` драйвера;
2) `reset()`;
3) `setupConfig()` (Feature Level 3, full ASCII display);
4) `setupMaxMinPrices()` (min=1.0, max=500.0 в масштабе ридера);
5) `expansionEnableOptions(OPT_FEATURE_ALWAYS_IDLE)` (если поддерживается);
6) `readerDisable()` — ридер остаётся выключенным в idle.

Если инициализация провалилась, сервер **не стартует**.

## 6.2. Управление сессией

- одновременно допускается **только одна** сессия;
- таймаут жизни сессии: `PAYMENT_SESSION_TTL_MS` (по умолчанию 60 сек);
- при истечении TTL сессия очищается и логируется.

## 6.3. Процесс оплаты

`processPayment({ cellNumber, price, productId })`:

1) `readerEnable()` + задержка `PAYMENT_READER_ENABLE_DELAY_MS`;
2) `vendRequest(priceScaled, itemNumber=cellNumber)`;
3) ожидание `vendApproved` (или `vendDenied/cancelled/endSession`);
4) при ошибке: `vendCancel` → `sessionComplete` → `readerDisable`.

## 6.4. Завершение оплаты после выдачи

`finalizePaymentAfterVend({ cellNumber, success })`:

- `vendSuccess(itemNumber)` если выдача успешна;
- `vendFailure()` если выдача неуспешна;
- `sessionComplete()` и `readerDisable()` в обоих случаях.

---

# 7. Интеграция с Vending Controller

`vendingControllerClient.js` обращается к внешнему HTTP API контроллера:

- `POST {VENDING_CONTROLLER_API_URL}/vend/simple`
- передаёт `{ "channel": cellNumber }` (+ `timeoutMs` при наличии настройки)

Ошибки контроллера конвертируются в HTTP 502 для клиента.

---

# 8. Конфигурация (Linux)

## 8.1. Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `PORT` | `4000` | HTTP порт backend |
| `ALLOWED_ORIGIN` | `*` | CORS `Access-Control-Allow-Origin` |
| `STATIC_ROUTE_PREFIX` | `/media` | URL префикс статических файлов |
| `STATIC_MEDIA_ROOT` | `../../SnackMedia` | директория с медиа |
| `TELEMETRY_API_BASE_URL` | `http://localhost:3002` | базовый URL телеметрии |
| `VENDING_CONTROLLER_API_URL` | `http://127.0.0.1:5000/api/v1` | API контроллера |
| `VENDING_CONTROLLER_REQUEST_TIMEOUT_MS` | `10000` | таймаут HTTP запросов к контроллеру |
| `VENDING_CONTROLLER_VEND_TIMEOUT_MS` | *(не задано)* | `timeoutMs` для `/vend/simple` |
| `PAYMENT_PORT_PATH` | `/dev/ttyS4` | RS-232 порт ридера |
| `PAYMENT_DEVICE_PORT_PATH` | *(fallback)* | альтернативное имя порта |
| `PAYMENT_BAUD_RATE` | `9600` | скорость порта |
| `PAYMENT_CASHLESS_NUMBER` | `1` | cashless #1 или #2 |
| `PAYMENT_APPROVAL_TIMEOUT_MS` | `20000` | таймаут ожидания `vendApproved` |
| `PAYMENT_SESSION_TTL_MS` | `60000` | время жизни сессии |
| `PAYMENT_READER_ENABLE_DELAY_MS` | `200` | задержка после `readerEnable` |
| `PAYMENT_DEVICE_DEBUG` | `false` | логирование активности ридера |

## 8.2. Пример запуска

```bash
export PORT=4000
export TELEMETRY_API_BASE_URL="http://localhost:3002"
export VENDING_CONTROLLER_API_URL="http://127.0.0.1:5000/api/v1"
export PAYMENT_PORT_PATH="/dev/ttyS4"
export PAYMENT_BAUD_RATE=9600
export PAYMENT_CASHLESS_NUMBER=1
export PAYMENT_DEVICE_DEBUG=true

node back/src/server.js
```

---

# 9. Логи и диагностика

Логирование осуществляется через `logEvent(label, payload)`:

- `payment.hardware.opened`
- `payment.hardware.approved`
- `payment.hardware.vendSuccess`
- `payment.hardware.vendFailure`
- `payment.hardware.readerDisable.warn`
- `client.startSale`, `client.issueProduct`, `client.cancelSale`

В `PAYMENT_DEVICE_DEBUG=true` логируется активность ридера
(`payment.hardware.activity` с типом и raw hex).

---

# 10. Типовые кейсы

1) **Параллельные продажи**
   - Симптом: `Another payment session is already in progress` (HTTP 409).
   - Решение: дождаться завершения/TTL или явно вызвать `/api/cancel-sale`.

2) **Таймаут оплаты**
   - Симптом: `Timed out waiting for payment approval` (HTTP 504).
   - Решение: проверить связь с ридером, увеличить `PAYMENT_APPROVAL_TIMEOUT_MS`.

3) **Порт не открыт**
   - Симптом: `Payment serial port is not configured` (HTTP 503).
   - Решение: проверить `PAYMENT_PORT_PATH` и права доступа к `/dev/ttyS*`.

4) **Ошибка выдачи товара**
   - Симптом: `issue-product` возвращает 502.
   - Поведение: платежная сессия завершается как failure (refund если поддерживается).
   - Решение: проверить Vending Controller API и сам контроллер.
