Документация по модулю **Telemetry**.

---

# 1. Общее описание

Telemetry — подсистема, которая:

- хранит локальное состояние автомата в SQLite (`Telemetry/goods.db`);
- синхронизирует каталог, матрицу, остатки и продажи с удалённой телеметрией по WebSocket;
- поднимает локальный HTTP API для других компонентов (backend, сервисное меню, утилиты);
- скачивает и кэширует изображения товаров;
- содержит набор CLI-скриптов для ручной синхронизации и диагностики.

Ключевые файлы:

- `Telemetry/new/telemetry-api.mjs` — HTTP API сервис (Express).
- `Telemetry/new/telemetry-core.mjs` — бизнес-логика и работа с БД.
- `Telemetry/new/telemetry-ws-gateway.mjs` — OAuth2 + WebSocket транспорт.
- `Telemetry/new/telemetry-config.mjs` — конфигурация (ENV + дефолты).
- `Telemetry/shaker-db.mjs` — библиотека работы с SQLite для CLI-скриптов.
- `Telemetry/catalog/*`, `Telemetry/matrix/*`, `Telemetry/cellstore_*/*`, `Telemetry/volume/*`, `Telemetry/payments/*` — CLI утилиты.
- `Telemetry/shaker-telemetry-client.mjs` — автономный WS-клиент (legacy/standalone).

---

# 2. Архитектура и потоки данных (ASCII-схемы)

## 2.1. Общий обзор

```
+---------+   HTTP   +--------------------+
|Frontend | -------> |Telemetry HTTP API |
+---------+          |(telemetry-api.mjs)|
                     +---------+----------+
                               |
                               v
                     +--------------------+
                     |TelemetryCore       |
                     |(telemetry-core.mjs)|
                     +----+-----------+---+
                          |           |
                          v           v
                    +---------+  +----------------+
                    |SQLite DB|  |Telemetry WS GW |
                    |goods.db |  |(ws-gateway)    |
                    +---------+  +-------+--------+
                                         |
                                         v
                                  +---------------+
                                  |Remote Telemetry|
                                  +---------------+
```

## 2.2. Синхронизация каталога

```
Request : [Core] -> [WS GW] -> [Remote] (baseProductRequestExportTopic)
Response: [Remote] -> [WS GW] -> [Core] (ACK + DATA items[])
Apply   : [Core] -> [SQLite] (catalog_brand, catalog_product, catalog_sync_state)
```

## 2.3. Синхронизация матрицы (полная)

```
Request : [Core] -> [WS GW] -> [Remote] (matrixImportTopicSnack)
Response: [Remote] -> [WS GW] -> [Core] (ACK + snackTopicRes)
Source  : [Core] reads vw_matrix_cell_full to build payload
```

## 2.4. Частичное обновление ячеек (cellStore)

```
Request : [Core] -> [WS GW] -> [Remote] (cellStoreImportTopicSnack)
Response: [Remote] -> [WS GW] -> [Core] (ACK + snackTopicRes)
Apply   : [Core] -> [SQLite] (matrix_cell_config, matrix_cell_state)
```

## 2.5. Отправка остатков (volume)

```
Request : [Core] -> [WS GW] -> [Remote] (cellVolumeImportTopicSnack)
Response: [Remote] -> [WS GW] -> [Core] (ACK + cellVolumeExportSnack)
Apply   : [Core] -> [SQLite] (matrix_cell_state)
```

## 2.6. Продажи

```
Request : [Core] -> [WS GW] -> [Remote] (saleImportTopicSnack)
Response: [Remote] -> [WS GW] -> [Core] (ACK)
Apply   : [Core] -> [SQLite] (matrix_sale_log; triggers update volume)
```

Примечание: диаграммы рассчитаны на моноширинный шрифт. При пропорциональном тексте выравнивание может смещаться.

---

# 3. Конфигурация (ENV)

Из `Telemetry/new/telemetry-config.mjs`:

- `TELEMETRY_HTTP_PORT` — порт HTTP API (по умолчанию `3002`).
- `TELEMETRY_OAUTH_URL` — OAuth2 endpoint.
- `TELEMETRY_WS_URL` — WebSocket URL телеметрии.
- `TELEMETRY_CLIENT_ID` — идентификатор автомата (обычно серийный номер).
- `TELEMETRY_CLIENT_SECRET` — секрет клиента.
- `TELEMETRY_DB_PATH` — путь к SQLite БД (`Telemetry/goods.db` по умолчанию).
- `TELEMETRY_PRODUCT_IMAGES_DIR` — директория локальных изображений товаров (`<repo>/SnackMedia`).
- `MACHINE_CELLS_COUNT` — количество ячеек автомата (по умолчанию `60`).

CLI-скрипты используют свои переменные (см. раздел 11), чаще всего:

- `SHAKER_CLIENT_ID`, `SHAKER_CLIENT_SECRET`, `SHAKER_MACHINE_ID`, `SHAKER_ORG_ID`
- `SHAKER_WS_URL`, `SHAKER_TOKEN_URL`

---

# 4. Запуск HTTP API

```bash
node Telemetry/new/telemetry-api.mjs
```

При старте:

- создаётся/обновляется схема БД на основе `productsdb.sql` и `matrix.sql`;
- при пустом каталоге выполняется авто-синхронизация;
- запускается авто-подключение по WS;
- при каждом новом подключении синхронизируются каталог и матрица.

---

# 5. WebSocket протокол телеметрии

## 5.1. Общий формат

Исходящее:
```json
{
  "clientId": "snack_02",
  "type": "baseProductRequestExportTopic",
  "body": { "machineId": 12, "organizationId": 54 }
}
```

Входящее:
```json
{
  "type": "baseProductRequestExportTopic",
  "success": true,
  "message": "",
  "body": null
}
```

или:
```json
{
  "type": "snackTopicRes",
  "body": {
    "requestUuid": "REQ-...",
    "success": true,
    "updatedCells": [],
    "errors": null
  }
}
```

## 5.2. Типы сообщений

- `machineInfo` — паспорт автомата (однофазный).
- `baseProductRequestExportTopic` — каталог (двухфазный, ACK + DATA, одинаковый type).
- `matrixImportTopicSnack` — матрица (ACK + результат `snackTopicRes`).
- `cellStoreImportTopicSnack` — частичное обновление (ACK + `snackTopicRes`).
- `cellVolumeImportTopicSnack` — остатки (ACK + `cellVolumeExportSnack`).
- `saleImportTopicSnack` — продажа (однофазный ACK).

Push от сервера:

- `cellStoreExportSnack` / `matrixExportTopicSnack` — обновление матрицы (push).
- `cellVolumeExportSnack` — push остатков.

`TelemetryWsGateway` берёт на себя:

- OAuth2 client_credentials;
- установку и поддержание WS соединения;
- сопоставление ACK и RESULT (по type и `requestUuid`);
- таймауты и reconnection.

---

# 6. HTTP API

Базовый адрес: `http://localhost:3002`

## 6.1. Каталог

### `POST /api/telemetry/catalog/sync`

**Назначение:** синхронизировать каталог.

**Пример запроса:**
```bash
curl -X POST http://localhost:3002/api/telemetry/catalog/sync
```

**Типичные коды:** `200` (успех), `502` (ACK/результат от телеметрии с ошибкой), `500` (внутренняя ошибка).

**Ответ (успех):**
```json
{
  "success": true,
  "message": "Catalog synced successfully",
  "ack": { "type": "baseProductRequestExportTopic", "success": true, "body": null },
  "result": { "type": "baseProductRequestExportTopic", "body": [ ... ] },
  "meta": { "itemCount": 120 }
}
```

**Ответ (ошибка, пример):**
```json
{
  "success": false,
  "message": "Catalog ACK failed",
  "ack": { "type": "baseProductRequestExportTopic", "success": false, "message": "Denied" },
  "result": null
}
```

### `GET /api/catalog`

**Назначение:** получить локальный каталог.

**Ответ:** массив строк из `vw_catalog_product_full`.

