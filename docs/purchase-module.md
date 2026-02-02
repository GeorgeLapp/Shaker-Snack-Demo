Документация по модулю покупки (purchase flow) в backend.

Основной код:
- `back/src/server.js`
- `back/src/controllers/clientController.js`
- `back/src/services/paymentDevice.js`
- `back/src/services/vendingControllerClient.js`
- `back/src/utils/requestUtils.js`
- `back/src/logger.js`

---

# 1. Общее описание

Модуль покупки реализует полный цикл продажи:

1) принимает HTTP-запрос от фронта;
2) валидирует `cellNumber` через Telemetry API;
3) инициирует оплату на cashless-ридере;
4) запускает выдачу товара через Vending Controller API;
5) завершает платёжную сессию и отключает ридер.

Сценарий оплаты — **Product First**:
ридер в idle выключен, а оплата начинается после выбора товара.

---

# 2. Архитектура и связи

```text
Front/UI
  |
  | HTTP
  v
back/src/server.js  ---> back/src/controllers/clientController.js
  |                          |
  |                          +--> Telemetry API (GET /api/matrix, /api/catalog)
  |                          +--> paymentDevice.js (cashless reader)
  |                          +--> vendingControllerClient.js (vend/simple)
  |
  +--> static media (/media) from STATIC_MEDIA_ROOT
```

Компоненты:

- `server.js` — HTTP сервер и маршруты.
- `clientController.js` — orchestration логика покупки.
- `paymentDevice.js` — работа с ридером (cashless).
- `vendingControllerClient.js` — HTTP клиент к контроллеру автомата.
- `requestUtils.js` — парсинг JSON и отправка ответов.
- `logger.js` — единый логгер событий.

---

# 3. HTTP API модуля покупки

Базовый URL: `http://<host>:<PORT>` (по умолчанию `4000`).

## 3.1. Общий формат ошибок

```json
{
  "message": "Human readable error text"
}
```

HTTP-коды соответствуют источнику ошибки:
валидация, телеметрия, ридер, vending controller.

## 3.2. `GET /api/product-matrix`

Возвращает матрицу товаров после нормализации данных телеметрии.

**Query-параметры:**

| Параметр | Тип | Значения | Описание |
|----------|-----|----------|----------|
| `_` | string \| number | любое | используется фронтом как cache-bust; backend игнорирует |

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

