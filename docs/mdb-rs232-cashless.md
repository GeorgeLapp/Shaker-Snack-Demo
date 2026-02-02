Документация по модулю **`mdb-rs232-cashless.mjs`**.

---

# 1. Общее описание

`mdb-rs232-cashless.mjs` — ESM-модуль для Node.js, реализующий связь
между VMC и cashless-ридером через MDB-RS232 мост (Wafer).

Основные особенности:

- TX: **сырые бинарные байты** (без CR/LF).
- RX: **ASCII-HEX строки**, завершаемые CRLF.
- Reply-данные не содержат DeviceID, activity-данные всегда начинаются с DeviceID.
- Для multi-message ответов требуется отправка **0x00** (block ACK) после каждого блока.

---

# 2. Протокол моста и формат данных

## 2.1. Базовая схема

```text
+-----------------+      TX (binary)      +----------------------+
| Node.js app     | --------------------> | MDB-RS232 bridge     |
| (this module)   | <-------------------- | ASCII-HEX RX (CRLF)  |
+-----------------+      RX (text)        +----------------------+
                                              |
                                              | MDB bus
                                              v
                                     +----------------+
                                     | Cashless reader|
                                     +----------------+
```

## 2.2. Reply vs Activity

- **Reply**: ответ на команду, обычно `00` (ACK) или `FF` (NAK), без DeviceID.
- **Activity**: асинхронные события с DeviceID (например, `10 05 ...` — Vend Approved).

## 2.3. Multi-message

Для `EXPANSION/00 Request ID` мост может отправлять данные блоками:

1) блок ответа;
2) VMC обязан отправить `0x00` (single byte) для получения следующего блока;
3) модуль собирает блоки до полной структуры Peripheral ID.

---

# 3. Быстрый старт

```js
import MdbRs232Cashless, { CashlessConstants } from "./mdb-rs232-cashless.mjs";

const bridge = new MdbRs232Cashless({
  portPath: "/dev/ttyS4",
  cashlessNumber: 1,
  serial: { baudRate: 9600 },
  debug: true,
});

await bridge.open();
await bridge.reset();

await bridge.setupConfig({
  vmcFeatureLevel: 3,
  columns: 0,
  rows: 0,
  displayType: "fullAscii",
});

await bridge.setupMaxMinPrices({
  minPriceScaled: bridge.realToScaled(1.0),
  maxPriceScaled: bridge.realToScaled(500.0),
});

// Always Idle (Product First)
try {
  await bridge.expansionEnableOptions(CashlessConstants.OPT_FEATURE_ALWAYS_IDLE);
} catch {}

await bridge.readerDisable();
```

Примечание: модуль ESM. Для CommonJS можно использовать `import()` как в `paymentDevice.js`.

---

# 4. Конструктор и опции

```js
new MdbRs232Cashless({
  portPath,            // string, например "/dev/ttyS4"
  cashlessNumber,      // 1 или 2 (DeviceID 0x10 или 0x60)
  serial,              // { baudRate, dataBits, parity, stopBits, autoOpen }
  transport,           // внешний Duplex-поток (опционально)
  commandTimeoutMs,    // таймаут ожидания reply
  multiBlockTimeoutMs, // таймаут для multi-message
  debug,               // включает debug события
});
```

Ключевые значения по умолчанию:

- `cashlessNumber=1`
- `commandTimeoutMs=1200`
- `multiBlockTimeoutMs=4000`
- `serial`: `9600/8N1`, `autoOpen=false`

---

## 4.2. Константы и значения

### 4.2.1. Экспортируемые константы `CashlessConstants`

#### Device IDs (1 байт)

| Константа | Hex | Размер | Описание |
|-----------|-----|-----|----------|
| `DEVICE_ID_COIN_CHANGER` | `0x08` | 1 байт | Activity префикс для coin changer |
| `DEVICE_ID_BILL_VALIDATOR` | `0x30` | 1 байт | Activity префикс для bill validator |
| `DEVICE_ID_CASHLESS_1` | `0x10` | 1 байт | Activity префикс для cashless #1 |
| `DEVICE_ID_CASHLESS_2` | `0x60` | 1 байт | Activity префикс для cashless #2 |

