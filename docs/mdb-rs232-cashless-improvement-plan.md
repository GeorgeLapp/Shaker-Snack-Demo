# План доработок модуля MDB-RS232 Cashless (Wafer) до полного соответствия спецификации v3.2

Дата: 2 февраля 2026

Документы и код:
- Спецификация: `docs/mdb-rs232-cashless-full-doc-rev3_2.md` (версия 3.2, декабрь 2025)
- Модуль: `back/src/services/mdb-rs232-cashless.mjs`
- Интеграция: `back/src/services/paymentDevice.js`

Цель: добиться ПОЛНОГО и ТОЧНОГО соответствия спецификации (включая optional-функции MDB 4.2, если они объявлены ридером), без неявных допущений и с формализованным поведением при ошибках/таймаутах.

---

## 0. Критерии полного соответствия (Definition of Done)

1) Все форматы пакетов (TX/RX) совпадают со спецификацией по длинам, полям и CHK.
2) Любой Reply Data корректно валидируется по CHK (если CHK должен присутствовать).
3) Все Activity-форматы (9.1.x) корректно парсятся, включая optional (10 10/11/12/13).
4) Все обязательные команды (8.x) реализованы; optional команды доступны через API (хотя бы raw).
5) Поведение VMC (keep-alive, offline, recovery) реализовано строго по правилам Z7 и описанным сценариям.
6) Интеграция не нарушает порядок команд (state-machine защищает от out-of-sequence).
7) Есть тесты (unit + transport-sim) на ключевые форматы и крайние случаи.

---

## 1. Матрица соответствия (Spec → Код → Изменения)

### 1.1 RS232 и формат RX/TX (Раздел 2)
- Уже есть: RAW TX, ASCII-HEX RX, CRLF, trim.
- Доработка:
  - зафиксировать правило хвостового пробела (0x20) и единый парсер;
  - лимит длины строки и корректная обработка частичных строк;
  - классификация пакетов: Activity (DeviceID) vs Reply Data (без DeviceID) vs ACK/NAK.

### 1.2 Reply Data и CHK (Раздел 6 + 8.4/8.14/8.15)
- Добавить универсальную проверку CHK (Reader Config, Peripheral ID, Revalue Limit).
- Для однобайтовых reply (0D/0E) CHK не ожидается.

### 1.3 Activity (Раздел 9.1)
- Уточнить форматы Just Reset, Reader Config Data, Peripheral ID (activity), Display Request.
- Добавить парсинг optional activity: 10 10/11/12/13.

### 1.4 Команды (Раздел 8)
- Добавить: SETUP Max/Min 32-bit + Currency Code, CASH Sale, Revalue Limit Reply handling, Revalue Request Reply handling, optional EXPANSION (Time/Date, User File, Data Entry).

### 1.5 Keep-alive/offline/recovery (Раздел “Keep-Alive”)
- Реализовать lastSeen, polling, offline detection, recovery flow по Z7.

---

## 2. Транспортный уровень и базовая классификация сообщений

### 2.1 RX парсер ASCII-HEX
- Подтвердить, что `.trim()` применяется ко всей строке перед split.
- Добавить защиту от слишком длинных строк (fail fast + warn).
- Гарантировать, что при неполной CRLF строке буфер корректно копится.

**Acceptance:** корректный парсинг строк с хвостовым `0x20` и без него; корректное восстановление после мусора.

### 2.2 Классификация пакетов
- Входящие данные разделять на:
  - ACK (00) и NAK (FF)
  - Reply Data (без DeviceID, многобайтные с CHK)
  - Activity (DeviceID 10/60)
  - Banner/текст
- Любое входящее событие обновляет `lastSeenTimestamp`.

**Acceptance:** лог событий/таймстампов обновляется на ACK/NAK/Reply/Activity.

---

## 3. CHK и обработка Reply Data

### 3.1 Универсальная CHK-валидация
- Встроить helper `validateChk(bytes)`.
- Применить:
  - Reader Config Reply (01 ... CHK)
  - Peripheral ID Reply (09 ... CHK)
  - Revalue Limit Reply (0F ... CHK)
- При mismatch:
  - emit `warn` + пометка `chkOk=false`
  - опционально `failOnBadChk` (конфиг).
