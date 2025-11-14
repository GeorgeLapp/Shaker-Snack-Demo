// vending-controller.mjs

/**
 * Модуль работы с контроллером вендингового автомата по UART/RS-232.
 *
 * Реализует:
 *  - Формирование 6-байтных команд (запросов) по протоколу контроллера.
 *  - Приём и валидацию 5-байтных ответов (статус, данные, checksum).
 *  - Декодирование кодов ошибок механики и фотодатчика.
 *  - Набор прикладных методов (выдача, свет, дверь, температура и т.п.).
 *  - Опрос наличия всех каналов с настраиваемой задержкой между каналами.
 *
 * ВАЖНО:
 *  - Конвейеризация запросов запрещена — всегда «один запрос → один ответ».
 *  - Любое нарушение формата кадра (длина, checksum) считается ошибкой протокола.
 *  - Сервисные/заводские команды (0x67, 0xE0..0xE3) здесь намеренно не реализованы.
 */

import { SerialPort } from 'serialport';

/* ========================================================================== */
/*                             БАЗОВЫЕ КОНСТАНТЫ                              */
/* ========================================================================== */

/** Максимальное значение байта. */
const BYTE_MAX = 0xff;

/** Количество байт в кадре запроса. */
const REQUEST_FRAME_LENGTH = 6;

/** Количество байт в кадре ответа. */
const RESPONSE_FRAME_LENGTH = 5;

/** Значение байта группы (GroupID) по умолчанию. */
const GROUP_ID_DEFAULT = 0x00;

/** Байт "заглушка" для отсутствующего параметра команды (SubCMD). */
const SUPP_NO_PARAM = 0x55;

/** Инверсия байта заглушки (0xFF - 0x55 = 0xAA). */
const SUPP_NO_PARAM_COMPLEMENT = 0xaa;

/** Байт "вкл" для некоторых команд (например, охлаждение, стекло). */
const SUPP_ON = 0x01;

/** Байт "выкл" для некоторых команд. */
const SUPP_OFF = 0x00;

/** Специальное значение параметра "с контролем падения" (фотодатчик включён). */
const SUPP_DROP_CHECK_ENABLED = 0xaa;

/** Специальное значение параметра "без контроля падения". */
const SUPP_DROP_CHECK_DISABLED = 0x55;

/** Статус ответа: успех. */
const STATUS_OK = 0x5d;

/** Статус ответа: ошибка контроллера. */
const STATUS_ERROR = 0x5c;

/** Быстрый тайм-аут (дверь, свет, датчики), мс. */
const DEFAULT_FAST_TIMEOUT_MS = 300;

/** Тайм-аут для команд выдачи (механика), мс. */
const DEFAULT_VEND_TIMEOUT_MS = 10_000;

/** Минимальный номер канала. */
const MIN_CHANNEL = 1;

/** Максимальный логический номер канала по протоколу. */
const MAX_LOGICAL_CHANNEL = 80;

/**
 * Максимальное количество физически реализованных каналов
 * в текущей версии контроллера (по спецификации).
 */
const MAX_PHYSICAL_CHANNEL = 60;

/** Базовое значение для кода команды проверки существования канала (ChannelExists). */
const CMD_CHANNEL_EXISTS_BASE = 0x78;

/* -------------------- Коды команд (cmd, байт B2 в запросе) ----------------- */

/** Команда: самотестирование контроллера. */
const CMD_SELF_TEST = 0x64;

/** Команда: один оборот всех каналов (reset all). */
const CMD_RESET_ALL = 0x65;

/** Команда: повтор последнего ответа (без повторения действия). */
const CMD_REPEAT_LAST_REPLY = 0x66;

/** Команда: установить тип канала "ленточный". */
const CMD_SET_CHANNEL_TYPE_BELT = 0x68;

/** Команда: установить тип канала "пружинный". */
const CMD_SET_CHANNEL_TYPE_SPRING = 0x74;

/** Команда: все каналы — пружинные. */
const CMD_SET_ALL_SPRING = 0x75;

/** Команда: все каналы — ленточные. */
const CMD_SET_ALL_BELT = 0x76;

/** Команда: сделать канал одиночным. */
const CMD_MAKE_SINGLE = 0xc9;

/** Команда: объединить два соседних канала в двойной. */
const CMD_MAKE_DOUBLE = 0xca;

/** Команда: все каналы — одиночные. */
const CMD_MAKE_ALL_SINGLE = 0xcb;

/** Команда: включить/выключить термоконтроль. */
const CMD_TEMP_CONTROL_ENABLE = 0xcc;

/** Команда: режим термоконтроля (нагрев/охлаждение). */
const CMD_THERMO_MODE = 0xcd;