#### Optional Feature Bits (32 бита, 4 байта)

| Константа | Hex | Размер | Описание |
|-----------|-----|-----|----------|
| `OPT_FEATURE_FILE_TRANSPORT_LAYER` | `0x00000001` | 4 байта | File Transport Layer |
| `OPT_FEATURE_32BIT_MONEY` | `0x00000002` | 4 байта | 32-bit деньги |
| `OPT_FEATURE_MULTI_CURRENCY_LANG` | `0x00000004` | 4 байта | Multi-currency/language |
| `OPT_FEATURE_NEGATIVE_VEND` | `0x00000008` | 4 байта | Negative vend |
| `OPT_FEATURE_DATA_ENTRY` | `0x00000010` | 4 байта | Data entry |
| `OPT_FEATURE_ALWAYS_IDLE` | `0x00000020` | 4 байта | Always Idle (Product First) |

#### Poll codes (activity после DeviceID, 1 байт)

| Константа | Hex | Размер | Описание |
|-----------|-----|-----|----------|
| `POLL_JUST_RESET` | `0x00` | 1 байт | Just Reset |
| `POLL_READER_CONFIG_DATA` | `0x01` | 1 байт | Reader Config Data |
| `POLL_DISPLAY_REQUEST` | `0x02` | 1 байт | Display Request |
| `POLL_BEGIN_SESSION` | `0x03` | 1 байт | Begin Session |
| `POLL_SESSION_CANCEL_REQUEST` | `0x04` | 1 байт | Session Cancel Request |
| `POLL_VEND_APPROVED` | `0x05` | 1 байт | Vend Approved |
| `POLL_VEND_DENIED` | `0x06` | 1 байт | Vend Denied |
| `POLL_END_SESSION` | `0x07` | 1 байт | End Session |
| `POLL_CANCELLED` | `0x08` | 1 байт | Cancelled |
| `POLL_PERIPHERAL_ID` | `0x09` | 1 байт | Peripheral ID |
| `POLL_MALFUNCTION` | `0x0A` | 1 байт | Malfunction |
| `POLL_CMD_OUT_OF_SEQUENCE` | `0x0B` | 1 байт | Command Out of Sequence |
| `POLL_REVALUE_APPROVED` | `0x0D` | 1 байт | Revalue Approved |
| `POLL_REVALUE_DENIED` | `0x0E` | 1 байт | Revalue Denied |
| `POLL_REVALUE_LIMIT_AMOUNT` | `0x0F` | 1 байт | Revalue Limit Amount |

#### Bridge ACK bytes

| Константа | Hex | Размер | Описание |
|-----------|-----|-----|----------|
| `BRIDGE_BLOCK_ACK` | `0x00` | 1 байт | ACK блока (TX), запрашивает следующий блок |
| `BRIDGE_REPLY_ACK` | `0x00` | 1 байт | Reply ACK от моста |
| `BRIDGE_REPLY_NAK` | `0xFF` | 1 байт | Reply NAK от моста |

### 4.2.2. Командные коды (для справки)

#### Базовые команды cashless #1 (1 байт)

| Команда | Hex | Размер | Описание |
|---------|-----|-----|----------|
| RESET | `0x10` | 1 байт | Reset |
| SETUP | `0x11` | 1 байт | Setup |
| VEND | `0x13` | 1 байт | Vend |
| READER CONTROL | `0x14` | 1 байт | Reader control |
| REVALUE | `0x15` | 1 байт | Revalue |
| EXPANSION | `0x17` | 1 байт | Expansion |

Примечание: для cashless #2 коды команд увеличиваются на `0x50`.

#### Subcommands (1 байт)