**Пример ответа (1 элемент):**
```json
[
  {
    "id": 22,
    "taste": "Шоколад",
    "img_url": "/path/to/SnackMedia/22.jpg",
    "is_adult": 0,
    "price_minor": 15000,
    "vendor_code": "SNACK-22",
    "calories": 230,
    "proteins": 8,
    "fats": 12,
    "carbohydrates": 20,
    "compound": "молоко, какао",
    "allergens": "молоко",
    "description": "Описание товара",
    "brand_id": 7,
    "brand_name": "Shaker",
    "updated_at": 1700000000000
  }
]
```

**Пример запроса (curl):**
```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/cells \
  -H "Content-Type: application/json" \
  -d '[{"cellNumber":12,"rowNumber":2,"price":150,"goodId":"22","size":1,"volume":5,"maxVolume":10,"isActive":true}]'
```

**Пример ответа (успех):**
```json
{
  "success": true,
  "message": "Cell store synced successfully",
  "ack": { "type": "cellStoreImportTopicSnack", "success": true, "body": null },
  "result": {
    "type": "snackTopicRes",
    "body": { "requestUuid": "REQ-1700000000000-abc", "success": true }
  }
}
```

**Пример ответа (ошибка валидации):**
```json
{
  "success": false,
  "message": "Body must be an array of cells"
}
```

---

## 6.2. Матрица

### `POST /api/telemetry/matrix/sync`

**Назначение:** отправить текущую матрицу в телеметрию.

**Пример запроса:**
```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/sync
```

**Пример ответа (успех):**
```json
{
  "success": true,
  "message": "Matrix synced successfully",
  "ack": { "type": "matrixImportTopicSnack", "success": true, "body": null },
  "result": {
    "type": "snackTopicRes",
    "body": { "requestUuid": "REQ-1700000000000-abc", "success": true }
  }
}
```

**Пример ответа (ошибка, пример):**
```json
{
  "success": false,
  "message": "Matrix result is empty or has unexpected type",
  "ack": { "type": "matrixImportTopicSnack", "success": true, "body": null },
  "result": null
}
```

### `GET /api/matrix`

**Назначение:** получить локальную матрицу.

**Ответ:** массив строк из `vw_matrix_cell_full`.

**Пример ответа (1 элемент):**
```json
[
  {
    "cell_number": 1,
    "row_number": 1,
    "size": 1,
    "good_id": 22,
    "product_name": "Шоколад",
    "product_img": "/path/to/SnackMedia/22.jpg",
    "product_is_adult": 0,
    "price_minor": 15000,
    "volume": 5,
    "max_volume": 10,
    "enabled": 1,
    "cfg_updated_at": 1700000000000,
    "state_updated_at": 1700000000000
  }
]
```

---

## 6.3. Частичное обновление ячеек

### `POST /api/telemetry/matrix/cells`

**Назначение:** частичное обновление ячеек.

**Тело:** массив ячеек.

Минимум:
```json
[{ "cellNumber": 1 }]
```

Рекомендуемые поля:
```json
[
  {
    "cellNumber": 12,
    "rowNumber": 2,
    "price": 150.0,
    "goodId": "22",
    "size": 1,
    "volume": 5,
    "maxVolume": 10,
    "isActive": true
  }
]
```

---

## 6.4. Остатки

### `POST /api/telemetry/matrix/volumes`

**Назначение:** отправить остатки ячеек.

**Тело:**
```json
[
  { "cellNumber": 1, "volume": 5 },
  { "cellNumber": 2, "volume": 0 }
]
```

**Пример ответа (успех):**
```json
{
  "success": true,
  "message": "Cell volumes synced successfully",
  "ack": { "type": "cellVolumeImportTopicSnack", "success": true, "body": null },
  "result": {
    "type": "cellVolumeExportSnack",
    "body": [ { "cellNumber": 1, "volume": 5 }, { "cellNumber": 2, "volume": 0 } ]
  }
}
```

---

## 6.5. Продажи

### `POST /api/telemetry/sales`

**Назначение:** отправить продажу и записать в локальный журнал.

**Обязательные поля:**

- `machineId`
- `machineModelId`
- `orgId`
- `serialNumber`
- `totalPrice`
- `price`
- `dateSale`
- `volume`
- `machineTimezone`
- `goodId`
- `brandId`
- `writeOffs` (array)
- `payments` (array)