/** Команда: установка целевой температуры (setpoint). */
const CMD_SET_SETPOINT = 0xce;

/** Команда: установка гистерезиса. */
const CMD_SET_HYSTERESIS = 0xcf;

/** Команда: температурная компенсация. */
const CMD_SET_COMPENSATION = 0xd0;

/** Команда: длительность дефроста. */
const CMD_SET_DEFROST_MIN = 0xd1;

/** Команда: макс. время работы компрессора. */
const CMD_SET_COMPRESSOR_RUN_MIN = 0xd2;

/** Команда: задержка отключения вентилятора. */
const CMD_SET_FAN_IDLE_OFF_DELAY = 0xd3;

/** Команда: обогрев стекла. */
const CMD_SET_GLASS_HEATER = 0xd4;

/** Команда: чтение температуры. */
const CMD_READ_TEMPERATURE = 0xdc;

/** Команда: управление подсветкой. */
const CMD_SET_LIGHTING = 0xdd;

/** Команда: управление зуммером. */
const CMD_SET_BUZZER = 0xde;

/** Команда: состояние двери. */
const CMD_READ_DOOR = 0xdf;

/** Доп. команда: открыть дверь. */
const CMD_OPEN_DOOR = 0xef;

/** Доп. команда: разблокировать дверь выдачи. */
const CMD_UNLOCK_DOOR = 0xf0;

/** Доп. команда: включить акселерометр (зарезервировано). */
const CMD_ENABLE_ACCELEROMETER = 0xf1;

/* ----------------------- Коды ошибок верхнего уровня ---------------------- */

/**
 * Набор "логических" кодов ошибок модуля.
 * Тексты ошибок — только на английском (по требованию),
 * но комментарии и JSDoc — на русском.
 */
export const ERROR_CODES = Object.freeze({
  PORT_NOT_OPEN: 'PORT_NOT_OPEN',
  COMM_TIMEOUT: 'COMM_TIMEOUT',
  PROTOCOL_BAD_LENGTH: 'PROTOCOL_BAD_LENGTH',
  PROTOCOL_BAD_CHECKSUM: 'PROTOCOL_BAD_CHECKSUM',
  PROTOCOL_UNEXPECTED_STATUS: 'PROTOCOL_UNEXPECTED_STATUS',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  CONTROLLER_ERROR: 'CONTROLLER_ERROR',
});

/** Описания ошибок верхнего уровня (для человека, по-английски). */
const ERROR_DESCRIPTIONS = Object.freeze({
  [ERROR_CODES.PORT_NOT_OPEN]: 'Serial port is not open',
  [ERROR_CODES.COMM_TIMEOUT]: 'Timeout waiting for controller reply',
  [ERROR_CODES.PROTOCOL_BAD_LENGTH]: 'Invalid reply length from controller',
  [ERROR_CODES.PROTOCOL_BAD_CHECKSUM]: 'Checksum validation failed for controller reply',
  [ERROR_CODES.PROTOCOL_UNEXPECTED_STATUS]: 'Unexpected status byte in controller reply',
  [ERROR_CODES.INVALID_ARGUMENT]: 'Invalid method argument',
  [ERROR_CODES.CONTROLLER_ERROR]: 'Controller reported a mechanical or optical error',
});

/* ------------------ Карта кодов ошибок механики и оптики ------------------ */

/**
 * Карта ошибок механики (старшие 4 бита поля data = yyyy).
 * Ключ — целое число 0..15, значение — текст на английском.
 */
const MECHANICAL_ERROR_MAP = Object.freeze({
  0x0: 'Mechanical: OK',
  0x1: 'Mechanical: P-MOSFET short circuit',
  0x2: 'Mechanical: N-MOSFET short circuit',
  0x3: 'Mechanical: motor short circuit',
  0x4: 'Mechanical: motor open circuit',
  0x5: 'Mechanical: motor rotation timeout',
});

/**
 * Карта ошибок фотодатчика (младшие 4 бита поля data = dddd).
 * Ключ — целое число 0..15, значение — текст на английском.
 */
const OPTICAL_ERROR_MAP = Object.freeze({
  0x0: 'Optical: OK',
  0x1: 'Optical: signal present without emitter (false trigger)',
  0x2: 'Optical: no signal when emitter is toggled',
  0x3: 'Optical: constant signal during vend (cannot distinguish normal/failed drop)',
});

/* ========================================================================== */
/*                          ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ                           */
/* ========================================================================== */

/**
 * Вычисление комплемента байта по правилу протокола: comp(x) = (0xFF - x) & 0xFF.
 *
 * @param {number} value - значение байта 0..255
 * @returns {number} комплемент байта 0..255
 */
function complementByte(value) {
  return (BYTE_MAX - (value & BYTE_MAX)) & BYTE_MAX;
}