- Для `SETUP Config Reply` требовать полную длину 9 байт; короткий ответ считать несовместимым (разрешить только в режиме совместимости).

**Acceptance:** каждый Reply Data содержит `chk` и `chkOk` (если CHK ожидается).

### 3.2 Multi-message Peripheral ID
- Собирать до полной длины (30+CHK или 34+CHK) с учётом 0x09.
- Отправлять 00 ACK **после каждого блока**.
- Не завершать до получения CHK и его проверки.

**Acceptance:** корректный сбор полного Peripheral ID при 2+ блоках.

---

## 4. Activity data: точные форматы и исправления

### 4.1 Just Reset (10 00 / 60 00)
- Исправить обработку: событие всегда 2 байта, без дополнительных 00.
- Упростить `isJustReset=true` по факту code=00.

### 4.2 Reader Config Data Activity (10 01 01 Z2..)
- Формат содержит **двойной 01**: `10 01 01 Z2 Z3 ...`.
- Исправить парсинг: отделить activity code и payload reply.

### 4.3 Display Request (10 02 TT <data>)
- Длина текста строго `columns × rows`.
- Хранить `vmcDisplayColumns` и `vmcDisplayRows` из `SETUP Config Data`, так как в Reader Config эти поля не возвращаются.
- Если columns/rows = 0 → событие игнорируется или маркируется `unsupportedDisplay`.
- Если текст длинее/короче → trim/pad + warn.

### 4.4 Begin Session (10 03 ...)
- Форматы:
  - Level1: `F1 F2`
  - Level2/3: `F1 F2 M1 M2 M3 M4 PT PD1 PD2`
  - Expanded: `F1 F2 F3 F4 M1 M2 M3 M4 PT PD1 PD2 L1 L2 C1 C2 OPT`
- Ввести структуру `paymentMediaId`, `paymentType`, `paymentData`, `language`, `currency`, `options`.

### 4.5 Vend Approved (10 05)
- 16/32-бит сумма + `isToken = 0xFFFFFFFF`.

### 4.6 Malfunction/Error (10 0A EE SS)
- Исправить: `errorType = EE >> 4`, `subcode = ((EE & 0x0F) << 8) | SS`.
- Сопоставлять типы ошибок с таблицей.

### 4.7 Command Out of Sequence (10 0B)
- Для Level 2/3: поле `CC` = code состояния.
- Добавить `stateCode` и `stateName`.

### 4.8 Peripheral ID Activity (10 09 09 ...)
- Формат содержит 09 как activity code и затем 09 как Reply header.
- Исправить парсинг, чтобы mfg не сдвигался.

### 4.9 Revalue Approved/Limit Activity (10 0D/0F)
- При длине 5 байт → 32-bit decode.

### 4.10 Optional activity (10 10/11/12/13)
- 10 10 User File Data → raw payload event.
- 10 11 Time/Date Request → raw payload event.
- 10 12 Data Entry Request → raw payload event.
- 10 13 Data Entry Cancel → raw payload event.

**Acceptance:** все activity коды 9.1.x корректно распознаны и оформлены событиями.

---

## 5. Команды и Reply Data: полная реализация

### 5.1 SETUP Config Data (11 00)
- Оставить, но зафиксировать:
  - Y2 = feature level
  - Y3/Y4 = columns/rows
  - Y5 = display type (000/001/010)

### 5.2 SETUP Max/Min Price 16-bit (11 01)
- Оставить.

### 5.3 SETUP Max/Min Price 32-bit + Currency
- Добавить `setupMaxMinPrices32({ maxPriceScaled, minPriceScaled, currencyCodeBcd })`.
- Проверка currencyCode (BCD ISO 4217).
- Используется только если enabled b1/b2.

### 5.4 EXPANSION Request ID (17 00)
- В reply учитывать CHK, multi-message, optional bits.
- Сохранять `optionalFeatureBits` и `supports`.
- **Передавать VMC идентификацию в полном формате 31 байт:**
  - `CMD` (17/67) + `SUB` (00)
  - `MFG` (3 ASCII)
  - `SERIAL` (12 ASCII, padding до 12)
  - `MODEL` (12 ASCII, padding до 12)
  - `SWVER` (2 байта packed BCD)
- Добавить конфигурацию VMC ID (manufacturer/serial/model/swVersion) в конструктор модуля.
- Реализовать строгую валидацию длины и допустимых ASCII-символов.