| Группа | Subcommand | Hex | Размер | Описание |
|--------|------------|-----|-----|----------|
| SETUP | CONFIG DATA | `0x00` | 1 байт | `11 00` |
| SETUP | MAX/MIN PRICES | `0x01` | 1 байт | `11 01` |
| READER CONTROL | DISABLE | `0x00` | 1 байт | `14 00` |
| READER CONTROL | ENABLE | `0x01` | 1 байт | `14 01` |
| READER CONTROL | CANCEL | `0x02` | 1 байт | `14 02` |
| VEND | REQUEST | `0x00` | 1 байт | `13 00` |
| VEND | CANCEL | `0x01` | 1 байт | `13 01` |
| VEND | SUCCESS | `0x02` | 1 байт | `13 02` |
| VEND | FAILURE | `0x03` | 1 байт | `13 03` |
| VEND | SESSION COMPLETE | `0x04` | 1 байт | `13 04` |
| VEND | CASH SALE | `0x05` | 1 байт | `13 05` |
| REVALUE | REQUEST | `0x00` | 1 байт | `15 00` |
| REVALUE | LIMIT REQUEST | `0x01` | 1 байт | `15 01` |
| EXPANSION | REQUEST ID | `0x00` | 1 байт | `17 00` |
| EXPANSION | OPTIONAL FEATURE ENABLE | `0x04` | 1 байт | `17 04` |

# 5. Жизненный цикл

- `open()`:
  - открывает `serialport` по `portPath`,
  - либо подключается к `transport`, если он передан.
- `close()`:
  - снимает обработчики,
  - закрывает транспорт (если есть `close()`).

---

# 6. Команды (public API)

## 6.1. RESET

