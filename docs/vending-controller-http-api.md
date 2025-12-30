Документация по модулю **`vending-http-api.mjs`**.

---

# 1. Общее описание

`vending-http-api.mjs` — это HTTP-обёртка над модулем `vending-controller.mjs`.

Он:

* открывает RS-232/UART порт;
* создаёт экземпляр `VendingController`;
* поднимает HTTP-сервер (Express);
* предоставляет **REST-эндпоинты** для всех команд контроллера автомата.

Использование:

* как отдельный сервис (например, под **pm2**);
* как импортируемый модуль из другого Node.js приложения.

---

# 2. Базовые параметры сервиса

По умолчанию:

* **Базовый URL (base path)**: `/api/v1`
* **Порт HTTP**: `5000`
* **UART**: `/dev/ttyUSB0` (можно переопределить)
* **Скорость UART**: `9600`

Если запускаем **напрямую**:

```bash
node vending-http-api.mjs /dev/ttyUSB0 5000
```

Или через **переменные окружения** (рекомендуется для pm2):

* `VENDING_PORT_PATH` — UART-порт (например, `/dev/ttyUSB0`, `COM3`) — **обязательно**
* `VENDING_HTTP_PORT` — HTTP-порт (по умолчанию `5000`)
* `VENDING_BAUD_RATE` — скорость порта (по умолчанию `9600`)
* `VENDING_BASE_PATH` — базовый путь API (по умолчанию `/api/v1`)
* `VENDING_EMULATOR` — включить эмуляцию контроллера (`true`/`false`, по умолчанию `false`)

Эмуляцию можно включить так:

```bash
VENDING_EMULATOR=1 node vending-http-api.mjs
# или
node vending-http-api.mjs --emulator
```

Для переключения в рантайме доступны эндпоинты:

* `GET {basePath}/emulation/controller` → `{ "success": true, "data": { "enabled": boolean } }`
* `POST {basePath}/emulation/controller` с `{ "enabled": boolean }`

Пример для pm2:

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'vending-http-api',
      script: './vending-http-api.mjs',
      interpreter: 'node',
      env: {
        VENDING_PORT_PATH: '/dev/ttyUSB0',
        VENDING_HTTP_PORT: 5000,
        VENDING_BAUD_RATE: 9600,
        VENDING_BASE_PATH: '/api/v1',
        NODE_ENV: 'production',
      },
    },
  ],
};
```

---

# 3. Общий формат ответов

Все успешные ответы имеют формат:

```json
{
  "success": true,
  "data": { ... }
}
```

Все ошибочные ответы:

```json
{
  "success": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable English text",
    "details": { ... optional ... }
  }
}
```

Где `code` — один из кодов `VendingControllerError` (или `INTERNAL_ERROR`):

* `INVALID_ARGUMENT`
* `PORT_NOT_OPEN`
* `COMM_TIMEOUT`
* `CONTROLLER_ERROR`
* `PROTOCOL_BAD_LENGTH`
* `PROTOCOL_BAD_CHECKSUM`
* `PROTOCOL_UNEXPECTED_STATUS`
* `INTERNAL_ERROR` (что-то не из `VendingControllerError`)

Типичные случаи:

* неверные параметры запроса → `400` + `INVALID_ARGUMENT`;
* порт недоступен → `503` + `PORT_NOT_OPEN`;
* тайм-аут общения с контроллером → `504` + `COMM_TIMEOUT`;
* контроллер вернул статус ошибки → `502` + `CONTROLLER_ERROR`;
* баги протокола/ответа → `502` + `PROTOCOL_*`;
* любые неожиданности в коде → `500` + `INTERNAL_ERROR`.

---

# 4. Группы методов

Для удобства разобьём документацию по группам:

1. Выдача товара
2. Каналы: проверка и опрос
3. Диагностика / самотест
4. Типы каналов и режимы (одиночный/двойной)
5. Температура и холодильный контур
6. Дверь / свет / звук / акселерометр

Во всех примерах я буду использовать:

* адрес сервиса: `http://localhost:5000`
* базовый путь: `/api/v1`

---

## 4.1. Выдача товара

### 4.1.1. `POST /api/v1/vend/simple`

**Назначение:**
Сделать один оборот выбранного канала **без контроля падения**.

**URL:**

```text
POST /api/v1/vend/simple
```

**Тело запроса (JSON):**