### 5.5 EXPANSION Enable Options (17 04)
- Добавить helper `buildEnableOptions(wantMask)`:
  - effectiveMask = wantMask & optionalFeatureBits
- Хранить `enabledOptions` (b0..b5).

### 5.6 READER Control (14 00/01/02)
- Оставить.

### 5.7 VEND Request (13 00)
- Формат 16/32 зависит от enabled b1/b2.
- Не позволять 32-bit без enabled b1/b2.

### 5.8 VEND Cancel / Success / Failure / Session Complete
- Оставить, но связать со state-machine.
- По спецификации ожидать ACK/NAK (без режима молчания); режим совместимости с silence сделать опциональным.

### 5.9 CASH Sale (13 05)
- Реализовать 16-bit и Expanded (32-bit + currency).

### 5.10 REVALUE Limit Request (15 01)
- Ожидать Reply Data:
  - 0F L1 L2 CHK (16-bit)
  - 0F L1..L4 CHK (32-bit)
  - 0E (single byte) = denied

### 5.11 REVALUE Request (15 00)
- Формат 16/32 зависит от enabled b1/b2.
- Ожидаемый reply: 0D или 0E (single byte), либо activity 10 0D/0E.

### 5.12 Optional EXPANSION ответы (raw API)
- Time/Date Response
- User File Response
- Data Entry Response

### 5.13 Таймауты команд по Z7
- После `SETUP Config Data` получать `Z7` и:
  - выставлять `commandTimeoutMs = max(5, Z7) * 1000` для команд с Reply Data;
  - выставлять `multiBlockTimeoutMs >= max(5, Z7) * 1000` для EXPANSION Request ID;
  - использовать `max(5, Z7)` как offline threshold (keep-alive).

**Acceptance:** полный набор команд из раздела 8 (включая optional) доступен через API.

---

## 6. Optional Feature Bits и режимы

### 6.1 Определение capability и active mode
- Из Peripheral ID сохранять:
  - supportedBits (F1..F4)
  - enabledBits (по Enable Options)
- Ввести флаги:
  - is32bit
  - isExpandedCurrency
  - alwaysIdle
  - negativeVend
  - dataEntry
  - fileTransport

### 6.2 Привязка форматов к активным флагам
- Begin Session/ Vend/ Revalue/ Cash Sale форматы выбираются по is32bit/isExpandedCurrency.
- Always Idle влияет на порядок VEND Request и Begin Session.

---

## 7. State-machine (протокольная корректность)

### 7.1 Состояния
- Inactive, Disabled, Enabled, Session Idle, Vend, Revalue, Negative Vend, Data Entry.

### 7.2 Переходы
- RESET → Inactive
- SETUP → Disabled
- READER Enable → Enabled
- Begin Session → Session Idle
- VEND Request → Vend
- Vend Approved/Denied → Vend/Session Idle
- Session Complete → Enabled
- Revalue Request → Revalue
- Data Entry Request → Data Entry
- Session Cancel Request → обязательный `SESSION Complete`, затем ожидание `End Session`
- Vend Denied → обязательный `SESSION Complete`
- Cancelled → обязательный `SESSION Complete`

### 7.3 Guard-валидация
- Блокировать отправку команд в неправильном состоянии (emit error + no TX).

**Acceptance:** ни одна команда не отправляется «не в том состоянии».

---

## 8. Keep-alive, lastSeen, offline

### 8.1 lastSeen
- Обновлять на любое входящее ACK/NAK/Reply/Activity.

### 8.2 pollInterval
- pollInterval = min(1000ms, Z7/2).

### 8.3 Offline detection
- if now - lastSeen > Z7 → offline.

### 8.4 Recovery policy
- NAK подряд N раз → recovery.
- timeout > Z7 → recovery.
- Malfunction / Command Out of Sequence / Just Reset → recovery.

---

## 9. Recovery / Init Flow

### 9.1 Init flow
1. RESET
2. SETUP Config
3. SETUP Max/Min 16
4. EXPANSION Request ID
5. EXPANSION Enable Options
6. (if 32-bit) SETUP Max/Min 32
7. READER Enable (или Disable, если idle)

### 9.2 Recovery flow
- Повторить init flow с retry/backoff (N попыток).
- При повторных ошибках → degrade mode.