- `reset()`
- Команда: `10` (или `60` для cashless #2)
- Reply: `00` ACK / `FF` NAK

## 6.2. SETUP

### `setupConfig({ vmcFeatureLevel, columns, rows, displayType })`

- Команда: `11 00 ...`
- Reply: `01 Z2..Z8 CHK` (или activity `10 01 ...`)
- Заполняет `readerConfig`.

### `setupMaxMinPrices({ minPriceScaled, maxPriceScaled })`

- Команда: `11 01 ...`
- Reply: ACK или silence (учитывается).

## 6.3. EXPANSION

### `expansionRequestId()`

- Команда: `17 00`
- Reply: multi-message, собирается до Peripheral ID (34 байта).

### `expansionEnableOptions(mask32)`

- Команда: `17 04 BB BB BB BB`
- Reply: ACK.

## 6.4. READER CONTROL

- `readerDisable()` → `14 00`
- `readerEnable()` → `14 01`
- `readerCancel()` → `14 02` (опционально, допускается silence)

## 6.5. VEND

- `vendRequest({ priceScaled, itemNumber, use32bit })`
  - 16-бит: `13 00 PP PP II II`
  - 32-бит: `13 00 PP PP PP PP II II`
- `vendCancel()` → `13 01`
- `vendSuccess(itemNumber)` → `13 02 II II`
- `vendFailure()` → `13 03`
- `sessionComplete()` → `13 04`

## 6.6. REVALUE

- `revalueRequest(amountScaled)` → `15 00 AA AA`
- `revalueLimitRequest()` → `15 01`

---

## 6.7. Детализация методов (вход/выход, поля и значения)

### 6.7.1. `open()`

**Вход:** нет (использует параметры конструктора).

**Выход:** `Promise<void>`.

**Поведение:**

- если передан `transport`, подключается к нему;
- иначе открывает `serialport` по `portPath`.

**Ошибки:** `NO_PORT_PATH`, `NO_SERIALPORT`, системные ошибки порта.

### 6.7.2. `close()`

**Вход:** нет.

**Выход:** `Promise<void>`.

**Поведение:** отписывается от событий и закрывает транспорт, если он открыт.

### 6.7.3. `reset()`

**Команда:** `10` (или `60` для cashless #2), длина 1 байт.

**Выход:** `Promise<{ ack: true, rx: Buffer }>` при ACK.

**Ошибка:** `BRIDGE_NAK`, `TIMEOUT`, `NOT_OPEN`.

### 6.7.4. `setupConfig({ vmcFeatureLevel, columns, rows, displayType })`

**Команда:** `11 00 Y2 Y3 Y4 Y5`, длина 6 байт.

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `vmcFeatureLevel` | number | `1..3` | 1 байт | Feature level VMC |
| `columns` | number | `0..255` | 1 байт | Колонки (Y3) |
| `rows` | number | `0..255` | 1 байт | Ряды (Y4) |
| `displayType` | string | `unused`/`numbers+upper`/`fullAscii` | 3 бита | Кодируется в младших 3 битах Y5 |

**Кодирование `displayType` (Y5, 3 бита):**

- `unused` → `0b000`
- `numbers+upper` → `0b001`
- `fullAscii` → `0b010`

**Выход:** объект Reader Config (из reply или activity).

**Структура результата (reply `01 Z2..Z8 CHK`):**

| Поле | Тип | Размер | Описание |
|------|-----|-----|----------|
| `readerFeatureLevel` | number | 1 байт | Z2 |
| `countryCode` | number | 2 байта | Z3..Z4, u16 BE |
| `scalingFactor` | number | 1 байт | Z5 |
| `decimalPlaces` | number | 1 байт (ниббл) | Z6, младшие 4 бита |
| `maxResponseTimeSec` | number | 1 байт | Z7 |
| `miscOptions` | number | 1 байт | Z8 |
| `misc.canRefund` | boolean | 1 бит | miscOptions bit0 |
| `misc.multivendCapable` | boolean | 1 бит | miscOptions bit1 |
| `misc.hasOwnDisplay` | boolean | 1 бит | miscOptions bit2 |
| `misc.supportsCashSale` | boolean | 1 бит | miscOptions bit3 |
| `chk` | number | 1 байт | Контрольная сумма, если есть |
| `chkOk` | boolean | 1 бит | Сравнение CHK |
| `raw` | Buffer | N байт | Сырой reply |
| `source` | string | - | `activity`, если пришло через activity |

### 6.7.5. `setupMaxMinPrices({ minPriceScaled, maxPriceScaled, timeoutMs })`

**Команда:** `11 01 MM MM NN NN`, длина 6 байт.

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `maxPriceScaled` | number | `0..65535` | 2 байта | Максимальная цена (u16) |
| `minPriceScaled` | number | `0..65535` | 2 байта | Минимальная цена (u16) |
| `timeoutMs` | number | `>0` | - | Таймаут ожидания ACK |

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>`

- `ack=true` при получении ACK;
- `ack=false` если команда допустима без ответа (silence).

### 6.7.6. `expansionRequestId()`

**Команда:** `17 00`, длина 2 байта.

**Выход:** объект Peripheral ID (сборка multi-message).

**Структура Peripheral ID:**

| Поле | Тип | Размер | Описание |
|------|-----|-----|----------|
| `manufacturer` | string | 3 байта ASCII | Производитель |
| `serial` | string | 12 байт ASCII | Серийный номер |
| `model` | string | 12 байт ASCII | Модель |
| `swVersion.raw` | number[2] | 2 байта BCD | Версия |
| `swVersion.text` | string | - | Версия в виде `X.Y` |
| `optionalFeatureBits` | number \| null | 4 байта | Биты опций (если есть) |
| `raw` | Buffer | N байт | Сырой буфер |
| `incomplete` | boolean | 1 бит | true, если данных недостаточно |

### 6.7.7. `expansionEnableOptions(mask32)`

**Команда:** `17 04 BB BB BB BB`, длина 6 байт.

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `mask32` | number | `0..0xFFFFFFFF` | 4 байта | Маска Optional Features |

**Выход:** `Promise<{ ack: true, rx: Buffer }>`

### 6.7.8. `readerDisable()`, `readerEnable()`, `readerCancel()`

**Команды:**

- `readerDisable` → `14 00` (2 байта)
- `readerEnable` → `14 01` (2 байта)
- `readerCancel` → `14 02` (2 байта)

**Вход:** нет.

**Выход:**

- `readerDisable/Enable` → `Promise<{ ack: true, rx: Buffer }>`
- `readerCancel` → `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим)

### 6.7.9. `vendRequest({ priceScaled, itemNumber, use32bit })`

**Команда:**

- 16-бит: `13 00 PP PP II II` (6 байт)
- 32-бит: `13 00 PP PP PP PP II II` (8 байт)

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `priceScaled` | number | `>=0` | 2 или 4 байта | Цена (u16/u32) |
| `itemNumber` | number | `0..65535` | 2 байта | Номер товара |
| `use32bit` | boolean | - | - | Принудительный 32-bit формат |

**Выход:** `Promise<{ ack: true, rx: Buffer }>`

**Побочные эффекты:** сохраняет `session.lastVendPriceScaled` и `session.lastVendItem`.

### 6.7.10. `vendCancel()`

**Команда:** `13 01` (2 байта).

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

### 6.7.11. `vendSuccess(itemNumber)`

**Команда:** `13 02 II II` (4 байта).

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `itemNumber` | number | `0..65535` | 2 байта | Номер товара |

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

### 6.7.12. `vendFailure()`

**Команда:** `13 03` (2 байта).

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

### 6.7.13. `sessionComplete()`

**Команда:** `13 04` (2 байта).

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

**Побочные эффекты:** `session.active=false`.

### 6.7.14. `revalueRequest(amountScaled)`

**Команда:** `15 00 AA AA` (4 байта).

**Входные поля:**

| Поле | Тип | Диапазон | Размер | Описание |
|------|-----|----------|-----|----------|
| `amountScaled` | number | `0..65535` | 2 байта | Сумма пополнения (u16) |

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

### 6.7.15. `revalueLimitRequest()`

**Команда:** `15 01` (2 байта).

**Выход:** `Promise<{ ack: boolean, rx: Buffer | null }>` (silence допустим).

### 6.7.16. `realToScaled(real)` и `scaledToReal(scaled)`

**Вход:**

| Метод | Поле | Тип | Размер | Описание |
|-------|------|-----|-----|----------|
| `realToScaled` | `real` | number | - | Реальная цена (float) |
| `scaledToReal` | `scaled` | number | 2/4 байта | Масштабированная цена |

**Выход:**

- `realToScaled` → `number` (округление до int)
- `scaledToReal` → `number` (float)

**Условие:** требуется `readerConfig`, иначе `ProtocolError` (`NO_CFG`).

# 7. События (EventEmitter)

## 7.1. Debug/transport

| Event | Описание |
|-------|----------|
| `debug:tx` | TX-байты (`hex`, `bytes`) |
| `debug:rx` | RX-байты (`hex`, `bytes`) |
| `debug:rx:banner` | не-HEX строка |
| `raw` | любой RX байтовый буфер |
| `banner` | текстовые строки от моста |
| `reply:orphan` | reply, не относящийся к ожидаемой команде |
| `warn` | предупреждения (см. типы ниже) |
| `error` | ошибки транспорта |

## 7.2. Cashless activity

| Event | Тип `ev.type` | Когда приходит |
|-------|--------------|----------------|
| `activity:cashless` | разные | общий поток activity |
| `justReset` | `justReset` | после reset |
| `readerConfig` | `readerConfig` | config data от ридера |
| `displayRequest` | `displayRequest` | запрос на дисплей |
| `beginSession` | `beginSession` | начало сессии |
| `sessionCancelRequest` | `sessionCancelRequest` | запрос отмены |
| `vendApproved` | `vendApproved` | оплата одобрена |
| `vendDenied` | `vendDenied` | оплата отклонена |
| `endSession` | `endSession` | завершение сессии |
| `cancelled` | `cancelled` | отмена |
| `peripheralId` | `peripheralId` | ID устройства |
| `malfunction` | `malfunction` | ошибка устройства |
| `commandOutOfSequence` | `commandOutOfSequence` | ошибка последовательности |
| `revalueApproved` | `revalueApproved` | пополнение одобрено |
| `revalueDenied` | `revalueDenied` | пополнение отклонено |
| `revalueLimitAmount` | `revalueLimitAmount` | лимит пополнения |
| `unknownActivity` | `unknown` | неизвестный код |

## 7.3. Activity других устройств

- `activity:other` — события от coin/bill устройств (без парсинга).

---

## 7.4. Структуры payload для cashless activity

Во всех событиях есть базовые поля:

- `type` — строковый тип события;
- `code` — poll code (1 байт);
- `raw` — Buffer с исходными байтами payload (без DeviceID).

### 7.4.1. `justReset` (code `0x00`)

**Payload:** `[00][00][00]` (3 байта с кодом).

| Поле | Размер | Описание |
|------|-----|----------|
| `isJustReset` | 1 бит | true, если `payload[1]==0x00` и `payload[2]==0x00` |

### 7.4.2. `readerConfig` (code `0x01`)

**Payload:** `[01][Z2][Z3][Z4][Z5][Z6][Z7][Z8]` (8 байт).

Поля совпадают со структурой `setupConfig()` (см. 6.7.4), но **без CHK**.

### 7.4.3. `displayRequest` (code `0x02`)

**Payload:** `[02][TT][TEXT...]` (переменная длина).

| Поле | Размер | Описание |
|------|-----|----------|
| `displayTimeTenthSec` | 1 байт | Время показа (1/10 сек) |
| `text` | N байт ASCII | Текст дисплея |

### 7.4.4. `beginSession` (code `0x03`)

Варианты:

1) **16-bit funds**: `[03][FF][FF]`  
2) **16-bit + meta**: `[03][FF][FF][PT][PD]`  
3) **Expanded**: `[03][FFFF][FFFF][CC][CC][LL][LL][PT][PD]`