```json
{
  "channel": 5,
  "timeoutMs": 10000
}
```

Поля:

* `channel` (number, **обязательно**) — номер канала, обычно `1..80`.
* `timeoutMs` (number, опционально) — тайм-аут одного цикла выдачи в миллисекундах.
  Если не указано — используется дефолт из контроллера (обычно около 10 секунд).

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "channel": 5,
    "rawHex": "005d00aa..."
  }
}
```

* `channel` — запрошенный канал.
* `rawHex` — 5-байтный ответ контроллера в виде hex-строки (для диагностики).

**Ошибки (примеры):**

* неверный `channel`:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "Invalid channel number",
    "details": {
      "channel": 0
    }
  }
}
```

* тайм-аут:

```json
{
  "success": false,
  "error": {
    "code": "COMM_TIMEOUT",
    "message": "Timeout waiting for controller reply"
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/vend/simple \
  -H "Content-Type: application/json" \
  -d '{"channel": 51, "timeoutMs": 10000}'
```

---

### 4.1.2. `POST /api/v1/vend/drop-check`

**Назначение:**
Выдача товара **с контролем падения** по фотодатчику.

**URL:**

```text
POST /api/v1/vend/drop-check
```

**Тело запроса (JSON):**

```json
{
  "channel": 5,
  "timeoutMs": 10000
}
```

Поля как в `vend/simple`.

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "channel": 5,
    "dropped": true,
    "rawHex": "005daa..."
  }
}
```

* `dropped` (boolean) —
  `true` — фотодатчик зафиксировал падение товара;
  `false` — механика отработала, но падения не увидели (например, пустая спираль, клин, датчик).

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/vend/drop-check \
  -H "Content-Type: application/json" \
  -d '{"channel": 52, "timeoutMs": 15000}'
```

---

## 4.2. Каналы: проверка и опрос

### 4.2.1. `GET /api/v1/channels/:channel/exists`

**Назначение:**
Проверить, существует ли физически указанный канал.

**URL:**

```text
GET /api/v1/channels/5/exists?timeoutMs=300
```

Параметры:

* `:channel` (path, number) — номер канала (`1..80`).
* `timeoutMs` (query, number, опционально) — тайм-аут одного запроса.

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "channel": 5,
    "exists": true,
    "rawHex": "005d0100..."
  }
}
```

* `exists` — `true`, если контроллер сообщает, что канал есть, `false` если нет.

**Пример curl:**

```bash
curl "http://localhost:5000/api/v1/channels/2/exists?timeoutMs=300"
```

---

### 4.2.2. `GET /api/v1/channels/poll`

**Назначение:**
Опросить **несколько каналов подряд**, получить статус по каждому.

**URL:**

```text
GET /api/v1/channels/poll?maxChannel=20&delayMs=100&timeoutMs=300
```

Query-параметры:

* `maxChannel` (number, опционально) — до какого логического канала опрашивать.
  По умолчанию — максимум контроллера (например, 60).
* `delayMs` (number, опционально) — задержка между запросами к соседним каналам (мс).
  По умолчанию `50`.
* `timeoutMs` (number, опционально) — тайм-аут на **один** запрос.

**Успешный ответ:**

```json
{
  "success": true,
  "data": [
    {
      "channel": 1,
      "exists": true,
      "status": "ok",
      "error": null
    },
    {
      "channel": 2,
      "exists": false,
      "status": "controllerError",
      "error": {
        "code": "CONTROLLER_ERROR",
        "message": "Controller returned error status",
        "details": {
          "mechanicalError": true
        }
      }
    }
    // ...
  ]
}
```

Поля для каждого элемента:

* `channel` — номер канала.
* `exists` — итоговое решение: `true`/`false`.
* `status` — состояние запроса:

  * `ok` — запрос прошёл, контроллер ответил корректно;
  * `controllerError` — контроллер вернул код ошибки (`STATUS_ERROR`);
  * `timeout` — истёк тайм-аут;
  * `protocolError` — что-то не так с протоколом (checksum, длина).
* `error` — объект ошибки (если не `ok`) или `null`.

**Пример curl:**

```bash
curl "http://localhost:5000/api/v1/channels/poll?maxChannel=60&delayMs=100&timeoutMs=1000"
```

---

## 4.3. Диагностика / самотест

### 4.3.1. `POST /api/v1/self-test`

**Назначение:**
Запустить общий самотест контроллера.

**URL:**

```text
POST /api/v1/self-test
```

**Тело запроса (JSON):**

```json
{
  "timeoutMs": 300
}
```

`timeoutMs` — опционально.

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "ok": true,
    "rawHex": "005d..."
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/self-test \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.3.2. `POST /api/v1/reset-all`

**Назначение:**
Сделать один оборот **всех каналов** (сервисная операция).

**Тело запроса:**

```json
{
  "timeoutMs": 10000
}
```

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "ok": true,
    "rawHex": "005d..."
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/reset-all \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 10000}'
```