---

## 10. Интеграция в paymentDevice.js

### 10.1 Always Idle
- Если enabled b5 → разрешать VEND Request до Begin Session.
- Если нет → ждать Begin Session.

### 10.2 32-bit режим
- Если enabled b1/b2 → переключить scalePrice на 32-bit и вызвать setupMaxMinPrices32.

### 10.3 Recovery events
- Блокировать новые сессии при offline/recovery.

---

## 11. Тесты

### 11.1 Unit tests
- Parsing ASCII-HEX, banner.
- Begin Session (L1/L2/L3 expanded).
- Peripheral ID 30/34 + CHK.
- Revalue Limit Reply 0F/0E.
- Revalue Request Reply 0D/0E.
- Display Request длина.
- Optional activity 10 10/11/12/13.

### 11.2 Transport-sim tests
- Multi-message Peripheral ID (2+ блоков).
- Timeout / NAK / recovery.
- Keep-alive polling и offline.

---

## 12. Документация и наблюдаемость

- Обновить API драйвера (новые команды/события/флаги).
- Добавить логирование: chkMismatch, offline, recovery attempts, enabledOptions.
- Описать init-flow, keep-alive, recovery в docs.

---

## 13. Декомпозиция по этапам

### 13.1 Этап 1 (блокирующий) — максимально подробные задачи

**13.1.1 CHK-валидация Reply Data (обязательная, строгая)**
- Где менять:
  - `mdb-rs232-cashless.mjs`: рядом с `mdbChk8()` добавить helper `validateChk(buf, expectLenRange, context)` или аналог.
  - `_sendAndWait()` → `acceptReply()` для типов `READER_CONFIG`, `MULTI_PERIPHERAL_ID`, нового `REVALUE_LIMIT`, и обработчиков reply 0D/0E.
- Что сделать:
  1) Вынести общую функцию: 
     - вход: `buf` (полный reply, включая CHK);
     - выход: `{ chk, calc, chkOk, payload }`, где `payload = buf.slice(0, -1)` и `chk = buf.at(-1)`.
  2) В каждом месте, где ожидается Reply Data, **обязательно** вызывать валидацию CHK.
  3) При `chkOk=false`:
     - эмитить `warn` с контекстом (`where`, `expected`, `got`, `raw`);
     - по умолчанию **не принимать** данные (reject) в режиме strict; 
     - опционально конфиг `allowBadChk` (если нужен бэкапный режим).
- Технические детали:
  - Для однобайтовых reply (`0D`/`0E`) CHK не ожидается.
  - Reply Data всегда **без DeviceID**.
  - `SETUP Config Reply` валиден только длиной 9 байт (01 Z2..Z8 CHK); более короткий reply — ошибка (если не включён режим совместимости).
- Acceptance:
  - Любой reply, где CHK обязателен, даёт `chkOk=true` или корректно отклоняется.

**13.1.2 Multi-message Peripheral ID (сбор до CHK)**
- Где менять:
  - `_sendAndWait()` → ветка `expect === "MULTI_PERIPHERAL_ID"`.
  - `_decodePeripheralId()` (добавить возможность принимать `payload` без CHK).
- Что сделать:
  1) Определить ожидаемую длину: 
     - Level1/2: `30 + CHK = 31` байт (с 0x09).
     - Level3: `34 + CHK = 35` байт (с 0x09).
  2) Накапливать байты **до полной длины**, включая CHK.
  3) После каждого полученного блока отправлять `BRIDGE_BLOCK_ACK` до тех пор, пока длина буфера < ожидаемой.
  4) Когда длина достигнута:
     - валидировать CHK;
     - убрать CHK;
     - декодировать payload (09 + поля).
- Технические детали:
  - В некоторых мостах 0x09 может повторяться в начале каждого блока → удалять только повторяющийся 0x09 не в первом блоке.
  - Если неизвестно, Level1/2 или Level3 → пытаться сначала 31, потом 35; валидация CHK определяет корректный формат.
- Acceptance:
  - Peripheral ID собирается корректно для 1+ блоков.
  - CHK валидируется и влияет на успешность.