| Поле | Размер | Описание |
|------|-----|----------|
| `fundsScaled` | 2 байта | Доступные средства (u16) |
| `fundsScaled` (32-bit) | 4 байта | Доступные средства (u32) |
| `currencyCode` | 2 байта | ISO currency (u16) |
| `languageCode` | 2 байта | ISO language (u16) |
| `paymentType` | 1 байт | Тип платежа |
| `paymentData` | 1 байт | Доп. данные платежа |

### 7.4.5. `sessionCancelRequest` (code `0x04`)

**Payload:** `[04]` (минимум 1 байт).  
Дополнительные байты не интерпретируются.

### 7.4.6. `vendApproved` (code `0x05`)

Варианты:

- **16-bit**: `[05][AA][AA]`
- **32-bit**: `[05][AA][AA][AA][AA]`

| Поле | Размер | Описание |
|------|-----|----------|
| `amountScaled` | 2 или 4 байта | Сумма (u16/u32) |
| `isToken` | 1 бит | true, если `amountScaled==0xFFFFFFFF` |

### 7.4.7. `vendDenied` (code `0x06`)

**Payload:** `[06]` (минимум 1 байт).  
Дополнительные байты не интерпретируются.

### 7.4.8. `endSession` (code `0x07`)

**Payload:** `[07][..optional..]` (переменная длина).  
Дополнительные байты не интерпретируются.