**Пример:**
```json
{
  "machineId": 12,
  "machineModelId": 1,
  "orgId": 54,
  "serialNumber": "snack_02",
  "totalPrice": 150.0,
  "price": 150.0,
  "dateSale": "2026-02-02T12:00:00Z",
  "volume": 1,
  "machineTimezone": "+03:00",
  "goodId": 22,
  "brandId": 7,
  "writeOffs": [
    { "cellNumber": 3, "productId": 22 }
  ],
  "payments": [
    { "price": 150.0, "method": "card" }
  ]
}
```

**Пример ответа (успех):**
```json
{
  "success": true,
  "message": "Sale sent successfully",
  "ack": { "type": "saleImportTopicSnack", "success": true, "body": null },
  "result": null
}
```

**Пример ответа (ошибка):**
```json
{
  "success": false,
  "message": "Missing required field: machineId"
}
```

---

## 6.6. Machine Info

### `POST /api/telemetry/machine-info/sync`

**Назначение:** получить и сохранить паспорт автомата.

**Пример ответа (успех):**
```json
{
  "success": true,
  "message": "Machine info synced successfully",
  "machineInfo": {
    "machineId": 12,
    "organizationId": 54,
    "modelId": 1,
    "serialNumber": "snack_02"
  }
}
```

---

# 7. SQLite схема (сводка)

## 7.1. Каталог

Таблицы:

- `catalog_sync_state`
- `catalog_brand`
- `catalog_product`

View:

- `vw_catalog_product_full`

## 7.2. Матрица

Таблицы:

- `matrix_sync_state`
- `matrix_cell_config`
- `matrix_cell_state`

View:

- `vw_matrix_cell_full`

## 7.3. Журналы

- `matrix_sale_log`
- `matrix_refill_log`

Триггеры:

- `trg_sale_apply` — уменьшает `volume`.
- `trg_refill_apply` — увеличивает `volume`.

## 7.4. Детализация таблиц и представлений

### 7.4.1. catalog_sync_state

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | Всегда `1` (singleton). |
| `last_sync_ts` | INTEGER | Время последней синхронизации (unix ms). |
| `source_hash` | TEXT | Опциональный hash/etag каталога. |

### 7.4.2. catalog_brand

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | ID бренда (с телеметрии). |
| `name` | TEXT | Название бренда. |

### 7.4.3. catalog_product

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | ID товара (с телеметрии). |
| `brand_id` | INTEGER | FK на `catalog_brand.id`. |
| `taste` | TEXT | Краткое имя/вкус. |
| `img_url` | TEXT | URL изображения или локальный путь. |
| `is_adult` | INTEGER | 0/1. |
| `price_minor` | REAL | Цена в минимальных единицах (копейки). |
| `vendor_code` | TEXT | Артикул. |
| `calories` | REAL | Ккал/100г. |
| `proteins` | REAL | Белки/100г. |
| `fats` | REAL | Жиры/100г. |
| `carbohydrates` | REAL | Углеводы/100г. |
| `compound` | TEXT | Состав. |
| `allergens` | TEXT | Аллергены. |
| `description` | TEXT | Описание. |
| `updated_at` | INTEGER | Обновление записи (unix ms). |

**Особенности:**
- `price_minor` может быть `NULL` — тогда цена берётся из матрицы (`matrix_cell_config.price_minor`).
- `updated_at` поддерживается триггерами (`trg_catalog_product_updated_at*`).

### 7.4.4. matrix_sync_state

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | Всегда `1`. |
| `last_sync_ts` | INTEGER | Время последней синхронизации (unix ms). |
| `source_hash` | TEXT | Hash/etag матрицы. |
| `matrix_version` | INTEGER | Версия матрицы (если используется). |

### 7.4.5. matrix_cell_config

| Поле | Тип | Описание |
| --- | --- | --- |
| `cell_number` | INTEGER | Номер ячейки (PK). |
| `row_number` | INTEGER | Номер ряда. |
| `size` | INTEGER | 0/1/2 = одиночная/двойная/тройная. |
| `good_id` | INTEGER | FK на `catalog_product.id`. |
| `price_minor` | REAL | Цена в копейках; если `NULL` — взять из товара. |
| `enabled` | INTEGER | 0/1. |
| `updated_at` | INTEGER | Обновление записи (unix ms). |