**13.1.3 Reply Data для REVALUE LIMIT (0F ... CHK / 0E)**
- Где менять:
  - `_sendAndWait()` → добавить `expect: "REVALUE_LIMIT"`.
  - `revalueLimitRequest()` → использовать новый expect вместо `ACK_OR_SILENCE`.
- Что сделать:
  1) Добавить обработку reply:
     - `0x0E` → denied (single byte).
     - `0x0F ... CHK` → limit amount.
  2) Декодирование:
     - 16-bit: `0F L1 L2 CHK` → `limitScaled = u16be(L1, L2)`.
     - 32-bit: `0F L1 L2 L3 L4 CHK` → `limitScaled = u32be(...)`.
  3) Строгая проверка длины в зависимости от `isExpandedCurrency`/`is32bit`:
     - если режим 16-bit, длина должна быть 4;
     - если режим 32-bit, длина должна быть 6.
  4) Возвращать объект `{ ok, denied, limitScaled, is32bit, raw, chkOk }`.
- Acceptance:
  - Команда `revalueLimitRequest()` возвращает данные строго по spec.

**13.1.4 Reply Data для REVALUE REQUEST (0D / 0E)**
- Где менять:
  - `_sendAndWait()` → добавить `expect: "REVALUE_REQUEST"`.
  - `revalueRequest()` → использовать новый expect.
- Что сделать:
  1) Принять однобайтовый reply:
     - `0x0D` → approved
     - `0x0E` → denied
  2) Если reply не пришёл, но затем пришло activity `10 0D/0E` → считать как завершение команды.
  3) Возвращать объект `{ approved, denied, via: "reply"|"activity" }`.
- Acceptance:
  - `revalueRequest()` отрабатывает по reply data как в спецификации.

**13.1.5 Begin Session — точные форматы**
- Где менять:
  - `_decodeBeginSession(payload)`.
- Что сделать:
  1) Проверять длины строго:
     - Level1: 3 байта (`03 F1 F2`)
     - Level2/3: 10 байт (`03 F1 F2 M1 M2 M3 M4 PT PD1 PD2`)
     - Expanded: 17 байт (`03 F1 F2 F3 F4 M1 M2 M3 M4 PT PD1 PD2 L1 L2 C1 C2 OPT`)
  2) Декодировать поля:
     - `fundsScaled` (u16/u32)
     - `paymentMediaId` (u32)
     - `paymentType` (u8)
     - `paymentData` (u16)
     - `language` (2 ASCII)
     - `currency` (BCD u16)
     - `options` (u8)
  3) Обозначать "unknown" значения:
     - funds = 0xFFFF/0xFFFFFFFF → `fundsUnknown=true`
     - paymentMediaId = 0xFFFFFFFF → `paymentMediaIdUnknown=true`
- Acceptance:
  - Begin Session полностью соответствует разделу 9.1.4.

**13.1.6 Malfunction/Error — корректный разбор EE SS**
- Где менять:
  - `_parseCashlessActivity()` → ветка `POLL_MALFUNCTION`.
- Что сделать:
  1) `errorType = (EE >> 4) & 0x0F`
  2) `subcode = ((EE & 0x0F) << 8) | SS`
  3) Добавить `errorTypeName` по таблице.
- Acceptance:
  - Совпадает с описанием 9.1.11.

**13.1.7 Command Out of Sequence — корректный CC**
- Где менять:
  - `_parseCashlessActivity()` → ветка `POLL_CMD_OUT_OF_SEQUENCE`.
- Что сделать:
  1) Для Level 1 (длина 2 байта) оставить `stateCode=null`.
  2) Для Level 2/3:
     - `stateCode = payload[1]`
     - `stateName = map[01..07]`
  3) Поле `badCmd` удалить/переименовать → `stateCode`.
- Acceptance:
  - Событие соответствует 9.1.12.

**13.1.8 Reader Config Data Activity (двойной 01)**
- Где менять:
  - `_parseCashlessActivity()` → ветка `POLL_READER_CONFIG_DATA`.
- Что сделать:
  1) Activity payload имеет вид `01 01 Z2 Z3 ...` (после DeviceID и Activity Code).
  2) Исправить `_decodeReaderConfigDataNoChk()` так, чтобы распознавать и пропускать второй `0x01`.
  3) Гарантировать, что `Z2..Z8` читаются корректно.
- Acceptance:
  - `readerConfig` распознаётся и сохраняется при activity без CHK.