### 7.4.9. `cancelled` (code `0x08`)

**Payload:** `[08][..optional..]` (переменная длина).  
Дополнительные байты не интерпретируются.

### 7.4.10. `peripheralId` (code `0x09`)

**Payload (полный):** `[09][mfg3][serial12][model12][ver2][opt4]`

| Поле | Размер | Описание |
|------|-----|----------|
| `manufacturer` | 3 байта ASCII | Производитель |
| `serial` | 12 байт ASCII | Серийный номер |
| `model` | 12 байт ASCII | Модель |
| `swVersion` | 2 байта BCD | Версия ПО |
| `optionalFeatureBits` | 4 байта | Опции (может отсутствовать) |

### 7.4.11. `malfunction` (code `0x0A`)

**Payload:** `[0A][EE][SS]` (3 байта).

| Поле | Размер | Описание |
|------|-----|----------|
| `errorType` | 5 бит | Старшие 5 бит `EE` |
| `subcode` | 11 бит | Младшие 3 бита `EE` + `SS` |

### 7.4.12. `commandOutOfSequence` (code `0x0B`)

**Payload:** `[0B][badCmd]` (2 байта).

| Поле | Размер | Описание |
|------|-----|----------|
| `badCmd` | 1 байт | Код команды вне последовательности |

