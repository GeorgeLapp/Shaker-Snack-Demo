Документация по модулю `vending-controller.mjs`.

Она ориентирована на разработчика, который будет:

* работать с контроллером вендингового автомата по RS-232;
* вызывать методы из Node.js;
* понимать, какие байты реально уходят в контроллер и что возвращается.

Описано:

* **формат кадра запроса/ответа по UART**;
* **каждый публичный метод** `VendingController`: параметры, результат, возможные ошибки;
* **формат ошибок**;
* **наглядные примеры кода**.

---

## 1. Общее описание

`vending-controller.mjs` — это ESM-модуль для Node.js, который:

* открывает последовательный порт (RS-232/UART);
* формирует **6-байтные кадры запросов** к контроллеру автомата;
* принимает и валидирует **5-байтные кадры ответов**;
* преобразует низкоуровневые ответы в удобные JS-объекты;
* даёт набор прикладных методов: выдача товара, управление температурой, светом, дверью, проверка каналов и т.д.;
* предоставляет удобную систему ошибок `VendingControllerError`.

---

## 2. Установка и подключение

### Зависимости

Внутри модуля используется:

* `serialport` — для работы с RS-232.

Установка:

```bash
npm install serialport
```

Подключение модуля:

```js
import { VendingController, VendingControllerError, ERROR_CODES } from './vending-controller.mjs';
```

---

## 3. Протокол: формат кадра

### 3.1. Кадр запроса (6 байт)

Каждый метод в итоге формирует **один** 6-байтный запрос:

```text
[0] GROUP_ID          (D0)
[1] ~GROUP_ID         (D1 = 0xFF - D0)
[2] CMD               (D2)
[3] ~CMD              (D3 = 0xFF - D2)
[4] SUB               (D4) — параметр/подкоманда
[5] ~SUB              (D5 = 0xFF - D4)
```

В модуле:

* `GROUP_ID` всегда `0x00`;
* `~x` считается как `(0xFF - x) & 0xFF`.

Пример (условный):

```text
GROUP_ID = 0x00
CMD      = 0x05  (выдача 5-го канала)
SUB      = 0x55  (без контроля падения)

Запрос: 00 ff 05 fa 55 aa
```

---

### 3.2. Кадр ответа (5 байт)

Любой ответ контроллера имеет вид:

```text
[0] GROUP_ID     (D0)
[1] STATUS       (D1)
[2] DATA         (D2)
[3] AUX          (D3)
[4] CHECKSUM     (D4) = (D0 + D1 + D2 + D3) & 0xFF
```

Базовые статусы:

* `STATUS_OK`   = `0x5D` — команда выполнена успешно;
* `STATUS_ERROR`= `0x5C` — контроллер сообщает об ошибке (механической/оптической и т.п.).

При получении ответа модуль:

1. Проверяет длину (ровно 5 байт).
2. Проверяет контрольную сумму.
3. Проверяет `STATUS`:

   * если `0x5D` → успех;
   * если `0x5C` → строится `VendingControllerError` с расшифровкой бит ошибок;
   * если другое значение → ошибка протокола.

---

## 4. Ошибки: `VendingControllerError` и `ERROR_CODES`

### 4.1. Класс ошибки

`VendingControllerError` наследуется от `Error` и содержит поля:

* `code` — один из `ERROR_CODES`;
* `message` — текст на английском;
* `details` — объект с дополнительной информацией (например, коды ошибок механики/оптики);
* `rawReply` — полный кадр ответа (`Buffer`), если ошибка связана с ответом контроллера.

Пример обработки:

```js
try {
  const result = await controller.vendWithDropCheck(5);
  console.log('Vend OK:', result);
} catch (err) {
  if (err instanceof VendingControllerError) {
    console.error('Controller error code:', err.code);
    console.error('Message:', err.message);
    console.error('Details:', err.details);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

### 4.2. Коды ошибок `ERROR_CODES`

```js
export const ERROR_CODES = {
  PORT_NOT_OPEN: 'PORT_NOT_OPEN',              // Порт не открыт или ошибка записи
  COMM_TIMEOUT: 'COMM_TIMEOUT',                // Тайм-аут ожидания ответа
  PROTOCOL_BAD_LENGTH: 'PROTOCOL_BAD_LENGTH',  // Ответ не 5 байт
  PROTOCOL_BAD_CHECKSUM: 'PROTOCOL_BAD_CHECKSUM', // Некорректная checksum
  PROTOCOL_UNEXPECTED_STATUS: 'PROTOCOL_UNEXPECTED_STATUS', // Статус не 0x5D/0x5C
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',        // Невалидные аргументы JS-метода
  CONTROLLER_ERROR: 'CONTROLLER_ERROR',        // Контроллер вернул STATUS_ERROR
};
```

Тексты ошибок (внутри модуля) — всегда на английском:
`'Serial port is not open'`, `'Timeout waiting for controller reply'` и т.д.

---

## 5. Класс `VendingController`

### 5.1. Конструктор

```js
const controller = new VendingController({
  portPath: '/dev/ttyUSB0', // обязательно
  baudRate: 9600,           // опционально, по умолчанию 9600
  logger: (entry) => {},    // опционально, функция логирования
});
```

**Параметры:**

* `portPath` — путь к последовательному порту (`'COM3'`, `'/dev/ttyUSB0'` и т.п.) **обязателен**;
* `baudRate` — скорость порта (по умолчанию 9600);
* `logger(entry)` — функция, которой модуль отдаёт структурированные логи:

  * `type: 'info' | 'tx' | 'rx' | 'warn' | ...`;
  * `txHex` / `rxHex` — сырые кадры в hex;
  * `description` — что выполняется.

При отсутствии `logger` внутри используется пустая функция (без логов).

Если `portPath` не указан, выбрасывается `VendingControllerError(INVALID_ARGUMENT)`.

---

### 5.2. Открытие/закрытие порта

```js
await controller.open();
...
await controller.close();
```

**`open()`**

* Открывает последовательный порт;
* При ошибке выбрасывает `VendingControllerError(PORT_NOT_OPEN)`.

**`close()`**

* Закрывает порт, если он открыт;
* Ошибки Node.js (если будут) пробрасываются «как есть».

---

### 5.3. Общие соглашения для методов

Почти у всех методов:

* параметры `timeoutMs` по умолчанию заданы на уровне модуля:

  * быстрые команды (дверь, свет, проверки) — `DEFAULT_FAST_TIMEOUT_MS = 300` мс;
  * команды выдачи — `DEFAULT_VEND_TIMEOUT_MS = 10000` мс;
* при неверных аргументах (канал вне диапазона, отрицательный тайм-аут и т.п.) выбрасывается `VendingControllerError(INVALID_ARGUMENT)`;
* при тайм-ауте — `VendingControllerError(COMM_TIMEOUT)`;
* при ответе контроллера со статусом ERROR (0x5C) — `VendingControllerError(CONTROLLER_ERROR)` с расшифрованными битами.

---

## 6. Методы выдачи товара

### 6.1. `vendSimple(channel, timeoutMs?)`

**Назначение:**
Сделать один оборот выбранного канала **без контроля падения товара** (фотодатчик не используется).

**Сигнатура:**

```js
await controller.vendSimple(channel, timeoutMs);
```

**Параметры:**

* `channel: number` — номер канала, целое `1..80`;
* `timeoutMs?: number` — тайм-аут для выдачи, по умолчанию `10000` мс.

**Возвращает (Promise):**

```ts
{
  channel: number,    // номер канала
  raw: Buffer         // полный 5-байтный ответ контроллера
}
```

**Формат запроса (UART):**

```text
CMD = <номер канала> (1..80)
SUB = 0x55 (SUPP_DROP_CHECK_DISABLED — без контроля падения)