**Полный пример ответа (несколько товаров):**

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
  },
  {
    "id": 12,
    "productId": null,
    "cellNumber": 12,
    "rowNumber": 2,
    "price": 0,
    "imgPath": "",
    "brandName": "",
    "productName": "",
    "description": "",
    "calories": null,
    "proteins": null,
    "fats": null,
    "carbohydrates": null
  }
]
```

**Поля ответа (каждый элемент массива):**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `id` | number | `>= 1` | идентификатор ячейки (из телеметрии) |
| `productId` | number \| null | `>= 1` или `null` | ID товара, `null` если не сопоставлен |
| `cellNumber` | number | `>= 1` | номер ячейки |
| `rowNumber` | number | `>= 1` | номер ряда (рассчитывается) |
| `price` | number | `>= 0` | цена в валюте автомата |
| `imgPath` | string | URL или имя файла | путь/URL изображения; может быть пустым |
| `brandName` | string | текст | бренд |
| `productName` | string | текст | название товара |
| `description` | string | текст | описание (опционально) |
| `calories` | number \| null | `>= 0` | калории (опционально) |
| `proteins` | number \| null | `>= 0` | белки (опционально) |
| `fats` | number \| null | `>= 0` | жиры (опционально) |
| `carbohydrates` | number \| null | `>= 0` | углеводы (опционально) |

**Примеры ошибок:**

```json
{
  "message": "Telemetry API responded with 502"
}
```

## 3.3. `POST /api/start-sale`

Старт платежной сессии на ридере.

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

**Полный пример ответа:**

```json
{
  "success": true
}
```

**Поля запроса:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `cellNumber` | number | целое `>= 1` | номер ячейки для покупки |

**Поля ответа:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `success` | boolean | `true` | оплата одобрена ридером |

**Поведение:**

- Метод **ждёт одобрения оплаты** (`vendApproved`).
- При `success=true` фронт **должен вызвать** `/api/issue-product`.

**Типовые ошибки:**

| HTTP | Сообщение (пример) | Причина |
|------|--------------------|---------|
| 400  | `cellNumber is required` | нет `cellNumber` |
| 400  | `cellNumber must be a positive integer` | неверный формат |
| 404  | `Product not found for the provided cellNumber` | ячейка не найдена/отключена |
| 409  | `Another payment session is already in progress` | активна другая сессия |
| 402  | `Payment was declined by reader` | отказ ридера |
| 499  | `Payment was cancelled` | отмена |
| 504  | `Timed out waiting for payment approval` | таймаут ожидания |
| 503  | `Payment serial port is not configured` | не настроен порт |
| 503  | `Payment driver module is not available` | отсутствует модуль/зависимость |

**Примеры ошибок:**

```json
{
  "message": "cellNumber is required"
}
```

```json
{
  "message": "Payment was declined by reader"
}
```

```json
{
  "message": "Timed out waiting for payment approval"
}
```

## 3.4. `POST /api/issue-product`

Команда на выдачу товара через Vending Controller API.

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

**Полный пример ответа:**

```json
{
  "success": true
}
```

**Поля запроса:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `cellNumber` | number | целое `>= 1` | номер ячейки для выдачи |

**Поля ответа:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `success` | boolean | `true` | выдача успешно инициирована и подтверждена |

**Особенности:**

- При успехе вызывает `finalizePaymentAfterVend({ success: true })`.
- При ошибке — `finalizePaymentAfterVend({ success: false })`
  и возвращает ошибку клиенту.

**Примеры ошибок:**

```json
{
  "message": "Product not found for the provided cellNumber"
}
```

```json
{
  "message": "Unable to reach vending controller: connect ECONNREFUSED 127.0.0.1:5000"
}
```

## 3.5. `POST /api/cancel-sale`

Отмена текущей сессии оплаты.

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

**Полный пример ответа:**

```json
{
  "success": true
}
```

**Поля запроса:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `cellNumber` | number | целое `>= 1` | номер ячейки (используется только для валидации) |

**Поля ответа:**

| Поле | Тип | Значения | Описание |
|------|-----|----------|----------|
| `success` | boolean | `true` | отмена выполнена или сессии не было |

Примечание: метод отменяет **текущую** активную сессию,
независимо от значения `cellNumber`.

**Примеры ошибок:**

```json
{
  "message": "Product not found for the provided cellNumber"
}
```

## 3.6. Изображения товаров (для фронта)

Поле `imgPath` в `/api/product-matrix` может содержать:

- абсолютный URL (например, `https://.../image.png`);
- относительный путь или имя файла (например, `images/01.jpg`).

Фронт обычно строит полный URL к статике через `VITE_APP_SNACK_API_URL`
и `VITE_APP_SNACK_MEDIA_PREFIX`.

---

# 3.7. Подробное взаимодействие с фронтом

Ниже описан **полный контракт** между фронтом и backend для purchase flow:
какие запросы делает UI, что ожидает в ответе, какие состояния UI показывать.

## 3.7.1. Базовые правила клиента

- Все запросы идут в JSON, с заголовком `Content-Type: application/json`.
- Ошибки приходят в формате:

```json
{
  "message": "Human readable error text"
}
```

- Ошибка считается на уровне **HTTP-кода** (не `success=false`).
- Фронт должен быть готов к любым `>=400` и отображать сообщение пользователю.

## 3.7.2. Получение матрицы товаров (экран выбора)

**Цель:** загрузить список доступных товаров и отобразить карточки.

**Запрос:**

```text
GET /api/product-matrix
```

**Поток UI:**

1) Показать “Загрузка…”.
2) Выполнить запрос.
3) Успех → построить список товаров, подставить изображения.
4) Ошибка → показать “Не удалось загрузить витрину”.

**Особенности по `imgPath`:**

- Если `imgPath` — URL, можно использовать напрямую.
- Если `imgPath` — имя файла, фронт формирует URL через
  `VITE_APP_SNACK_API_URL` + `VITE_APP_SNACK_MEDIA_PREFIX`.