/**
 * Простой асинхронный "сон" на заданное количество миллисекунд.
 *
 * @param {number} ms - длительность паузы в миллисекундах
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ========================================================================== */
/*                              КЛАСС ОШИБКИ                                  */
/* ========================================================================== */

/**
 * Специализированный класс ошибок модуля.
 *
 * Содержит:
 *  - code      — логический код ошибки (см. ERROR_CODES).
 *  - message   — человекочитаемое описание ошибки на английском.
 *  - details   — объект с дополнительной информацией (например, биты ошибок механики).
 *  - rawReply  — при наличии, "сырой" ответ контроллера (Buffer).
 */
export class VendingControllerError extends Error {
  /**
   * @param {string} code - один из ERROR_CODES
   * @param {string} message - текст ошибки на английском
   * @param {object} [details] - дополнительные данные
   * @param {Buffer|null} [rawReply] - исходный кадр ответа, если есть
   */
  constructor(code, message, details = {}, rawReply = null) {
    super(message);
    this.name = 'VendingControllerError';
    this.code = code;
    this.details = details;
    this.rawReply = rawReply;
  }
}

/* ========================================================================== */
/*                        ОСНОВНОЙ КЛАСС ДЛЯ РАБОТЫ С UART                    */
/* ========================================================================== */

/**
 * Класс инкапсулирует работу с UART-портом и протоколом контроллера автомата.
 *
 * Пример использования:
 *
 * ```js
 * import { VendingController } from './vending-controller.mjs';
 *
 * const controller = new VendingController({
 *   portPath: '/dev/ttyUSB0',
 *   baudRate: 9600,
 * });
 *
 * await controller.open();
 *
 * const vendResult = await controller.vendWithDropCheck(3);
 * console.log(vendResult); // { channel: 3, dropped: true, raw: <Buffer ...> }
 *
 * await controller.close();
 * ```
 */
export class VendingController {
  /**
   * @param {object} options - параметры подключения
   * @param {string} options.portPath - путь к последовательному порту (например, 'COM3' или '/dev/ttyUSB0')
   * @param {number} [options.baudRate=9600] - скорость порта
   * @param {(entry: any) => void} [options.logger] - опциональный логгер (можно передать console.log)
   */
  constructor({ portPath, baudRate = 9600, logger } = {}) {
    if (!portPath) {
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        ERROR_DESCRIPTIONS[ERROR_CODES.INVALID_ARGUMENT],
        { reason: 'portPath is required' },
      );
    }

    /** @private */
    this._logger = typeof logger === 'function' ? logger : () => {};

    /** @private */
    this._port = new SerialPort({
      path: portPath,
      baudRate,
      autoOpen: false,
    });

    /** @private буфер принятых байт. */
    this._rxBuffer = Buffer.alloc(0);

    /**
     * @private Текущий "ожидающий" запрос.
     * Содержит resolve/reject промиса и служебную информацию.
     */
    this._currentRequest = null;