---

### 4.3.3. `POST /api/v1/repeat-last-reply`

**Назначение:**
Запросить **повтор последнего ответа** контроллера (без повторения действия).

**Тело:**

```json
{
  "timeoutMs": 300
}
```

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "rawHex": "005d..."
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/repeat-last-reply \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

## 4.4. Типы каналов и режимы

### 4.4.1. `POST /api/v1/channels/:channel/type/belt`

**Назначение:**
Сделать указанный канал **ленточным**.

**URL:**

```text
POST /api/v1/channels/5/type/belt
```

**Тело:**

```json
{
  "timeoutMs": 300
}
```

**Успешный ответ:**

```json
{
  "success": true,
  "data": {
    "ok": true,
    "rawHex": "005d..."
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/channels/5/type/belt \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.4.2. `POST /api/v1/channels/:channel/type/spring`

**Назначение:**
Сделать канал **пружинным**.

Аналогично предыдущему, URL:

```text
POST /api/v1/channels/5/type/spring
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/channels/5/type/spring \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.4.3. `POST /api/v1/channels/type/all/spring`

**Назначение:**
Все каналы сделать **пружинными**.

```bash
curl -X POST http://localhost:5000/api/v1/channels/type/all/spring \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

Ответ как обычно:

```json
{
  "success": true,
  "data": {
    "ok": true,
    "rawHex": "005d..."
  }
}
```

---

### 4.4.4. `POST /api/v1/channels/type/all/belt`

**Назначение:**
Все каналы сделать **ленточными**.

```bash
curl -X POST http://localhost:5000/api/v1/channels/type/all/belt \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.4.5. `POST /api/v1/channels/:channel/mode/single`

**Назначение:**
Сделать канал **одиночным** (если он был частью двойного).

```text
POST /api/v1/channels/5/mode/single
```

**Тело:**

```json
{
  "timeoutMs": 300
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/channels/5/mode/single \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.4.6. `POST /api/v1/channels/:channel/mode/double`

**Назначение:**
Объединить **два соседних канала** в двойной (например, `5` и `6`).

```text
POST /api/v1/channels/5/mode/double
```

**Тело и ответ** — такие же по структуре.

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/channels/41/mode/double \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.4.7. `POST /api/v1/channels/mode/all/single`

**Назначение:**
Сделать **все каналы одиночными**.

```bash
curl -X POST http://localhost:5000/api/v1/channels/mode/all/single \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

## 4.5. Температура и холодильный контур

### 4.5.1. `GET /api/v1/temperature`

**Назначение:**
Получить текущую температуру внутри шкафа.

**URL:**

```text
GET /api/v1/temperature?timeoutMs=300
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "celsius": 4,
    "rawHex": "005d04..."
  }
}
```

**Пример curl:**

```bash
curl "http://localhost:5000/api/v1/temperature?timeoutMs=300"
```

---

### 4.5.2. `POST /api/v1/temp/control`

**Назначение:**
Включить/выключить термоконтроль.

**Тело:**

```json
{
  "enabled": true,
  "timeoutMs": 300
}
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "ok": true,
    "rawHex": "005d..."
  }
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/temp/control \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "timeoutMs": 300}'
```

---

### 4.5.3. `POST /api/v1/temp/mode`

**Назначение:**
Установить режим термоконтроля.

**Тело:**

```json
{
  "mode": "cool",
  "timeoutMs": 300
}
```