### 7.4.13. `revalueApproved` (code `0x0D`)

**Payload:** `[0D][AA][AA]` (3 байта).

| Поле | Размер | Описание |
|------|-----|----------|
| `amountScaled` | 2 байта | Сумма (u16) |

### 7.4.14. `revalueDenied` (code `0x0E`)

**Payload:** `[0E]` (1 байт).

### 7.4.15. `revalueLimitAmount` (code `0x0F`)

**Payload:** `[0F][LL][LL]` (3 байта).

| Поле | Размер | Описание |
|------|-----|----------|
| `limitScaled` | 2 байта | Лимит (u16) |

# 8. Масштабирование денег

Модуль хранит `readerConfig` после `setupConfig()` и предоставляет:

- `realToScaled(real)` → целое значение по формуле MDB:
  - `scaled = real * 10^decimalPlaces / scalingFactor`
- `scaledToReal(scaled)` → обратное преобразование:
  - `real = scaled * scalingFactor / 10^decimalPlaces`

Если `readerConfig` не задан, будет `ProtocolError` с кодом `NO_CFG`.

---

# 9. Ошибки и предупреждения

## 9.1. ProtocolError (code)

- `BAD_CASHLESS_NUMBER`
- `NO_PORT_PATH`
- `NO_SERIALPORT`
- `NOT_OPEN`
- `RX_NOT_HEX`
- `RANGE_U16`, `RANGE_U32`
- `BAD_READER_CONFIG_ACTIVITY`
- `INTERNAL_PENDING`
- `BRIDGE_NAK`
- `TIMEOUT`
- `BAD_CFG_HDR`
- `BAD_FEATURE_LEVEL`, `BAD_COLUMNS`, `BAD_ROWS`, `BAD_DISPLAY_TYPE`
- `BAD_PRICE`
- `NO_CFG`

## 9.2. Предупреждения (`warn`)

Типы предупреждений:

- `chkMismatch` — CHK не совпал
- `multiAckWriteFailed` — не удалось отправить block ACK
- `multiKickLimitReached` — нет ответа на Request ID
- `multiKickLoopFailed` — сбой цикла "kick"

---

# 10. Сценарий Product First (Always Idle)

```text
VMC (this module)                 Reader
    | readerEnable                  |
    |------------------------------>|
    | vendRequest(price, item)      |
    |------------------------------>|
    |        vendApproved           |
    |<------------------------------|
    | (vendSuccess / vendFailure)   |
    |------------------------------>|
    | sessionComplete               |
    |------------------------------>|
    | endSession                    |
    |<------------------------------|
    | readerDisable                 |
    |------------------------------>|
```

Для корректной работы Product First рекомендуется включать
`OPT_FEATURE_ALWAYS_IDLE` через `expansionEnableOptions()`.

## 10.1. Успешная продажа (Product First)

1) `readerEnable()`  
2) `vendRequest({ priceScaled, itemNumber })`  
3) Ожидать `vendApproved`  
4) После выдачи: `vendSuccess(itemNumber)`  
5) `sessionComplete()`  
6) `readerDisable()`

## 10.2. Отказ оплаты

1) `readerEnable()`  
2) `vendRequest(...)`  
3) Получен `vendDenied`  
4) (опционально) `vendCancel()`  
5) `sessionComplete()`  
6) `readerDisable()`

## 10.3. Отмена пользователем

1) `readerEnable()`  
2) `vendRequest(...)`  
3) Получен `sessionCancelRequest` или `cancelled`  
4) `vendCancel()`  
5) `sessionComplete()`  
6) `readerDisable()`

## 10.4. Request ID (multi-message)

1) `expansionRequestId()`  
2) Модуль собирает блоки, посылая `0x00` после каждого ответа  
3) Возвращается объект `peripheralId` (см. 6.7.6)