**Особенности:**
- В `shaker-db.mjs` при построении payload `size` конвертируется в 1/2/3 (`size + 1`).

### 7.4.6. matrix_cell_state

| Поле | Тип | Описание |
| --- | --- | --- |
| `cell_number` | INTEGER | FK на `matrix_cell_config.cell_number`. |
| `volume` | INTEGER | Текущий остаток. |
| `max_volume` | INTEGER | Максимальный остаток. |
| `last_refill_ts` | INTEGER | Время последнего пополнения (unix ms). |
| `updated_at` | INTEGER | Обновление записи (unix ms). |

### 7.4.7. matrix_refill_log

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | PK (autoincrement). |
| `ts` | INTEGER | Время события (unix ms). |
| `cell_number` | INTEGER | Ячейка. |
| `qty` | INTEGER | Кол-во добавленного товара. |
| `actor` | TEXT | Кто/что инициировал. |
| `note` | TEXT | Комментарий. |

### 7.4.8. matrix_sale_log

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | INTEGER | PK (autoincrement). |
| `ts` | INTEGER | Время продажи (unix ms). |
| `cell_number` | INTEGER | Ячейка. |
| `qty` | INTEGER | Кол-во (обычно 1). |
| `good_id` | INTEGER | Товар на момент продажи. |
| `price_minor` | REAL | Цена на момент продажи (копейки). |
| `payment_ref` | TEXT | Ссылка/UUID платежа. |
| `note` | TEXT | Комментарий. |

### 7.4.9. vw_catalog_product_full

Проекция каталога с брендом:

| Поле | Источник |
| --- | --- |
| `id` | `catalog_product.id` |
| `taste` | `catalog_product.taste` |
| `img_url` | `catalog_product.img_url` |
| `is_adult` | `catalog_product.is_adult` |
| `price_minor` | `catalog_product.price_minor` |
| `vendor_code` | `catalog_product.vendor_code` |
| `calories`, `proteins`, `fats`, `carbohydrates` | `catalog_product` |
| `compound`, `allergens`, `description` | `catalog_product` |
| `brand_id`, `brand_name` | `catalog_brand` |
| `updated_at` | `catalog_product.updated_at` |

### 7.4.10. vw_matrix_cell_full

Проекция матрицы с остатками и товаром:

| Поле | Источник |
| --- | --- |
| `cell_number`, `row_number`, `size`, `good_id`, `enabled`, `cfg_updated_at` | `matrix_cell_config` |
| `product_name`, `product_img`, `product_is_adult` | `catalog_product` |
| `price_minor` | `COALESCE(matrix_cell_config.price_minor, catalog_product.price_minor)` |
| `volume`, `max_volume`, `state_updated_at` | `matrix_cell_state` |

---

# 8. Картинки товаров

- При включённой директории изображений (`TELEMETRY_PRODUCT_IMAGES_DIR`) TelemetryCore скачивает картинки каталога.
- Имена файлов: `<productId>.<ext>`.
- При чтении каталога/матрицы пути `img_url`/`product_img` могут заменяться на локальные.

---

# 9. Особенности форматов (важно)

1) **Разный формат `machineId`**

- `matrixImportTopicSnack` отправляет числовой `machineId`.
- `cellStoreImportTopicSnack` и `cellVolumeImportTopicSnack` отправляют строку вида `MACHINE_ID_<id>`.

2) **Единицы цены**

- В `TelemetryCore` цена конвертируется из `price_minor` в рубли (деление на 100).
- В части CLI-скриптов (`cellstore_send/telemetry-payload.mjs`) цена передаётся как `price_minor` без конвертации.

Это нужно учитывать при смешанном использовании.

---

# 10. Соответствия WS topic ↔ БД