## 3.7.3. Начало покупки (нажатие “Купить”)

**Цель:** инициировать оплату на ридере и получить `success=true`.

**Запрос:**

```text
POST /api/start-sale
```

```json
{
  "cellNumber": 11
}
```

**Поток UI:**

1) Заблокировать повторные клики по кнопке.
2) Показать “Приложите карту”.
3) Ждать ответ.

**Успех (`200`):**

```json
{
  "success": true
}
```

**Дальше:** немедленно вызвать `POST /api/issue-product`.

**Ошибки (пример):**

- `402` — оплата отклонена (показать “Оплата отклонена”).
- `499` — пользователь отменил/ридер отменил (показать “Оплата отменена”).
- `504` — таймаут (показать “Время ожидания истекло”).
- `409` — уже есть активная сессия (показать “Подождите завершения оплаты”).

## 3.7.4. Выдача товара после оплаты

**Цель:** отправить команду выдачи товара и дождаться подтверждения.

**Запрос:**

```text
POST /api/issue-product
```

```json
{
  "cellNumber": 11
}
```

**Поток UI:**

1) Показать “Выдача товара…”.
2) Ждать ответ.

**Успех (`200`):**

```json
{
  "success": true
}
```

**После успеха:** показать “Заберите товар”.

**Ошибки (пример):**

- `502` — ошибка контроллера автомата (показать “Сбой выдачи”).
- `404` — товар не найден (обычно ошибка витрины/матрицы).

## 3.7.5. Отмена продажи пользователем

**Цель:** отменить текущую сессию оплаты.

**Запрос:**

```text
POST /api/cancel-sale
```

```json
{
  "cellNumber": 11
}
```

**Поток UI:**

1) Показать “Отмена…”.
2) При успехе вернуть пользователя в витрину.

**Ответ:**

```json
{
  "success": true
}
```

## 3.7.6. Рекомендованные UI-состояния

| Состояние UI | Триггер | Действия фронта |
|-------------|---------|-----------------|
| `catalog_loading` | открытие витрины | `GET /api/product-matrix` |
| `catalog_ready` | успех загрузки | показ списка |
| `payment_pending` | `POST /api/start-sale` | ожидание оплаты |
| `payment_approved` | `success=true` | вызвать `/api/issue-product` |
| `vend_pending` | `POST /api/issue-product` | ожидание выдачи |
| `vend_success` | `success=true` | показать “заберите товар” |
| `payment_failed` | `402/499/504` | показать ошибку, дать повтор |
| `vend_failed` | `502` | показать ошибку, сообщить оператору |
| `cancelled` | `POST /api/cancel-sale` | вернуть на витрину |

## 3.7.7. Повторные попытки

- При `402/499/504` допускается повторить `POST /api/start-sale`.
- При `502` (контроллер недоступен) лучше предложить обратиться к оператору.
- Повторный `POST /api/issue-product` **не рекомендуется**, если предыдущий вызов завершился ошибкой:
  риск повторной выдачи товара или рассинхронизации.

## 3.7.8. Таблица: HTTP-коды → UI-сообщения

| Код | Где возникает | Рекомендованное сообщение пользователю | Комментарий для UI |
|-----|--------------|----------------------------------------|--------------------|
| 200 | все методы | “Операция выполнена” | перейти к следующему шагу сценария |
| 400 | `start-sale`, `issue-product`, `cancel-sale` | “Некорректный выбор товара” | проверить `cellNumber`, обновить матрицу |
| 402 | `start-sale` | “Оплата отклонена” | разрешить повтор |
| 404 | `start-sale`, `issue-product`, `cancel-sale` | “Товар не найден” | обновить витрину |
| 409 | `start-sale` | “Подождите завершения текущей оплаты” | не запускать параллельную |
| 499 | `start-sale` | “Оплата отменена” | вернуть в каталог |
| 502 | `issue-product` | “Сбой выдачи. Обратитесь к оператору” | возможен refund |
| 503 | `start-sale` | “Платёжное устройство недоступно” | проверить подключение |
| 504 | `start-sale` | “Время ожидания оплаты истекло” | разрешить повтор |