**13.1.9 Peripheral ID Activity (10 09 09 ...)**
- Где менять:
  - `_parseCashlessActivity()` → `POLL_PERIPHERAL_ID`.
  - `_decodePeripheralId()` использовать payload с повторным 0x09 без сдвига.
- Что сделать:
  1) Если payload начинается с `09 09`, удалить только Activity-кодовый 09, оставить Reply-09.
  2) Декодировать поля как в Reply Data (но без CHK).
- Acceptance:
  - Activity Peripheral ID совпадает с разделом 9.1.10.

**13.1.10 EXPANSION Request ID — полный формат VMC ID (TX)**
- Где менять:
  - `expansionRequestId()` и вспомогательные энкодеры в `mdb-rs232-cashless.mjs`.
  - конструктор класса: добавить `vmcId` в опции.
- Что сделать:
  1) Реализовать сбор **31-байтной команды**:
     - `CMD` (0x17/0x67) + `SUB` (0x00)
     - `MFG` (3 ASCII)
     - `SERIAL` (12 ASCII)
     - `MODEL` (12 ASCII)
     - `SWVER` (2 байта packed BCD)
  2) Правила заполнения строк:
     - если длина меньше 12 → добивать справа `0x20` (space) либо `0x30` (0);
     - допускаются ASCII буквы/цифры и пробел.
  3) SWVER:
     - строка версии (например `"1.00"` / `"12.34"`) → packed BCD `V1 V2`;
     - валидировать, что каждая ниббл-цифра 0..9.
  4) Добавить дефолтные значения (например, `MFG="VMC"`, `SERIAL="000000000000"`, `MODEL="SHKR-SNACK"`, `SWVER="0.01"`), но позволить переопределять через опции/ENV.
- Acceptance:
  - Request ID всегда отправляется с корректной идентификацией VMC по разделу 8.4 (A1–A4).

**13.1.11 Таймауты на основе Z7**
- Где менять:
  - `_decodeReaderConfigReply()` → сохранить `maxResponseTimeSec` (Z7).
  - состояние класса: хранить `z7Seconds`, обновлять `commandTimeoutMs`.
- Что сделать:
  1) После получения Reader Config Data установить `this.z7Seconds = maxResponseTimeSec`.
  2) Рассчитать `effectiveZ7 = Math.max(5, z7Seconds || 0)` (сек).
  3) Обновить `this.commandTimeoutMs = effectiveZ7 * 1000` для Reply Data команд.
  4) Для multi-message выставлять `multiBlockTimeoutMs` не ниже `effectiveZ7 * 1000`.
  5) Применять эти же правила при получении Reader Config Data как activity.
- Acceptance:
  - Таймауты команд соответствуют Z7 из спецификации.

**13.1.12 ACK vs Silence (строго по spec)**
- Где менять:
  - `setupMaxMinPrices()`, `readerCancel()`, `vendCancel()`, `vendSuccess()`, `vendFailure()`, `sessionComplete()` и аналогичные.
- Что сделать:
  1) По умолчанию ждать ACK/NAK (строго), silence → timeout/error.
  2) Ввести флаг совместимости (например, `allowSilentAck`) для реальных устройств.
- Acceptance:
  - По умолчанию поведение строго соответствует таблице команд.

**13.1.13 Сохранение исходных ASCII полей Peripheral ID**
- Где менять:
  - `_decodePeripheralId()`.
- Что сделать:
  1) Не использовать `.trim()` для serial/model; сохранять оригинальные 12 байт.
  2) Возвращать оба варианта: `serialRaw`, `serialTrimmed`, `modelRaw`, `modelTrimmed`.
- Acceptance:
  - Идентификация ридера соответствует фиксированным ASCII полям из spec.

**13.1.14 Display Request — строгая длина и хранение размеров**
- Где менять:
  - `setupConfig()` (сохранение `columns/rows` в состоянии драйвера).
  - `_parseCashlessActivity()` → ветка `POLL_DISPLAY_REQUEST`.
- Что сделать:
  1) Сохранять `vmcDisplayColumns`/`vmcDisplayRows` при `setupConfig()` (и обновлять при повторном SETUP).
  2) В Display Request вычислять `expectedLen = columns * rows`.
  3) Если `expectedLen = 0` → помечать `unsupportedDisplay` и не обрабатывать текст.
  4) Если длина не совпадает → warn + нормализация (pad/trim).