| WS topic | Направление | Действие в коде | Таблицы/представления |
| --- | --- | --- | --- |
| `machineInfo` | request/ack | `ensureMachineInfo()` → `saveMachineInfo()` | `machine_info` |
| `baseProductRequestExportTopic` | request + data | `syncCatalog()` → `applyCatalog()` | `catalog_brand`, `catalog_product`, `catalog_sync_state`, `vw_catalog_product_full` |
| `matrixImportTopicSnack` | request | `buildMatrixPayload()` (только чтение) | `vw_matrix_cell_full` (из `matrix_cell_config`, `matrix_cell_state`, `catalog_product`) |
| `cellStoreImportTopicSnack` | request + result | `syncCellsPartial()` → `applyMatrixCellsFromServer()` | `matrix_cell_config`, `matrix_cell_state`, `matrix_sync_state` |
| `cellStoreExportSnack` | push | `handleIncomingPush()` → `applyMatrixCellsFromServer()` | `matrix_cell_config`, `matrix_cell_state`, `matrix_sync_state` |
| `matrixExportTopicSnack` | push | `handleIncomingPush()` → `applyMatrixCellsFromServer()` | `matrix_cell_config`, `matrix_cell_state`, `matrix_sync_state` |
| `cellVolumeImportTopicSnack` | request + result | `syncCellVolumes()` → `applyCellVolumesFromServer()` | `matrix_cell_state` |
| `cellVolumeExportSnack` | push | `handleIncomingPush()` → `applyCellVolumesFromServer()` | `matrix_cell_state` |
| `saleImportTopicSnack` | request/ack | `sendSaleDirect()` → `logSaleFromTelemetry()` | `matrix_sale_log` (триггер обновляет `matrix_cell_state.volume`) |

Примечания:

- `matrix_sync_state.last_sync_ts` обновляется при применении входящих данных матрицы.
- `catalog_sync_state.last_sync_ts` обновляется при загрузке каталога.

---

# 11. CLI-утилиты

## 11.1. Каталог

- `Telemetry/catalog/sync-catalog.mjs` — загрузка каталога по WS.

## 11.2. Матрица

- `Telemetry/matrix/sync-matrix.mjs` — отправка матрицы по WS.

## 11.3. CellStore

- `Telemetry/cellstore_send/telemetry-payload.mjs` — построение JSON.
- `Telemetry/cellstore_send/send-cellstore-cli.mjs` — отправка JSON + ожидание ACK.
- `Telemetry/cellstore_get/sync-cellstore-ws.mjs` — слушает push и применяет к БД.

## 11.4. Остатки

- `Telemetry/volume/sync-volume.mjs` — отправка остатков.

## 11.5. Продажи

- `Telemetry/payments/sync-payments.mjs` — отправка продаж.

## 11.6. Картинки

- `Telemetry/downloadProductImages.mjs` — загрузка изображений.

---

## 11.7. Примеры запуска CLI

Каталог (полная синхронизация, получение machineInfo + каталог):
```bash
export SHAKER_CLIENT_ID=snack_02
export SHAKER_CLIENT_SECRET=...
export SHAKER_MACHINE_ID=12
export SHAKER_ORG_ID=54
node Telemetry/catalog/sync-catalog.mjs /path/to/Telemetry/goods.db
```

Матрица (отправка в телеметрию):
```bash
export SHAKER_CLIENT_ID=snack_02
export SHAKER_CLIENT_SECRET=...
export SHAKER_MACHINE_ID=MACHINE_ID_001
node Telemetry/matrix/sync-matrix.mjs /path/to/Telemetry/goods.db
```

CellStore (формирование payload + отправка):
```bash
export SHAKER_CLIENT_ID=snack_02
export SHAKER_CLIENT_SECRET=...
export SHAKER_MACHINE_ID=MACHINE_ID_001
node Telemetry/cellstore_send/send-cellstore-cli.mjs /path/to/Telemetry/goods.db
# только выбранные ячейки:
node Telemetry/cellstore_send/send-cellstore-cli.mjs /path/to/Telemetry/goods.db --cells 1,2,10
```

CellStore (приём push-обновлений):
```bash
export CLIENT_ID=snack_02
export CLIENT_SECRET=...
node Telemetry/cellstore_get/sync-cellstore-ws.mjs /path/to/Telemetry/goods.db
```