Кадр:
[0] 0x00   GROUP_ID
[1] 0xFF   ~GROUP_ID
[2] CMD    channel
[3] ~CMD   0xFF - CMD
[4] 0x55
[5] 0xAA   (0xFF - 0x55)
```

**Формат ответа:**

* `STATUS = 0x5D` — успех;
* `STATUS = 0x5C` — ошибка механики/оптики, будут биты в `DATA`.

**Пример использования:**

```js
try {
  const res = await controller.vendSimple(5);
  console.log('Vend simple OK:', {
    channel: res.channel,
    rawHex: res.raw.toString('hex'),
  });
} catch (err) {
  if (err instanceof VendingControllerError) {
    console.error('Vend simple failed:', err.code, err.message, err.details);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

---

### 6.2. `vendWithDropCheck(channel, timeoutMs?)`

**Назначение:**
Выдать товар с контролем падения по фотодатчику.

**Сигнатура:**

```js
await controller.vendWithDropCheck(channel, timeoutMs);
```

**Параметры:**

* `channel: number` — канал `1..80`;
* `timeoutMs?: number` — тайм-аут (по умолчанию 10000 мс).

**Возвращает:**

```ts
{
  channel: number,
  dropped: boolean,  // true — падение товара зафиксировано; false — не зафиксировано
  raw: Buffer
}
```

**Формат запроса:**

```text
CMD = <номер канала> (1..80)
SUB = 0xAA (SUPP_DROP_CHECK_ENABLED — контроль падения включён)

Кадр:
[0] 0x00
[1] 0xFF
[2] CMD        (channel)
[3] ~CMD
[4] 0xAA
[5] 0x55
```

**Формат ответа (успех):**

* `STATUS = 0x5D`;
* `AUX (D3)`:

  * `0xAA` → `dropped = true` (падение зафиксировано);
  * `0x00` → `dropped = false` (механика сработала, но падение не увидели).

**Пример:**

```js
const res = await controller.vendWithDropCheck(5);
console.log('Vend with drop check:', {
  channel: res.channel,
  dropped: res.dropped,
  rawHex: res.raw.toString('hex'),
});
```

---

## 7. Диагностика и сервис

### 7.1. `selfTest(timeoutMs?)`

**Назначение:**
Запустить общий самотест контроллера.

**Сигнатура:**

```js
await controller.selfTest(timeoutMs);
```

**Параметры:**

* `timeoutMs?: number` — по умолчанию `300` мс.

**Возвращает:**

```ts
{
  ok: boolean,  // true если STATUS_OK, иначе через исключение
  raw: Buffer
}
```

**Формат запроса:**

* `CMD = 0x64` (`CMD_SELF_TEST`);
* `SUB = 0x55` (SUPP_NO_PARAM).

```text
00 ff 64 9b 55 aa
```

**Формат ответа (успех):**

* `STATUS = 0x5D`;
* остальные поля зависят от реализации контроллера.

**Пример:**

```js
const res = await controller.selfTest();
console.log('Self test ok:', res.ok, 'rawHex:', res.raw.toString('hex'));
```

---

### 7.2. `resetAll(timeoutMs?)`

**Назначение:**
Сделать один оборот **всех каналов** (сервисная операция).

**Сигнатура:**

```js
await controller.resetAll(timeoutMs);
```

**Параметры:**

* `timeoutMs?: number` — по умолчанию `10000` мс.

**Возвращает:**

```ts
{
  ok: boolean,
  raw: Buffer
}
```

**Запрос:**

* `CMD = 0x65` (`CMD_RESET_ALL`);
* `SUB = 0x55`.

**Пример:**

```js
await controller.resetAll();
```

---

### 7.3. `repeatLastReply(timeoutMs?)`

**Назначение:**
Запросить **повтор последнего ответа** контроллера (без повторения действия).

**Сигнатура:**

```js
await controller.repeatLastReply(timeoutMs);
```

**Параметры:**

* `timeoutMs?: number` — по умолчанию `300` мс.

**Возвращает:**

```ts
{
  raw: Buffer  // точная копия последнего ответа
}
```

Статус может быть как `STATUS_OK`, так и `STATUS_ERROR` — **метод не кидает исключение**, а отдаёт кадр как есть.

**Запрос:**

* `CMD = 0x66`;
* `SUB = 0x55`.

**Пример:**

```js
const res = await controller.repeatLastReply();
console.log('Last reply hex:', res.raw.toString('hex'));
```

---

## 8. Типы каналов и объединение

### 8.1. `setChannelTypeBelt(channel, timeoutMs?)`

**Назначение:**
Сделать канал **ленточным**.

**Сигнатура:**

```js
await controller.setChannelTypeBelt(channel, timeoutMs);
```

**Параметры:**

* `channel: number` — `1..80`;
* `timeoutMs?: number` — по умолчанию `300` мс.

**Ответ:**

```ts
{
  ok: boolean,
  raw: Buffer
}
```

**Запрос:**

* `CMD = 0x68` (`CMD_SET_CHANNEL_TYPE_BELT`);
* `SUB = channel`.

---

### 8.2. `setChannelTypeSpring(channel, timeoutMs?)`

**Назначение:**
Сделать канал **пружинным**.

Сигнатура, параметры и результат аналогичны `setChannelTypeBelt`, только:

* `CMD = 0x74` (`CMD_SET_CHANNEL_TYPE_SPRING`).

---

### 8.3. `setAllSpring(timeoutMs?)`

**Назначение:**
Сделать **все каналы пружинными**.

```js
await controller.setAllSpring(timeoutMs);
```

* `CMD = 0x75`, `SUB = 0x55`.

---

### 8.4. `setAllBelt(timeoutMs?)`

**Назначение:**
Сделать **все каналы ленточными**.

```js
await controller.setAllBelt(timeoutMs);
```

* `CMD = 0x76`, `SUB = 0x55`.

---

### 8.5. `makeSingle(channel, timeoutMs?)`

**Назначение:**
Сделать указанный канал **одиночным** (если был частью двойного).

**Сигнатура:**

```js
await controller.makeSingle(channel, timeoutMs);
```

* `CMD = 0xC9`;
* `SUB = channel`.

---

### 8.6. `makeDouble(channel, timeoutMs?)`

**Назначение:**
Объединить **два соседних канала** в двойной (например, 5 и 6).

**Сигнатура:**

```js
await controller.makeDouble(channel, timeoutMs);
```

* `CMD = 0xCA`;
* `SUB = channel` (первый канал пары).

---

### 8.7. `makeAllSingle(timeoutMs?)`

**Назначение:**
Все каналы сделать **одиночными**.

```js
await controller.makeAllSingle(timeoutMs);
```

* `CMD = 0xCB`, `SUB = 0x55`.

**Пример (групповой):**

```js
await controller.setAllSpring();
await controller.makeAllSingle();
```

---

## 9. Проверка существования канала и опрос всех каналов

### 9.1. `channelExists(channel, timeoutMs?)`

**Назначение:**
Проверить, существует ли физически указанный канал.

**Сигнатура:**

```js
await controller.channelExists(channel, timeoutMs);
```

**Параметры:**

* `channel: number` — `1..80` (логический);
* `timeoutMs?: number` — по умолчанию `300` мс.

**Возвращает:**

```ts
{
  exists: boolean,   // true — канал есть; false — нет
  raw: Buffer
}
```

**Поведение:**

* Метод использует внутреннее `allowStatusError = true`, поэтому:

  * `STATUS_OK (0x5D)` → `exists = true`;
  * `STATUS_ERROR (0x5C)` → `exists = false`;
* Ошибки протокола/тайм-аут → исключения `VendingControllerError`.

**Пример:**

```js
const { exists } = await controller.channelExists(12);
console.log('Channel 12 exists?', exists);
```

---

### 9.2. `pollAllChannels({ maxChannel?, interChannelDelayMs?, timeoutMs? } = {})`

**Назначение:**
Опросить **несколько каналов подряд** (по умолчанию — до физического максимума, например 60), с паузой между запросами, и вернуть агрегированный результат.

**Сигнатура:**

```js
await controller.pollAllChannels(options);
```

**Параметры:**

* `maxChannel?: number` — до какого логического канала опрашивать;

  * по умолчанию `MAX_PHYSICAL_CHANNEL = 60`;
  * реально ограничивается `<= 80`.
* `interChannelDelayMs?: number` — пауза между запросами, по умолчанию `50` мс;
* `timeoutMs?: number` — тайм-аут на **один** запрос.

**Возвращает:**

```ts
Array<{
  channel: number,
  exists: boolean,
  status: 'ok' | 'controllerError' | 'timeout' | 'protocolError',
  error: VendingControllerError | Error | null
}>
```

**Логика:**

Для каждого канала:

* вызывает `channelExists(channel, timeoutMs)`;
* если метод прошёл без исключения → `status = 'ok'`, `exists` зависимо от ответа;
* если было исключение:

  * `COMM_TIMEOUT` → `status = 'timeout'`;
  * `CONTROLLER_ERROR` → `status = 'controllerError'`;
  * прочее → `status = 'protocolError'`;
* `exists` в случае ошибки всегда `false`.

**Пример:**

```js
const poll = await controller.pollAllChannels({
  maxChannel: 20,
  interChannelDelayMs: 100,
  timeoutMs: 300,
});

for (const ch of poll) {
  console.log(
    `Channel ${ch.channel}: exists=${ch.exists}, status=${ch.status}`,
    ch.error ? ch.error.message : '',
  );
}
```

---

## 10. Температура и холодильный контур

### 10.1. `tempControlEnable(enabled, timeoutMs?)`

**Назначение:**
Включить/выключить термоконтроль.

**Сигнатура:**

```js
await controller.tempControlEnable(enabled, timeoutMs);
```

**Параметры:**

* `enabled: boolean` — `true` → включить, `false` → выключить;
* `timeoutMs?: number` — по умолчанию `300` мс.

**Запрос:**

* `CMD = 0xCC`;
* `SUB = 0x01` если `enabled`, иначе `0x00`.

**Ответ:**

```ts
{
  ok: boolean,
  raw: Buffer
}
```

---

### 10.2. `setThermoMode(mode, timeoutMs?)`

**Назначение:**
Режим термоконтроля: охлаждение/нагрев.

**Сигнатура:**

```js
await controller.setThermoMode(mode, timeoutMs);
```

**Параметры:**

* `mode: 'cool' | 'heat'`;
* `timeoutMs?: number`.

**Запрос:**

* `CMD = 0xCD`;
* `SUB = 0x01` для `cool` (охлаждение);
* `SUB = 0x00` для `heat` (нагрев).

---

### 10.3. `setSetpoint(celsius, timeoutMs?)`

**Назначение:**
Установить целевую температуру (точку уставки) в °C.

**Сигнатура:**

```js
await controller.setSetpoint(celsius, timeoutMs);
```

**Параметры:**

* `celsius: number` — температура, приводится к байту `0..255`;
* `timeoutMs?: number`.

**Запрос:** `CMD = 0xCE`, `SUB = celsius & 0xFF`.

Пример:

```js
await controller.setSetpoint(4); // +4 °C
```

---

### 10.4. `setHysteresis(deltaC, timeoutMs?)`

**Назначение:**
Установить гистерезис (дельта в градусах).

```js
await controller.setHysteresis(deltaC, timeoutMs);
```

* `CMD = 0xCF`, `SUB = deltaC & 0xFF`.

---

### 10.5. `setCompensation(celsius, timeoutMs?)`

**Назначение:**
Установить температурную компенсацию.

```js
await controller.setCompensation(celsius, timeoutMs);
```

* `CMD = 0xD0`, `SUB = celsius & 0xFF`.

---

### 10.6. `setDefrostMinutes(minutes, timeoutMs?)`

**Назначение:**
Задать длительность дефроста (разморозки) в минутах.

```js
await controller.setDefrostMinutes(minutes, timeoutMs);
```

* `CMD = 0xD1`, `SUB = minutes & 0xFF`.

---

### 10.7. `setCompressorRunMinutes(minutes, timeoutMs?)`

**Назначение:**
Максимальное непрерывное время работы компрессора.

```js
await controller.setCompressorRunMinutes(minutes, timeoutMs);
```

* `CMD = 0xD2`, `SUB = minutes & 0xFF`.

---

### 10.8. `setFanIdleOffDelay(minutes, timeoutMs?)`

**Назначение:**
Задержка отключения вентилятора по простою.

```js
await controller.setFanIdleOffDelay(minutes, timeoutMs);
```

* `CMD = 0xD3`, `SUB = minutes & 0xFF`.

---

### 10.9. `setGlassHeater(on, timeoutMs?)`

**Назначение:**
Включить/выключить обогрев стекла.

```js
await controller.setGlassHeater(on, timeoutMs);
```

* `CMD = 0xD4`;
* `SUB = 0x01` если `on`, иначе `0x00`.

---

### 10.10. `readTemperature(timeoutMs?)`

**Назначение:**
Прочитать текущую температуру шкафа.

**Сигнатура:**

```js
await controller.readTemperature(timeoutMs);
```

**Возвращает:**

```ts
{
  celsius: number, // знаковый байт: -128..+127 °C
  raw: Buffer
}
```

**Запрос:**

* `CMD = 0xDC`;
* `SUB = 0x55`.

**Ответ:**

* `DATA (D2)` — знаковый байт, конвертация в модуле:

  * если установлен бит 7 (`>= 0x80`) → `value - 0x100` (получается отрицательное).

**Пример:**

```js
const t = await controller.readTemperature();
console.log('Temperature:', t.celsius, '°C (raw=', t.raw.toString('hex'), ')');
```

---

## 11. Свет, звук, дверь, акселерометр

### 11.1. `setLighting(on, timeoutMs?)`

**Назначение:**
Включить/выключить подсветку витрины.

```js
await controller.setLighting(on, timeoutMs);
```

**Запрос:**

* `CMD = 0xDD`;
* `SUB = 0xAA` — включить;
* `SUB = 0x55` — выключить.

**Ответ:**

```ts
{
  ok: boolean,
  raw: Buffer
}
```

---

### 11.2. `setBuzzer(on, timeoutMs?)`

**Назначение:**
Включить/выключить зуммер.

```js
await controller.setBuzzer(on, timeoutMs);
```

**Запрос:**

* `CMD = 0xDE`;
* `SUB = 0xAA` — включить;
* `SUB = 0x55` — выключить.

---

### 11.3. `readDoor(timeoutMs?)`

**Назначение:**
Прочитать состояние двери автомата.

```js
await controller.readDoor(timeoutMs);
```

**Возвращает:**

```ts
{
  state: 'closed' | 'open',
  raw: Buffer
}
```

**Логика:**

* `DATA (D2) = 0x00` → `'closed'`;
* `DATA (D2) = 0x01` → `'open'`.

**Запрос:**

* `CMD = 0xDF`;
* `SUB = 0x55`.

**Пример:**

```js
const door = await controller.readDoor();
console.log('Door state:', door.state);
```

---

### 11.4. `openDoor(timeoutMs?)`

**Назначение:**
Открыть дверь (дополнительная команда, если поддерживается).

```js
await controller.openDoor(timeoutMs);
```

* `CMD = 0xEF`;
* `SUB = 0xAA`.

**Ответ:**

```ts
{
  ok: boolean,
  raw: Buffer
}
```

---

### 11.5. `unlockDoor(timeoutMs?)`

**Назначение:**
Разблокировать дверь выдачи (доп. команда).

```js
await controller.unlockDoor(timeoutMs);
```

* `CMD = 0xF0`;
* `SUB = 0xAA`.

---

### 11.6. `enableAccelerometer(timeoutMs?)`

**Назначение:**
Включить акселерометр (зарезервировано, зависит от железа).

```js
await controller.enableAccelerometer(timeoutMs);
```

* `CMD = 0xF1`;
* `SUB = 0xAA`.

---

## 12. Общий пример использования

```js
import { VendingController, VendingControllerError } from './vending-controller.mjs';

async function main() {
  const controller = new VendingController({
    portPath: '/dev/ttyUSB0',
    baudRate: 9600,
    logger: (entry) => {
      console.log('[LOG]', entry);
    },
  });

  try {
    await controller.open();

    // 1. Самотест
    const selfTest = await controller.selfTest();
    console.log('Self test:', selfTest.ok);

    // 2. Проверка существования канала
    const ch5 = await controller.channelExists(5);
    console.log('Channel 5 exists:', ch5.exists);

    // 3. Выдача с контролем падения
    const vend = await controller.vendWithDropCheck(5);
    console.log('Vend result:', vend);

    // 4. Чтение температуры
    const temp = await controller.readTemperature();
    console.log('Temperature:', temp.celsius);

    // 5. Чтение состояния двери
    const door = await controller.readDoor();
    console.log('Door state:', door.state);

    // 6. Опрос всех каналов до 20
    const poll = await controller.pollAllChannels({
      maxChannel: 20,
      interChannelDelayMs: 100,
    });
    console.table(
      poll.map((p) => ({
        channel: p.channel,
        exists: p.exists,
        status: p.status,
      })),
    );
  } catch (err) {
    if (err instanceof VendingControllerError) {
      console.error('Controller error:', err.code, err.message, err.details);
    } else {
      console.error('Unexpected error:', err);
    }
  } finally {
    await controller.close();
  }
}

main().catch((e) => console.error('Fatal:', e));
```