* `mode` — `"cool"` (охлаждение) или `"heat"` (нагрев).

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/temp/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "cool", "timeoutMs": 300}'
```

---

### 4.5.4. `POST /api/v1/temp/setpoint`

**Назначение:**
Установить **целевую температуру** (уставку).

**Тело:**

```json
{
  "celsius": 4,
  "timeoutMs": 300
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/temp/setpoint \
  -H "Content-Type: application/json" \
  -d '{"celsius": 4, "timeoutMs": 300}'
```

---

### 4.5.5. `POST /api/v1/temp/hysteresis`

**Назначение:**
Установить **гистерезис** (дельта в градусах).

```json
{
  "deltaC": 2,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/temp/hysteresis \
  -H "Content-Type: application/json" \
  -d '{"deltaC": 2, "timeoutMs": 300}'
```

---

### 4.5.6. `POST /api/v1/temp/compensation`

**Назначение:**
Температурная **компенсация**.

```json
{
  "celsius": 1,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/temp/compensation \
  -H "Content-Type: application/json" \
  -d '{"celsius": 1, "timeoutMs": 300}'
```

---

### 4.5.7. `POST /api/v1/temp/defrost`

**Назначение:**
Установить длительность **дефроста (разморозки)** в минутах.

```json
{
  "minutes": 10,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/temp/defrost \
  -H "Content-Type: application/json" \
  -d '{"minutes": 10, "timeoutMs": 300}'
```

---

### 4.5.8. `POST /api/v1/temp/compressor-run`

**Назначение:**
Максимальное непрерывное время работы **компрессора**, мин.

```json
{
  "minutes": 20,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/temp/compressor-run \
  -H "Content-Type: application/json" \
  -d '{"minutes": 20, "timeoutMs": 300}'
```

---

### 4.5.9. `POST /api/v1/temp/fan-idle-off`

**Назначение:**
Задержка отключения вентилятора по простою.

```json
{
  "minutes": 5,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/temp/fan-idle-off \
  -H "Content-Type: application/json" \
  -d '{"minutes": 5, "timeoutMs": 300}'
```

---

### 4.5.10. `POST /api/v1/glass-heater`

**Назначение:**
Включить/выключить **обогрев стекла**.

```json
{
  "on": true,
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/glass-heater \
  -H "Content-Type: application/json" \
  -d '{"on": true, "timeoutMs": 300}'
```

---

## 4.6. Дверь / свет / звук / акселерометр

### 4.6.1. `GET /api/v1/door`

**Назначение:**
Прочитать состояние двери (`open`/`closed`).

**URL:**

```text
GET /api/v1/door?timeoutMs=300
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "state": "closed",
    "rawHex": "005d00..."
  }
}
```

**Пример curl:**

```bash
curl "http://localhost:5000/api/v1/door?timeoutMs=300"
```

---

### 4.6.2. `POST /api/v1/door/open`

**Назначение:**
Команда «открыть дверь».

```json
{
  "timeoutMs": 300
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:5000/api/v1/door/open \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.6.3. `POST /api/v1/door/unlock`

**Назначение:**
Команда «разблокировать дверь выдачи».

```bash
curl -X POST http://localhost:5000/api/v1/door/unlock \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

### 4.6.4. `POST /api/v1/lighting`

**Назначение:**
Включить/выключить **подсветку витрины**.

```json
{
  "on": true,
  "timeoutMs": 300
}
```

**Пример включения:**

```bash
curl -X POST http://localhost:5000/api/v1/lighting \
  -H "Content-Type: application/json" \
  -d '{"on": false, "timeoutMs": 300}'
```

**Пример выключения:**

```bash
curl -X POST http://localhost:5000/api/v1/lighting \
  -H "Content-Type: application/json" \
  -d '{"on": false}'
```

---

### 4.6.5. `POST /api/v1/buzzer`

**Назначение:**
Включить/выключить **зуммер**.

```json
{
  "on": true,
  "timeoutMs": 300
}
```

**Пример:**

```bash
curl -X POST http://localhost:5000/api/v1/buzzer \
  -H "Content-Type: application/json" \
  -d '{"on": true, "timeoutMs": 300}'
```

---

### 4.6.6. `POST /api/v1/accelerometer/enable`

**Назначение:**
Включить **акселерометр** (если поддерживается конкретной моделью контроллера).

```json
{
  "timeoutMs": 300
}
```

```bash
curl -X POST http://localhost:5000/api/v1/accelerometer/enable \
  -H "Content-Type: application/json" \
  -d '{"timeoutMs": 300}'
```

---

# 5. Итог

* Модуль `vending-http-api.mjs` полностью зеркалит функционал `VendingController` через REST.
* Все ответы однородны: `{ success, data }` или `{ success, error }`.
* Ошибки контроллера мапятся в HTTP-коды и `error.code`/`message`.