- Acceptance:
  - Display Request соответствует спецификации по длине и правилам отображения.

### 13.2 Этап 2
32-bit форматы, SETUP Max/Min 32, Cash Sale, optional bits.

**13.2.1 32-bit денежные форматы (общая поддержка)**
- Где менять:
  - `vendRequest()`, `revalueRequest()`, `vendCashSale()` (новая), `revalueLimitRequest()` (reply parsing).
  - `scaledToReal()` / `realToScaled()` — убедиться в корректной работе для 32-bit.
- Что сделать:
  1) Ввести единый флаг режима: `is32bit` (определяется по enabled options b1/b2).
  2) В командах с денежными полями выбирать длину 16/32 по `is32bit`.
  3) При декодировании reply/activities использовать `decodeU32BE` при длине 5 (0x0D/0x0F и т.п.).
  4) Добавить защиту от выхода за 0xFFFFFFFF в 32-bit режиме.
- Acceptance:
  - Все денежные поля корректно кодируются/декодируются в 16/32-bit режимах.

**13.2.2 SETUP Max/Min Price (32-bit + Currency Code)**
- Где менять:
  - новый метод `setupMaxMinPrices32()` в `mdb-rs232-cashless.mjs`.
- Что сделать:
  1) Формат команды: `11 01 XX XX XX XX YY YY YY YY CC CC` (big-endian).
  2) Добавить валидатор `currencyCodeBcd` (ISO 4217 packed BCD):
     - две пары десятичных цифр, ведущая цифра 1 (как в spec).
  3) Связать вызов с `is32bit` или `isExpandedCurrency`.
- Acceptance:
  - Отправка команды соответствует разделу 8.6 и правильно принимает ACK/NAK.

**13.2.3 CASH Sale (13 05)**
- Где менять:
  - добавить `vendCashSale()` в модуль.
- Что сделать:
  1) 16-bit формат: `13 05 A1 A2` (scaled).
  2) Expanded: `13 05 P1 P2 P3 P4 I1 I2 C1 C2`.
  3) Вернуть ACK/NAK, добавить защиту state-machine.
- Acceptance:
  - Cash Sale доступен в API и соответствует spec.

**13.2.4 Optional Feature Bits (расширение)**
- Где менять:
  - `expansionRequestId()` — сохранение supported bits.
  - `expansionEnableOptions()` — применять маску + хранить enabled bits.
- Что сделать:
  1) Отдельно хранить `supportedBits` и `enabledBits`.
  2) Проверять, что enabled ⊆ supported; иначе warn или reject.
  3) Обновить флаги: `alwaysIdle`, `negativeVend`, `dataEntry`, `fileTransport`.
- Acceptance:
  - Flags строго соответствуют optional bits из Peripheral ID.

**13.2.5 VEND Request до Begin Session (Always Idle)**
- Где менять:
  - `paymentDevice.js` и state-machine.
- Что сделать:
  1) Если `alwaysIdle=true`, разрешить VEND Request до Begin Session.
  2) Иначе блокировать и ждать Begin Session (включая таймаут).
- Acceptance:
  - Поведение соответствует разделу VEND Request (Product First / Always Idle).

### 13.3 Этап 3
Keep-alive/offline/recovery + state-machine.

**13.3.1 State-machine (протокольные состояния)**
- Где менять:
  - `mdb-rs232-cashless.mjs`: добавить объект состояния (enum) + переходы.
- Что сделать:
  1) Ввести состояния: Inactive, Disabled, Enabled, Session Idle, Vend, Revalue, Negative Vend, Data Entry.
  2) Обновлять состояние на событиях Activity и после команд.
  3) Guard-логика: перед отправкой команды проверять допустимость состояния.
- Acceptance:
  - Любая команда в неправильном состоянии блокируется (emit error, no TX).

**13.3.2 lastSeen и keep-alive polling**
- Где менять:
  - `_dispatchRx()`, `_sendAndWait()` и обработчики activity.
  - Добавить `startKeepAlive()` / `stopKeepAlive()`.