    // Подписка на приём данных с UART.
    this._port.on('data', (chunk) => this._onData(chunk));
  }

  /* ------------------------- Управление портом ----------------------------- */

  /**
   * Открытие последовательного порта.
   *
   * @returns {Promise<void>}
   */
  open() {
    return new Promise((resolve, reject) => {
      this._port.open((err) => {
        if (err) {
          reject(
            new VendingControllerError(
              ERROR_CODES.PORT_NOT_OPEN,
              ERROR_DESCRIPTIONS[ERROR_CODES.PORT_NOT_OPEN],
              { cause: err?.message },
            ),
          );
        } else {
          this._logger({
            type: 'info',
            message: 'Serial port opened',
          });
          resolve();
        }
      });
    });
  }

  /**
   * Закрытие последовательного порта.
   *
   * @returns {Promise<void>}
   */
  close() {
    return new Promise((resolve, reject) => {
      if (!this._port.isOpen) {
        resolve();
        return;
      }

      this._port.close((err) => {
        if (err) {
          reject(err);
        } else {
          this._logger({
            type: 'info',
            message: 'Serial port closed',
          });
          resolve();
        }
      });
    });
  }

  /* ------------------------ Внутренний обработчик RX ----------------------- */

  /**
   * @private
   * Обработчик входящих данных с UART. Накопливает байты в буфере до тех пор,
   * пока не наберётся полный кадр ответа (5 байт), после чего передаёт кадр
   * ожидающему запросу.
   *
   * @param {Buffer} chunk - очередная порция данных с порта
   */
  _onData(chunk) {
    if (!this._currentRequest) {
      // Нет активного запроса — протокол нарушен или "мусор" в линии.
      this._logger({
        type: 'warn',
        message: 'Unmatched data from controller (no active request)',
        rxHex: chunk.toString('hex'),
      });
      return;
    }

    this._rxBuffer = Buffer.concat([this._rxBuffer, chunk]);

    // Проверяем, что буфера достаточно для одного полного кадра ответа.
    if (this._rxBuffer.length >= RESPONSE_FRAME_LENGTH) {
      const frame = this._rxBuffer.subarray(0, RESPONSE_FRAME_LENGTH);
      this._rxBuffer = this._rxBuffer.subarray(RESPONSE_FRAME_LENGTH);

      const req = this._currentRequest;
      this._currentRequest = null;

      clearTimeout(req.timeoutHandle);

      this._logger({
        type: 'rx',
        description: req.description,
        rxHex: frame.toString('hex'),
      });

      req.resolve(frame);
    }
  }

  /* ---------------------- Внутренние методы обмена ------------------------- */

  /**
   * @private
   * Проверка, что порт открыт.
   */
  _ensurePortOpen() {
    if (!this._port.isOpen) {
      throw new VendingControllerError(
        ERROR_CODES.PORT_NOT_OPEN,
        ERROR_DESCRIPTIONS[ERROR_CODES.PORT_NOT_OPEN],
      );
    }
  }

  /**
   * @private
   * Низкоуровневый метод: формирует и отправляет 6-байтный запрос и ожидает
   * "сырой" 5-байтный ответ.
   *
   * НЕ выполняет никакой логики по статусу, ошибкам механики и т.п. —
   * только длина/TIMEOUT.
   *
   * @param {number} cmd - байт команды (CMD)
   * @param {number} supp - байт параметра (SubCMD)
   * @param {number} timeoutMs - тайм-аут ожидания ответа в миллисекундах
   * @param {string} description - описание операции для логов
   * @returns {Promise<Buffer>} - 5-байтный кадр ответа
   */
  _exchangeFrame({ cmd, supp, timeoutMs, description }) {
    this._ensurePortOpen();

    if (this._currentRequest) {
      // По протоколу нельзя отправлять новый запрос, пока не получен ответ.
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        ERROR_DESCRIPTIONS[ERROR_CODES.INVALID_ARGUMENT],
        { reason: 'Another request is already in progress' },
      );
    }

    const groupId = GROUP_ID_DEFAULT;

    const frame = Buffer.from([
      groupId,
      complementByte(groupId),
      cmd & BYTE_MAX,
      complementByte(cmd),
      supp & BYTE_MAX,
      complementByte(supp),
    ]);

    this._logger({
      type: 'tx',
      description,
      txHex: frame.toString('hex'),
    });

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (this._currentRequest) {
          this._currentRequest = null;
        }

        reject(
          new VendingControllerError(
            ERROR_CODES.COMM_TIMEOUT,
            ERROR_DESCRIPTIONS[ERROR_CODES.COMM_TIMEOUT],
            { description, timeoutMs, elapsedMs: Date.now() - startTime },
          ),
        );
      }, timeoutMs);

      this._currentRequest = {
        resolve,
        reject,
        timeoutHandle,
        description,
      };

      this._port.write(frame, (err) => {
        if (err) {
          clearTimeout(timeoutHandle);
          this._currentRequest = null;
          reject(
            new VendingControllerError(
              ERROR_CODES.PORT_NOT_OPEN,
              ERROR_DESCRIPTIONS[ERROR_CODES.PORT_NOT_OPEN],
              { cause: err?.message },
            ),
          );
        }
      });
    });
  }

  /**
   * @private
   * Парсинг 5-байтного кадра ответа и базовая валидация.
   *
   * @param {Buffer} reply - 5-байтный кадр ответа
   * @returns {{
   *   groupId: number,
   *   status: number,
   *   data: number,
   *   aux: number,
   *   checksum: number
   * }}
   */
  _parseReply(reply) {
    if (!Buffer.isBuffer(reply) || reply.length !== RESPONSE_FRAME_LENGTH) {
      throw new VendingControllerError(
        ERROR_CODES.PROTOCOL_BAD_LENGTH,
        ERROR_DESCRIPTIONS[ERROR_CODES.PROTOCOL_BAD_LENGTH],
        { length: reply?.length ?? null },
        reply,
      );
    }

    const groupId = reply[0];
    const status = reply[1];
    const data = reply[2];
    const aux = reply[3];
    const checksum = reply[4];

    const computedChecksum =
      (groupId + status + data + aux) & BYTE_MAX;

    if (computedChecksum !== checksum) {
      throw new VendingControllerError(
        ERROR_CODES.PROTOCOL_BAD_CHECKSUM,
        ERROR_DESCRIPTIONS[ERROR_CODES.PROTOCOL_BAD_CHECKSUM],
        { groupId, status, data, aux, checksum, computedChecksum },
        reply,
      );
    }

    return { groupId, status, data, aux, checksum };
  }

  /**
   * @private
   * Формирует объект ошибки при статусе STATUS_ERROR (0x5C), декодируя биты
   * механики и оптики из байта data.
   *
   * @param {{groupId:number,status:number,data:number,aux:number,checksum:number}} parsed
   * @param {string} description - описание операции
   * @param {Buffer} rawReply - исходный кадр ответа
   * @returns {VendingControllerError}
   */
  _buildControllerError(parsed, description, rawReply) {
    const mechanicalCode = (parsed.data & 0xf0) >> 4;
    const opticalCode = parsed.data & 0x0f;

    const mechanicalDescription =
      MECHANICAL_ERROR_MAP[mechanicalCode] ??
      'Mechanical: unknown error';
    const opticalDescription =
      OPTICAL_ERROR_MAP[opticalCode] ??
      'Optical: unknown error';

    const fullMessage = `${ERROR_DESCRIPTIONS[ERROR_CODES.CONTROLLER_ERROR]}: ` +
      `${mechanicalDescription}; ${opticalDescription}`;

    return new VendingControllerError(
      ERROR_CODES.CONTROLLER_ERROR,
      fullMessage,
      {
        description,
        mechanicalCode,
        mechanicalDescription,
        opticalCode,
        opticalDescription,
        aux: parsed.aux,
      },
      rawReply,
    );
  }

  /**
   * @private
   * Упрощённый метод "отправить запрос и разобрать ответ".
   *
   * @param {object} params
   * @param {number} params.cmd - байт команды
   * @param {number} params.supp - байт параметра
   * @param {number} params.timeoutMs - тайм-аут
   * @param {string} params.description - описание операции
   * @param {boolean} [params.allowStatusError=false] - если true, статус 0x5C не приводит к исключению, а возвращается как есть
   * @returns {Promise<{
   *   groupId: number,
   *   status: number,
   *   data: number,
   *   aux: number,
   *   checksum: number,
   *   raw: Buffer
   * }>}
   */
  async _sendAndReceive({
    cmd,
    supp,
    timeoutMs,
    description,
    allowStatusError = false,
  }) {
    const rawReply = await this._exchangeFrame({
      cmd,
      supp,
      timeoutMs,
      description,
    });

    const parsed = this._parseReply(rawReply);

    if (
      parsed.status !== STATUS_OK &&
      parsed.status !== STATUS_ERROR
    ) {
      throw new VendingControllerError(
        ERROR_CODES.PROTOCOL_UNEXPECTED_STATUS,
        ERROR_DESCRIPTIONS[ERROR_CODES.PROTOCOL_UNEXPECTED_STATUS],
        { status: parsed.status, description },
        rawReply,
      );
    }

    if (parsed.status === STATUS_ERROR && !allowStatusError) {
      throw this._buildControllerError(parsed, description, rawReply);
    }

    return { ...parsed, raw: rawReply };
  }

  /* ---------------------- Валидация аргументов методов --------------------- */

  /**
   * @private
   * Проверка валидности номера канала.
   *
   * @param {number} channel - номер канала
   */
  _validateChannel(channel) {
    if (
      typeof channel !== 'number' ||
      !Number.isInteger(channel) ||
      channel < MIN_CHANNEL ||
      channel > MAX_LOGICAL_CHANNEL
    ) {
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        ERROR_DESCRIPTIONS[ERROR_CODES.INVALID_ARGUMENT],
        {
          reason: 'Invalid channel number',
          channel,
          allowedRange: [MIN_CHANNEL, MAX_LOGICAL_CHANNEL],
        },
      );
    }
  }

  /**
   * @private
   * Проверка валидности тайм-аута.
   *
   * @param {number} timeoutMs - тайм-аут в мс
   */
  _validateTimeout(timeoutMs) {
    if (
      typeof timeoutMs !== 'number' ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        ERROR_DESCRIPTIONS[ERROR_CODES.INVALID_ARGUMENT],
        {
          reason: 'Invalid timeout value',
          timeoutMs,
        },
      );
    }
  }

  /* ======================================================================== */
  /*                      ПРИКЛАДНЫЕ МЕТОДЫ ВЫДАЧИ ТОВАРА                     */
  /* ======================================================================== */

  /**
   * Выдать товар из указанного канала без контроля падения (без фотодатчика).
   *
   * @param {number} channel - номер канала (1..80)
   * @param {number} [timeoutMs=DEFAULT_VEND_TIMEOUT_MS] - тайм-аут на выдачу
   * @returns {Promise<{ channel:number, raw:Buffer }>}
   */
  async vendSimple(channel, timeoutMs = DEFAULT_VEND_TIMEOUT_MS) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `VendSimple(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: channel,
      supp: SUPP_DROP_CHECK_DISABLED,
      timeoutMs,
      description,
    });

    // Успешная выдача без проверки падения: D2 и D3 не используются по сути.
    return {
      channel,
      raw: reply.raw,
    };
  }

  /**
   * Выдать товар из указанного канала с контролем падения по фотодатчику.
   *
   * Если выдача прошла успешно:
   *  - aux (D3) = 0xAA → падение подтверждено.
   *  - aux (D3) = 0x00 → механика отработала, но падение не зафиксировано.
   *
   * @param {number} channel - номер канала (1..80)
   * @param {number} [timeoutMs=DEFAULT_VEND_TIMEOUT_MS] - тайм-аут на выдачу
   * @returns {Promise<{ channel:number, dropped:boolean, raw:Buffer }>}
   */
  async vendWithDropCheck(
    channel,
    timeoutMs = DEFAULT_VEND_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `VendWithDropCheck(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: channel,
      supp: SUPP_DROP_CHECK_ENABLED,
      timeoutMs,
      description,
    });

    const dropped = reply.aux === SUPP_DROP_CHECK_ENABLED;

    return {
      channel,
      dropped,
      raw: reply.raw,
    };
  }

  /* ======================================================================== */
  /*                        ДИАГНОСТИКА И СЛУЖЕБНЫЕ МЕТОДЫ                    */
  /* ======================================================================== */

  /**
   * Общий самотест контроллера.
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS] - тайм-аут
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async selfTest(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'SelfTest()';

    const reply = await this._sendAndReceive({
      cmd: CMD_SELF_TEST,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Сервисная команда: один оборот всех каналов.
   *
   * @param {number} [timeoutMs=DEFAULT_VEND_TIMEOUT_MS] - тайм-аут
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async resetAll(timeoutMs = DEFAULT_VEND_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'ResetAll()';

    const reply = await this._sendAndReceive({
      cmd: CMD_RESET_ALL,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Запросить повтор последнего ответа контроллера (без повторения действия).
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS] - тайм-аут
   * @returns {Promise<{ raw:Buffer }>}
   */
  async repeatLastReply(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'RepeatLastReply()';

    const reply = await this._sendAndReceive({
      cmd: CMD_REPEAT_LAST_REPLY,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
      // Повтор может вернуть и ERROR, и OK — здесь это просто "копия" кадра.
      allowStatusError: true,
    });

    return {
      raw: reply.raw,
    };
  }

  /* ======================================================================== */
  /*                  ТИПЫ КАНАЛОВ И ОБЪЕДИНЕНИЕ/РАЗЪЕДИНЕНИЕ                 */
  /* ======================================================================== */

  /**
   * Назначить ленточный тип канала.
   *
   * @param {number} channel - номер канала
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setChannelTypeBelt(
    channel,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `SetChannelTypeBelt(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_CHANNEL_TYPE_BELT,
      supp: channel,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Назначить пружинный тип канала.
   *
   * @param {number} channel - номер канала
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setChannelTypeSpring(
    channel,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `SetChannelTypeSpring(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_CHANNEL_TYPE_SPRING,
      supp: channel,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Все каналы → пружинные.
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setAllSpring(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'SetAllSpring()';

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_ALL_SPRING,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Все каналы → ленточные.
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setAllBelt(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'SetAllBelt()';

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_ALL_BELT,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Сделать канал одиночным (если был двойным).
   *
   * @param {number} channel
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async makeSingle(
    channel,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `MakeSingle(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_MAKE_SINGLE,
      supp: channel,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Объединить два соседних канала в двойной (channel и channel+1).
   *
   * @param {number} channel - номер первого канала в паре
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async makeDouble(
    channel,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `MakeDouble(channel=${channel})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_MAKE_DOUBLE,
      supp: channel,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Все каналы → одиночные.
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async makeAllSingle(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'MakeAllSingle()';

    const reply = await this._sendAndReceive({
      cmd: CMD_MAKE_ALL_SINGLE,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /* ======================================================================== */
  /*                      ПРОВЕРКА СУЩЕСТВОВАНИЯ КАНАЛА                        */
  /* ======================================================================== */

  /**
   * Проверить, существует ли физически канал на контроллере.
   *
   * В текущей реализации контроллера при обращении к несуществующим
   * каналам возвращается статус ERROR.
   *
   * @param {number} channel - номер канала
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ exists:boolean, raw:Buffer }>}
   */
  async channelExists(
    channel,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const description = `ChannelExists(channel=${channel})`;

    const cmd = (CMD_CHANNEL_EXISTS_BASE + channel) & BYTE_MAX;

    const reply = await this._sendAndReceive({
      cmd,
      supp: channel,
      timeoutMs,
      description,
      // Статус ERROR в этом методе интерпретируется как "канал отсутствует",
      // поэтому не выбрасываем исключение.
      allowStatusError: true,
    });

    const exists = reply.status === STATUS_OK;

    return {
      exists,
      raw: reply.raw,
    };
  }

  /**
   * Опрос наличия всех каналов с заданной задержкой между запросами.
   *
   * Метод последовательно проверяет каналы от 1 до maxChannel, между
   * запросами выдерживается пауза interChannelDelayMs. Результат для каждого
   * канала возвращается в виде массива.
   *
   * @param {object} [params]
   * @param {number} [params.maxChannel=MAX_PHYSICAL_CHANNEL] - максимальный номер канала для опроса
   * @param {number} [params.interChannelDelayMs=50] - задержка между опросами каналов, мс
   * @param {number} [params.timeoutMs=DEFAULT_FAST_TIMEOUT_MS] - тайм-аут на один запрос, мс
   * @returns {Promise<Array<{
   *   channel:number,
   *   exists:boolean,
   *   status:'ok'|'controllerError'|'timeout'|'protocolError',
   *   error:VendingControllerError|null
   * }>>}
   */
  async pollAllChannels({
    maxChannel = MAX_PHYSICAL_CHANNEL,
    interChannelDelayMs = 50,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  } = {}) {
    this._validateTimeout(timeoutMs);

    const effectiveMaxChannel = Math.min(
      MAX_LOGICAL_CHANNEL,
      Math.max(MIN_CHANNEL, maxChannel),
    );

    const results = [];

    for (let ch = MIN_CHANNEL; ch <= effectiveMaxChannel; ch += 1) {
      if (ch > MIN_CHANNEL && interChannelDelayMs > 0) {
        // Пауза между запросами к соседним каналам.
        // Согласно рекомендации, общая длительность опроса всех каналов
        // обычно не менее ~2 секунд, эту паузу можно подобрать.
        await delay(interChannelDelayMs);
      }

      try {
        const res = await this.channelExists(ch, timeoutMs);
        results.push({
          channel: ch,
          exists: res.exists,
          status: 'ok',
          error: null,
        });
      } catch (err) {
        if (err instanceof VendingControllerError) {
          let status;

          if (err.code === ERROR_CODES.COMM_TIMEOUT) {
            status = 'timeout';
          } else if (err.code === ERROR_CODES.CONTROLLER_ERROR) {
            status = 'controllerError';
          } else {
            status = 'protocolError';
          }

          results.push({
            channel: ch,
            exists: false,
            status,
            error: err,
          });
        } else {
          // Непредвиденная ошибка.
          results.push({
            channel: ch,
            exists: false,
            status: 'protocolError',
            error: err,
          });
        }
      }
    }

    return results;
  }

  /* ======================================================================== */
  /*               ХОЛОДИЛЬНЫЙ КОНТУР И ПРОЧАЯ ПЕРИФЕРИЯ (СВЕТ, ЗВУК)         */
  /* ======================================================================== */

  /**
   * Включить или выключить управление температурой (термоконтроль).
   *
   * @param {boolean} enabled
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async tempControlEnable(
    enabled,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const description = `TempControlEnable(enabled=${enabled})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_TEMP_CONTROL_ENABLE,
      supp: enabled ? SUPP_ON : SUPP_OFF,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установить режим термоконтроля: 'cool' (охлаждение) или 'heat' (нагрев).
   *
   * @param {'cool'|'heat'} mode
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setThermoMode(mode, timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const supp =
      mode === 'cool'
        ? SUPP_ON // 0x01 — охлаждение
        : SUPP_OFF; // 0x00 — нагрев

    const description = `SetThermoMode(mode=${mode})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_THERMO_MODE,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка целевой температуры (setpoint) в градусах Цельсия.
   *
   * Диапазон в протоколе — 1 байт, рекомендуется использовать неотрицательные
   * значения, характерные для холодильного шкафа (0..25).
   *
   * @param {number} celsius - целевая температура
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setSetpoint(celsius, timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const supp = celsius & BYTE_MAX;

    const description = `SetSetpoint(celsius=${celsius})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_SETPOINT,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка гистерезиса термоконтроля (дельта в градусах Цельсия).
   *
   * @param {number} celsiusDelta
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setHysteresis(
    celsiusDelta,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const supp = celsiusDelta & BYTE_MAX;

    const description = `SetHysteresis(deltaC=${celsiusDelta})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_HYSTERESIS,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка температурной компенсации (градусы Цельсия).
   *
   * @param {number} celsius
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setCompensation(
    celsius,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const supp = celsius & BYTE_MAX;

    const description = `SetCompensation(celsius=${celsius})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_COMPENSATION,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка длительности дефроста в минутах.
   *
   * @param {number} minutes
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setDefrostMinutes(
    minutes,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const supp = minutes & BYTE_MAX;

    const description = `SetDefrostMinutes(minutes=${minutes})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_DEFROST_MIN,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка максимального непрерывного времени работы компрессора (минуты).
   *
   * @param {number} minutes
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setCompressorRunMinutes(
    minutes,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const supp = minutes & BYTE_MAX;

    const description = `SetCompressorRunMinutes(minutes=${minutes})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_COMPRESSOR_RUN_MIN,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Установка задержки отключения вентилятора по простою (минуты).
   *
   * @param {number} minutes
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setFanIdleOffDelay(
    minutes,
    timeoutMs = DEFAULT_FAST_TIMEOUT_MS,
  ) {
    this._validateTimeout(timeoutMs);

    const supp = minutes & BYTE_MAX;

    const description = `SetFanIdleOffDelay(minutes=${minutes})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_FAN_IDLE_OFF_DELAY,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Включить или выключить обогрев стекла.
   *
   * @param {boolean} on
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setGlassHeater(on, timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = `SetGlassHeater(on=${on})`;

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_GLASS_HEATER,
      supp: on ? SUPP_ON : SUPP_OFF,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Чтение текущей температуры шкафа.
   *
   * Температура возвращается как знаковый байт (-128..+127 °C) в поле data (D2).
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ celsius:number, raw:Buffer }>}
   */
  async readTemperature(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'ReadTemperature()';

    const reply = await this._sendAndReceive({
      cmd: CMD_READ_TEMPERATURE,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    // Преобразуем беззнаковый байт в знаковый (-128..127).
    let celsius = reply.data;
    if (celsius & 0x80) {
      celsius = celsius - 0x100;
    }

    return {
      celsius,
      raw: reply.raw,
    };
  }

  /**
   * Управление подсветкой витрины.
   *
   * @param {boolean} on
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setLighting(on, timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = `SetLighting(on=${on})`;

    const supp = on
      ? SUPP_DROP_CHECK_ENABLED // 0xAA — "включить"
      : SUPP_DROP_CHECK_DISABLED; // 0x55 — "выключить"

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_LIGHTING,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Управление зуммером.
   *
   * @param {boolean} on
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async setBuzzer(on, timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = `SetBuzzer(on=${on})`;

    const supp = on
      ? SUPP_DROP_CHECK_ENABLED // 0xAA — "включить"
      : SUPP_DROP_CHECK_DISABLED; // 0x55 — "выключить"

    const reply = await this._sendAndReceive({
      cmd: CMD_SET_BUZZER,
      supp,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Прочитать состояние двери автомата.
   *
   * - data (D2) = 0x00 → дверь закрыта.
   * - data (D2) = 0x01 → дверь открыта.
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ state:'closed'|'open', raw:Buffer }>}
   */
  async readDoor(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'ReadDoor()';

    const reply = await this._sendAndReceive({
      cmd: CMD_READ_DOOR,
      supp: SUPP_NO_PARAM,
      timeoutMs,
      description,
    });

    const state = reply.data === 0x01 ? 'open' : 'closed';

    return {
      state,
      raw: reply.raw,
    };
  }

  /**
   * Открыть дверь (дополнительная команда).
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async openDoor(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'OpenDoor()';

    const reply = await this._sendAndReceive({
      cmd: CMD_OPEN_DOOR,
      supp: SUPP_DROP_CHECK_ENABLED,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Разблокировать дверь выдачи (дополнительная команда).
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async unlockDoor(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'UnlockDoor()';

    const reply = await this._sendAndReceive({
      cmd: CMD_UNLOCK_DOOR,
      supp: SUPP_DROP_CHECK_ENABLED,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }

  /**
   * Включить акселерометр (дополнительная команда; пока зарезервировано).
   *
   * @param {number} [timeoutMs=DEFAULT_FAST_TIMEOUT_MS]
   * @returns {Promise<{ ok:boolean, raw:Buffer }>}
   */
  async enableAccelerometer(timeoutMs = DEFAULT_FAST_TIMEOUT_MS) {
    this._validateTimeout(timeoutMs);

    const description = 'EnableAccelerometer()';

    const reply = await this._sendAndReceive({
      cmd: CMD_ENABLE_ACCELEROMETER,
      supp: SUPP_DROP_CHECK_ENABLED,
      timeoutMs,
      description,
    });

    return {
      ok: reply.status === STATUS_OK,
      raw: reply.raw,
    };
  }
}