Остатки (volume):
```bash
export SHAKER_CLIENT_ID=snack_02
export SHAKER_CLIENT_SECRET=...
export SHAKER_MACHINE_ID=MACHINE_ID_001
node Telemetry/volume/sync-volume.mjs /path/to/Telemetry/goods.db
# только выбранные ячейки:
node Telemetry/volume/sync-volume.mjs /path/to/Telemetry/goods.db 1 2 3
```

Продажи:
```bash
export SHAKER_CLIENT_ID=snack_02
export SHAKER_CLIENT_SECRET=...
export SHAKER_MACHINE_ID=12
export SHAKER_ORG_ID=54
export SHAKER_MACHINE_MODEL_ID=1
node Telemetry/payments/sync-payments.mjs /path/to/Telemetry/goods.db
```

Скачивание изображений:
```bash
node Telemetry/downloadProductImages.mjs /path/to/Telemetry/goods.db /path/to/images
```

---

# 12. Примеры API (расширенные)

## 12.1. Каталог — пустые данные

```bash
curl http://localhost:3002/api/catalog
```

```json
[]
```

## 12.2. Каталог — таймаут WS при синхронизации

```bash
curl -X POST http://localhost:3002/api/telemetry/catalog/sync
```

```json
{
  "success": false,
  "message": "No ACK for catalog",
  "ack": null,
  "result": null
}
```

## 12.3. Матрица — пустые данные

```bash
curl http://localhost:3002/api/matrix
```

```json
[]
```

## 12.4. Матрица — таймаут WS

```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/sync
```

```json
{
  "success": false,
  "message": "No ACK for matrix",
  "ack": null,
  "result": null
}
```

## 12.5. Частичное обновление ячеек — ошибка валидации

```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/cells \
  -H "Content-Type: application/json" \
  -d '[{\"cellNumber\":\"12\"}]'
```

```json
{
  "success": false,
  "message": "Each cell must have numeric cellNumber"
}
```

## 12.6. Остатки — отрицательный volume

```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/volumes \
  -H "Content-Type: application/json" \
  -d '[{\"cellNumber\":1,\"volume\":-1}]'
```

```json
{
  "success": false,
  "message": "Each volume item must have non-negative numeric volume"
}
```

## 12.7. Продажа — отсутствуют writeOffs/payments

```bash
curl -X POST http://localhost:3002/api/telemetry/sales \
  -H "Content-Type: application/json" \
  -d '{\"machineId\":12,\"machineModelId\":1,\"orgId\":54,\"serialNumber\":\"snack_02\",\"totalPrice\":150,\"price\":150,\"dateSale\":\"2026-02-02T12:00:00Z\",\"volume\":1,\"machineTimezone\":\"+03:00\",\"goodId\":22,\"brandId\":7}'
```

```json
{
  "success": false,
  "message": "Field \"writeOffs\" must be a non-empty array"
}
```

## 12.8. Machine Info — сервер телеметрии недоступен

```bash
curl -X POST http://localhost:3002/api/telemetry/machine-info/sync
```

```json
{
  "success": false,
  "message": "Internal server error during machine info sync"
}
```

---

# 13. Кейсы (сценарии)

## 13.1. Первичный запуск с пустой БД

**Условия:** `goods.db` отсутствует или пустой каталог.

**Шаги:**
1) Запуск `Telemetry/new/telemetry-api.mjs`.
2) `TelemetryDb.bootstrapSchemaAndMatrix()` применяет `productsdb.sql` и `matrix.sql`.
3) `TelemetryCore.handlePostBootstrap()` вызывает `syncCatalog()` при пустом каталоге.

**Ожидаемо:**
- схемы БД создаются;
- `catalog_sync_state.last_sync_ts` обновляется при успешной синхронизации;
- `GET /api/catalog` начинает возвращать данные (если WS доступен).

## 13.2. Телеметрия недоступна при старте

**Условия:** WS сервер недоступен.

**Шаги:**
1) Запуск HTTP API.
2) `TelemetryWsGateway` пытается подключиться, уходит в backoff.