## 3.7.9. Тайминги и таймауты (рекомендации фронту)

В backend используются:

- `PAYMENT_APPROVAL_TIMEOUT_MS` (по умолчанию 20000 мс) — ожидание оплаты;
- `VENDING_CONTROLLER_REQUEST_TIMEOUT_MS` (по умолчанию 10000 мс) — HTTP к контроллеру.

Рекомендации фронту по таймаутам HTTP:

- `GET /api/product-matrix` — 5–10 сек.
- `POST /api/start-sale` — **25–30 сек**, чтобы не оборвать ожидание оплаты раньше backend.
- `POST /api/issue-product` — 15–20 сек (должно быть больше, чем таймаут контроллера).
- `POST /api/cancel-sale` — 5–10 сек.

Если фронт использует глобальный таймаут (например, в Axios), лучше настраивать
его **выше** серверных таймаутов для `/api/start-sale` и `/api/issue-product`,
чтобы корректно отображать ошибки от backend, а не “клиентский таймаут”.

# 4. Логика контроллера покупки

## 4.1. Валидация товара

`validatePayload(payload)`:

1) проверяет `cellNumber`;
2) запрашивает матрицу у Telemetry API (`/api/matrix`, `/api/catalog`);
3) ищет ячейку в нормализованных данных;
4) бросает `404`, если товар не найден.

## 4.2. Старт продажи

`startSale(payload)`:

1) валидация `cellNumber`;
2) `processPayment({ cellNumber, price, productId })`;
3) при ошибке возвращает HTTP статус из `PaymentError`.

## 4.3. Выдача товара

`issueProduct(payload)`:

1) валидация `cellNumber`;
2) `vendProduct({ channel: cellNumber })` через Vending Controller API;
3) завершает платёж через `finalizePaymentAfterVend`.

## 4.4. Отмена продажи

`cancelSale(payload)`:

1) валидация `cellNumber`;
2) `cancelPayment()` (best-effort);
3) возвращает `{ success: true }`.

---

# 5. Интеграция с Telemetry API

Используется:

- `GET {TELEMETRY_API_BASE_URL}/api/matrix`
- `GET {TELEMETRY_API_BASE_URL}/api/catalog`

Нормализация матрицы:

- фильтр `enabled !== 0`;
- `cellNumber` из `cell_number` или `cellNumber`;
- `productId` из `good_id`/`product_id`;
- `price`: `price` либо `price_minor / 100`;
- `imgPath`: URL или имя файла (последний сегмент пути).

---

# 6. Интеграция с Vending Controller API

Клиент: `vendingControllerClient.js`.

Запрос:

- `POST {VENDING_CONTROLLER_API_URL}/vend/simple`
- тело: `{ "channel": <cellNumber> }` (+ `timeoutMs` при настройке)

Ошибки прокидываются как HTTP 502.

---

# 7. Интеграция с paymentDevice (ридер)

Модуль `paymentDevice.js`:

- загрузка драйвера `mdb-rs232-cashless.mjs`;
- настройка reader config;
- включение Always Idle (если поддерживается);
- управление session state (одна активная сессия).

Основные действия:

| Метод | Назначение |
|-------|------------|
| `processPayment` | старт оплаты и ожидание `vendApproved` |
| `finalizePaymentAfterVend` | успех/неуспех выдачи |
| `cancelPayment` | принудительная отмена |
| `warmupPaymentDevice` | инициализация при старте сервера |

---

# 8. Сценарии (front ↔ back)

## 8.1. Успешная покупка

**Front:**

1) `GET /api/product-matrix` → отобразить товары.  
2) Пользователь выбирает товар.  
3) `POST /api/start-sale` с `cellNumber`.  
4) При `success=true` вызвать `POST /api/issue-product`.

**Back:**

- `start-sale`: валидирует товар → включает ридер → `vendRequest` → ждёт `vendApproved`.  
- `issue-product`: вызывает `/vend/simple` → `vendSuccess` → `sessionComplete` → `readerDisable`.

## 8.2. Отказ или таймаут оплаты

**Front:**

1) `POST /api/start-sale`  
2) Получает ошибку `402/499/504`  
3) Показывает сообщение пользователю (оплата не прошла/отменена)