- Что сделать:
  1) `lastSeenTimestamp` обновлять на ACK/NAK/Reply/Activity.
  2) Рассчитать `pollInterval = min(1000ms, Z7/2)`.
  3) Keep-alive команда: `READER Enable`.
  4) Отключать keep-alive при активной сессии.
- Acceptance:
  - Модуль регулярно шлёт keep-alive и не мешает транзакциям.

**13.3.3 Offline detection и recovery triggers**
- Где менять:
  - Таймер мониторинга offline (фоновой loop).
- Что сделать:
  1) Проверять `(now - lastSeen) > Z7` → offline.
  2) При offline → emit event + запуск recovery.
  3) При NAK подряд N раз → recovery.
  4) При Malfunction / Command Out of Sequence / Just Reset → recovery.
- Acceptance:
  - Реализация строго соответствует разделу Keep-alive.

**13.3.4 Recovery / re-init flow**
- Где менять:
  - Новый метод `initFlow()` и `recover()` в модуле.
- Что сделать:
  1) Реализовать полный init flow по spec.
  2) Добавить retry/backoff (N попыток).
  3) Если recovery не удаётся → degrade mode (disable reader).
- Acceptance:
  - При любой критической ошибке модуль возвращается в рабочий режим.

### 13.4 Этап 4
Optional features (Data Entry, Time/Date, User File).

**13.4.1 Data Entry (EXPANSION)**
- Где менять:
  - Добавить API `dataEntryResponse()` (raw или типизированный).
  - Парсинг activity 10 12/10 13.
- Что сделать:
  1) При Data Entry Request формировать событие с payload.
  2) Поддержать отправку ответа по EXPANSION Data Entry.
  3) В state-machine учитывать состояние Data Entry.
- Acceptance:
  - Data Entry optional feature реализована по spec.

**13.4.2 Time/Date Request**
- Где менять:
  - Парсинг activity 10 11.
  - Ответ через EXPANSION Time/Date Response.
- Что сделать:
  1) Распарсить payload в raw.
  2) Реализовать метод `timeDateResponse()` (raw).
- Acceptance:
  - VMC способен ответить на запрос времени/даты.

**13.4.3 User File Data**
- Где менять:
  - Парсинг activity 10 10.
  - Ответы через EXPANSION User File Response.
- Что сделать:
  1) Передавать payload через событие `userFileData`.
  2) Добавить API для ответа/записи данных.
- Acceptance:
  - User File Data поддерживается (raw API).

### 13.5 Этап 5
Интеграция + тесты + документация.

**13.5.1 Интеграция paymentDevice.js**
- Где менять:
  - `paymentDevice.js` — init flow, keep-alive, guard-логика.
- Что сделать:
  1) Подключить `initFlow()` при старте.
  2) Использовать `enabledBits` для выбора Always Idle/32-bit.
  3) Дождаться Begin Session, если Always Idle выключен.
  4) Реагировать на offline/recovery.
- Acceptance:
  - Интеграция не нарушает порядок протокола.

**13.5.2 Тесты (unit + transport-sim)**
- Где менять:
  - Создать тесты в `back/test` или аналогичной папке.
- Что сделать:
  1) Unit tests на парсер и форматы сообщений.
  2) Transport-sim: multi-message, timeout, recovery.
  3) Проверка state-machine guard.
- Acceptance:
  - Автотестами покрыты критичные сценарии.

**13.5.3 Документация и наблюдаемость**
- Где менять:
  - `docs/mdb-rs232-cashless.md` + `docs/README.md`.
- Что сделать:
  1) Добавить описание новых API (команды/события).
  2) Документировать keep-alive/offline/recovery.
  3) Описать optional features и ограничения.
- Acceptance:
  - Документация отражает фактическое поведение модуля.

---

## 14. Контрольные примеры (для ручной валидации)

- Peripheral ID (Level 3): 09 R1..R3 S1..S12 N1..N12 V1 V2 F1..F4 CHK
- Begin Session (Expanded): 10 03 F1..F4 M1..M4 PT PD1 PD2 L1 L2 C1 C2 OPT
- Revalue Limit Reply 32-bit: 0F L1 L2 L3 L4 CHK
- Revalue Request Reply: 0D или 0E
- Display Request: 10 02 TT <columns×rows ASCII>

---

Это максимально подробная карта работ. После подтверждения могу разбить в отдельные тикеты и приступить к реализации по этапам.