**Ожидаемо:**
- HTTP API работает на локальных данных;
- вызовы `POST /api/telemetry/*/sync` возвращают ошибки (ACK отсутствует);
- при восстановлении сети авто-подключение возобновляет синхронизацию.

## 13.3. Изменение цены/товара через сервисное меню

**Шаги:**
1) UI отправляет `POST /api/telemetry/matrix/cells` с `cellNumber`, `price`, `goodId`.
2) Telemetry отправляет `cellStoreImportTopicSnack`.
3) После `snackTopicRes` обновляет локальную БД.

**Ожидаемо:**
- строка в `matrix_cell_config` обновлена;
- `GET /api/matrix` возвращает новую цену/товар.

## 13.4. Push-обновление матрицы от телеметрии

**Шаги:**
1) Сервер телеметрии отправляет `cellStoreExportSnack` или `matrixExportTopicSnack`.
2) `handleIncomingPush()` применяет изменения в БД.

**Ожидаемо:**
- `matrix_cell_config` и `matrix_cell_state` обновлены;
- последующие `GET /api/matrix` отражают новые значения.

## 13.5. Продажа и списание остатков

**Шаги:**
1) Отправка `POST /api/telemetry/sales` с `writeOffs`.
2) `sendSaleDirect()` отправляет `saleImportTopicSnack`.
3) При ACK запись пишется в `matrix_sale_log`.

**Ожидаемо:**
- триггер `trg_sale_apply` уменьшает `matrix_cell_state.volume`;
- событие фиксируется в журнале продаж.

## 13.6. Объединённые ячейки (merged cells)

**Шаги:**
1) В БД ячейки имеют `size <= 0` или `merged_to != cell_number`.
2) `filterMasterCells()` исключает “slave”-ячейки при формировании payload.

**Ожидаемо:**
- в телеметрию уходят только master-ячейки;
- локально сохраняется полная информация о связи ячеек.

## 13.7. Картинки товаров

**Шаги:**
1) `syncCatalog()` получает товары с `img_url`.
2) `downloadProductImages()` скачивает картинки в `<id>.<ext>`.
3) `mapRowsWithLocalImages()` подменяет пути в выдаче каталога/матрицы.

**Ожидаемо:**
- при наличии локальных файлов `img_url`/`product_img` указывает на локальный путь;
- при ошибке скачивания сервис продолжает работу, логируя проблему.

## 13.8. Кейс для оператора (ежедневная проверка и пополнение)

**Цель:** убедиться, что матрица и остатки актуальны.

**Шаги:**
1) `GET /api/matrix` — проверить остатки и активность ячеек.
2) При необходимости отправить `POST /api/telemetry/matrix/volumes` для актуализации объёмов.
3) При необходимости изменить товар/цену: `POST /api/telemetry/matrix/cells`.

**Ожидаемо:**
- обновлённые значения отражаются в `GET /api/matrix`;
- ошибки валидации возвращаются сразу на API (HTTP 400).

## 13.9. Кейс для инженера (диагностика синхронизации)

**Цель:** проверить работу каналов синхронизации и доступность телеметрии.

**Шаги:**
1) `POST /api/telemetry/catalog/sync` — проверка каталога (ACK + DATA).
2) `POST /api/telemetry/matrix/sync` — проверка отправки матрицы (ACK + snackTopicRes).
3) Проверить push-обновления (cellStoreExportSnack) через `sync-cellstore-ws.mjs`.

**Ожидаемо:**
- все этапы возвращают `success: true`;
- в случае сбоя видно, на каком шаге пропал ACK/RESULT;
- локальная БД синхронизируется с сервером телеметрии.

---

# 14. Быстрые примеры

## 14.1. Запрос матрицы

```bash
curl http://localhost:3002/api/matrix
```

## 14.2. Синхронизация каталога

```bash
curl -X POST http://localhost:3002/api/telemetry/catalog/sync
```

## 14.3. Отправка остатков

```bash
curl -X POST http://localhost:3002/api/telemetry/matrix/volumes \
  -H "Content-Type: application/json" \
  -d '[{"cellNumber":1,"volume":5},{"cellNumber":2,"volume":0}]'
```