**Back:**

- `vendDenied`/`cancelled`/таймаут  
- выполняет cleanup: `vendCancel` → `sessionComplete` → `readerDisable`.

## 8.3. Отмена пользователем

**Front:**

1) Пользователь нажимает “Отменить”  
2) `POST /api/cancel-sale`

**Back:**

- `cancelPayment`: `vendCancel` → `sessionComplete` → `readerDisable`.

## 8.4. Ошибка выдачи товара

**Front:**

1) `POST /api/start-sale` → `success=true`  
2) `POST /api/issue-product` → ошибка `502`  
3) Показывает сообщение: выдача не удалась (возможен возврат)

**Back:**

- `issue-product` получает ошибку от контроллера  
- вызывает `finalizePaymentAfterVend({ success: false })`  
- при поддержке ридером инициирует refund.

## 8.5. Рекомендации для UI фронта

### Состояния экрана

1) **Выбор товара**  
   - Показать матрицу (`GET /api/product-matrix`).
2) **Ожидание оплаты**  
   - После `POST /api/start-sale`, блокировать повторные нажатия.
3) **Оплата подтверждена**  
   - Немедленно вызвать `POST /api/issue-product`.
4) **Выдача товара**  
   - Показать “выдача…” до ответа `issue-product`.
5) **Успех**  
   - Сообщение “заберите товар”.
6) **Ошибка оплаты**  
   - Сообщение об отказе/таймауте, возможность повторить.
7) **Ошибка выдачи**  
   - Сообщение о сбое выдачи, возможен возврат (если поддерживается).
8) **Отмена**  
   - После `POST /api/cancel-sale` вернуть на экран выбора.

### Рекомендации по повторным попыткам

- При `402/499/504` показывать кнопку “Повторить оплату”.
- При `502` (контроллер недоступен) рекомендовать обратиться к оператору.

## 8.6. Схема экранов (front flow)

```text
[Выбор товара]
      |
      v
[Ожидание оплаты] --(ошибка 402/499/504)--> [Оплата не прошла]
      |                                        |
      | (success=true)                         | (повтор)
      v                                        v
[Выдача товара] --(ошибка 502)--> [Сбой выдачи]
      |
      v
[Успех: заберите товар]
```

---

# 9. Конфигурация (Linux)

## 9.1. Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `PORT` | `4000` | HTTP порт |
| `ALLOWED_ORIGIN` | `*` | CORS |
| `STATIC_ROUTE_PREFIX` | `/media` | URL префикс статики |
| `STATIC_MEDIA_ROOT` | `../../SnackMedia` | директория медиа |
| `TELEMETRY_API_BASE_URL` | `http://localhost:3002` | Telemetry API |
| `VENDING_CONTROLLER_API_URL` | `http://127.0.0.1:5000/api/v1` | Controller API |
| `VENDING_CONTROLLER_REQUEST_TIMEOUT_MS` | `10000` | timeout запросов |
| `VENDING_CONTROLLER_VEND_TIMEOUT_MS` | *(нет)* | timeout для `/vend/simple` |
| `PAYMENT_PORT_PATH` | `/dev/ttyS4` | RS-232 порт ридера |
| `PAYMENT_BAUD_RATE` | `9600` | скорость порта |
| `PAYMENT_CASHLESS_NUMBER` | `1` | cashless #1 или #2 |
| `PAYMENT_APPROVAL_TIMEOUT_MS` | `20000` | ожидание оплаты |
| `PAYMENT_SESSION_TTL_MS` | `60000` | TTL сессии |
| `PAYMENT_READER_ENABLE_DELAY_MS` | `200` | задержка после `readerEnable` |
| `PAYMENT_DEVICE_DEBUG` | `false` | debug логирование |

---

# 10. Логи и диагностика

Примеры ключевых событий:

- `client.startSale`, `client.issueProduct`, `client.cancelSale`
- `payment.hardware.opened`
- `payment.hardware.approved`
- `payment.hardware.vendSuccess`
- `payment.hardware.vendFailure`
- `payment.hardware.readerDisable.warn`
- `payment.hardware.finalize.error`
