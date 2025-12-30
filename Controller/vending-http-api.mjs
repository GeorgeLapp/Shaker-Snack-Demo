// vending-http-api.mjs

/**
 * HTTP API для вызова методов модуля vending-controller.
 *
 * Этот модуль поднимает REST-сервер и предоставляет эндпоинты для
 * ВСЕХ публичных методов VendingController.
 *
 * ======================= ОБЩАЯ СХЕМА МАРШРУТОВ ===========================
 *
 * Базовый путь: /api/v1  (по умолчанию, можно поменять через VENDING_BASE_PATH)
 *
 * ВЫДАЧА ТОВАРА
 *  - POST {basePath}/vend/simple
 *      Тело:   { "channel": number, "timeoutMs"?: number }
 *      Действие: Выдача товара без контроля падения.
 *
 *  - POST {basePath}/vend/drop-check
 *      Тело:   { "channel": number, "timeoutMs"?: number }
 *      Действие: Выдача товара с контролем падения по фотодатчику.
 *
 * КАНАЛЫ: ПРОВЕРКА И ОПРОС
 *  - GET  {basePath}/channels/:channel/exists?timeoutMs=...
 *      Действие: Проверка, существует ли физически указанный канал.
 *
 *  - GET  {basePath}/channels/poll?maxChannel=60&delayMs=50&timeoutMs=300
 *      Действие: Опрос всех каналов от 1 до maxChannel с задержкой между запросами.
 *
 * КОНФИГУРАЦИЯ ТИПОВ КАНАЛОВ
 *  - POST {basePath}/channels/:channel/type/belt
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Сделать канал ленточным.
 *
 *  - POST {basePath}/channels/:channel/type/spring
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Сделать канал пружинным.
 *
 *  - POST {basePath}/channels/type/all/spring
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Все каналы сделать пружинными.
 *
 *  - POST {basePath}/channels/type/all/belt
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Все каналы сделать ленточными.
 *
 *  - POST {basePath}/channels/:channel/mode/single
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Сделать канал одиночным.
 *
 *  - POST {basePath}/channels/:channel/mode/double
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Объединить канал с соседним в двойной.
 *
 *  - POST {basePath}/channels/mode/all/single
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Все каналы сделать одиночными.
 *
 * ДИАГНОСТИКА / САМТЕСТ
 *  - POST {basePath}/self-test
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Общий самотест контроллера.
 *
 *  - POST {basePath}/reset-all
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Один оборот всех каналов (сервисная операция).
 *
 *  - POST {basePath}/repeat-last-reply
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Повтор последнего ответа контроллера (без повторения действия).
 *
 * ТЕМПЕРАТУРА И ХОЛОДИЛЬНЫЙ КОНТУР
 *  - GET  {basePath}/temperature?timeoutMs=...
 *      Действие: Чтение текущей температуры шкафа.
 *
 *  - POST {basePath}/temp/control
 *      Тело: { "enabled": boolean, "timeoutMs"?: number }
 *      Действие: Включить/выключить термоконтроль.
 *
 *  - POST {basePath}/temp/mode
 *      Тело: { "mode": "cool" | "heat", "timeoutMs"?: number }
 *      Действие: Режим термоконтроля (охлаждение/нагрев).
 *
 *  - POST {basePath}/temp/setpoint
 *      Тело: { "celsius": number, "timeoutMs"?: number }
 *      Действие: Установка целевой температуры.
 *
 *  - POST {basePath}/temp/hysteresis
 *      Тело: { "deltaC": number, "timeoutMs"?: number }
 *      Действие: Установка гистерезиса.
 *
 *  - POST {basePath}/temp/compensation
 *      Тело: { "celsius": number, "timeoutMs"?: number }
 *      Действие: Температурная компенсация.
 *
 *  - POST {basePath}/temp/defrost
 *      Тело: { "minutes": number, "timeoutMs"?: number }
 *      Действие: Длительность дефроста (разморозки).
 *
 *  - POST {basePath}/temp/compressor-run
 *      Тело: { "minutes": number, "timeoutMs"?: number }
 *      Действие: Макс. время непрерывной работы компрессора.
 *
 *  - POST {basePath}/temp/fan-idle-off
 *      Тело: { "minutes": number, "timeoutMs"?: number }
 *      Действие: Задержка отключения вентилятора по простою.
 *
 *  - POST {basePath}/glass-heater
 *      Тело: { "on": boolean, "timeoutMs"?: number }
 *      Действие: Включить/выключить обогрев стекла.
 *
 * ДВЕРЬ / СВЕТ / ЗВУК / АКСЕЛЕРОМЕТР
 *  - GET  {basePath}/door?timeoutMs=...
 *      Действие: Чтение состояния двери автомата.
 *
 *  - POST {basePath}/door/open
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Открыть дверь (доп. команда).
 *
 *  - POST {basePath}/door/unlock
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Разблокировать дверь выдачи.
 *
 *  - POST {basePath}/lighting
 *      Тело: { "on": boolean, "timeoutMs"?: number }
 *      Действие: Включить/выключить подсветку витрины.
 *
 *  - POST {basePath}/buzzer
 *      Тело: { "on": boolean, "timeoutMs"?: number }
 *      Действие: Включить/выключить зуммер.
 *
 *  - POST {basePath}/accelerometer/enable
 *      Тело: { "timeoutMs"?: number }
 *      Действие: Включить акселерометр (если поддерживается).
 *
 * ======================= ЗАПУСК ПОД pm2 ================================
 *
 * Переменные окружения:
 *   VENDING_PORT_PATH  — путь к UART (COM3, /dev/ttyUSB0 и т.п.) [обязателен]
 *   VENDING_HTTP_PORT  — HTTP-порт, по умолчанию 5000
 *   VENDING_BAUD_RATE  — скорость порта, по умолчанию 9600
 *   VENDING_BASE_PATH  — базовый путь API, по умолчанию /api/v1
 *
 * Пример pm2-конфига см. в комментариях внизу файла.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VendingController,
  VendingControllerError,
  ERROR_CODES,
} from './vending-controller.mjs';
import { EmulatedVendingController } from './vending-controller-emulator.mjs';

/* ========================================================================== */
/*                           ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ                          */
/* ========================================================================== */

/**
 * Преобразование ошибки модуля контроллера в HTTP-код и JSON-ответ.
 *
 * @param {unknown} err - любая ошибка, в том числе VendingControllerError
 * @returns {{ status:number, body: { success:false, error:{ code:string, message:string, details?:object }}}}
 */
function mapErrorToHttp(err) {
  if (err instanceof VendingControllerError) {
    let status = 500;

    switch (err.code) {
      case ERROR_CODES.INVALID_ARGUMENT:
        status = 400;
        break;
      case ERROR_CODES.PORT_NOT_OPEN:
        status = 503;
        break;
      case ERROR_CODES.COMM_TIMEOUT:
        status = 504;
        break;
      case ERROR_CODES.CONTROLLER_ERROR:
        status = 502;
        break;
      case ERROR_CODES.PROTOCOL_BAD_LENGTH:
      case ERROR_CODES.PROTOCOL_BAD_CHECKSUM:
      case ERROR_CODES.PROTOCOL_UNEXPECTED_STATUS:
        status = 502;
        break;
      default:
        status = 500;
    }

    const body = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };

    return { status, body };
  }

  const body = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err?.message || 'Unknown internal server error',
    },
  };
  return { status: 500, body };
}

/**
 * Обёртка для асинхронных обработчиков маршрутов, чтобы не писать try/catch в каждом.
 *
 * @param {(req,res,next) => Promise<any>} fn - асинхронный обработчик
 * @returns {(req,res,next) => void}
 */
function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const INVALID_ARGUMENT_MESSAGE = 'Invalid method argument';
const PORT_NOT_OPEN_MESSAGE = 'Serial port is not open';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off']);

function parseBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

const EMULATOR_FLAG_NAMES = new Set(['--emulator', '--emu']);
const HARDWARE_FLAG_NAMES = new Set(['--hardware', '--no-emulator']);

function parseCliArgs(argv) {
  const emulatorFlag = argv.some((arg) => EMULATOR_FLAG_NAMES.has(arg));
  const hardwareFlag = argv.some((arg) => HARDWARE_FLAG_NAMES.has(arg));
  const args = argv.filter(
    (arg) => !EMULATOR_FLAG_NAMES.has(arg) && !HARDWARE_FLAG_NAMES.has(arg),
  );
  return { emulatorFlag, hardwareFlag, args };
}

function createSwitchableController({
  hardwareController,
  emulatorController,
  emulationEnabled = false,
} = {}) {
  const state = {
    emulationEnabled: Boolean(emulationEnabled),
    hardwareOpen: false,
    emulatorOpen: false,
  };

  const ensureHardware = () => {
    if (!hardwareController) {
      throw new VendingControllerError(
        ERROR_CODES.PORT_NOT_OPEN,
        PORT_NOT_OPEN_MESSAGE,
        { reason: 'Hardware controller is not configured' },
      );
    }
    return hardwareController;
  };

  const ensureEmulator = () => {
    if (!emulatorController) {
      throw new VendingControllerError(
        ERROR_CODES.PORT_NOT_OPEN,
        PORT_NOT_OPEN_MESSAGE,
        { reason: 'Emulator controller is not configured' },
      );
    }
    return emulatorController;
  };

  const openHardware = async () => {
    const controller = ensureHardware();
    if (!state.hardwareOpen && typeof controller.open === 'function') {
      await controller.open();
      state.hardwareOpen = true;
    }
  };

  const openEmulator = async () => {
    const controller = ensureEmulator();
    if (!state.emulatorOpen && typeof controller.open === 'function') {
      await controller.open();
      state.emulatorOpen = true;
    }
  };

  const closeHardware = async () => {
    if (!hardwareController || !state.hardwareOpen) return;
    if (typeof hardwareController.close === 'function') {
      await hardwareController.close();
    }
    state.hardwareOpen = false;
  };

  const closeEmulator = async () => {
    if (!emulatorController || !state.emulatorOpen) return;
    if (typeof emulatorController.close === 'function') {
      await emulatorController.close();
    }
    state.emulatorOpen = false;
  };

  const getActiveController = () =>
    state.emulationEnabled ? ensureEmulator() : ensureHardware();

  const switcher = {
    isEmulationEnabled() {
      return state.emulationEnabled;
    },
    async setEmulationEnabled(enabled) {
      const next = Boolean(enabled);
      if (next === state.emulationEnabled) {
        return state.emulationEnabled;
      }

      if (next) {
        await openEmulator();
        await closeHardware();
        state.emulationEnabled = true;
        return true;
      }

      await openHardware();
      await closeEmulator();
      state.emulationEnabled = false;
      return false;
    },
    async open() {
      if (state.emulationEnabled) {
        await openEmulator();
        return;
      }
      await openHardware();
    },
    async close() {
      await closeHardware();
      await closeEmulator();
    },
  };

  return new Proxy(switcher, {
    get(target, prop) {
      if (prop in target) {
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      }

      const controller = getActiveController();
      const value = controller[prop];
      return typeof value === 'function' ? value.bind(controller) : value;
    },
  });
}

/* ========================================================================== */
/*                     СОЗДАНИЕ HTTP-ПРИЛОЖЕНИЯ / СЕРВЕРА                     */
/* ========================================================================== */

/**
 * Создаёт и настраивает экземпляр Express-приложения для HTTP API.
 *
 * @param {object} options
 * @param {VendingController} options.controller - экземпляр контроллера
 * @param {string} [options.basePath='/api/v1'] - базовый путь для всех эндпоинтов
 * @param {(logObj:any) => void} [options.logger] - логгер (по умолчанию console.log)
 * @returns {import('express').Express}
 */
export function createVendingHttpApp({
  controller,
  basePath = '/api/v1',
  logger = console.log,
} = {}) {
  if (!controller) {
    throw new Error(
      'createVendingHttpApp: "controller" instance is required',
    );
  }

  const app = express();
  app.use(express.json());

  // Простейший middleware-логгер HTTP-запросов
  app.use((req, _res, next) => {
    logger({
      type: 'http-request',
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
    });
    next();
  });

  const router = express.Router();

  if (
    typeof controller.setEmulationEnabled === 'function' &&
    typeof controller.isEmulationEnabled === 'function'
  ) {
    router.get('/emulation/controller', (_req, res) => {
      res.json({
        success: true,
        data: {
          enabled: controller.isEmulationEnabled(),
        },
      });
    });

    router.post(
      '/emulation/controller',
      asyncRoute(async (req, res) => {
        const { enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
          throw new VendingControllerError(
            ERROR_CODES.INVALID_ARGUMENT,
            INVALID_ARGUMENT_MESSAGE,
            {
              reason: '"enabled" must be a boolean',
              enabled,
            },
          );
        }

        await controller.setEmulationEnabled(enabled);

        res.json({
          success: true,
          data: {
            enabled: controller.isEmulationEnabled(),
          },
        });
      }),
    );
  }

  /* ======================================================================== */
  /*                              ВЫДАЧА ТОВАРА                               */
  /* ======================================================================== */

  /**
   * POST /vend/simple
   * Тело:
   *   { "channel": number, "timeoutMs"?: number }
   * Действие:
   *   Выдача товара без контроля падения.
   */
  router.post(
    '/vend/simple',
    asyncRoute(async (req, res) => {
      const { channel, timeoutMs } = req.body || {};

      const result = await controller.vendSimple(
        Number(channel),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          channel: result.channel,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /vend/drop-check
   * Тело:
   *   { "channel": number, "timeoutMs"?: number }
   * Действие:
   *   Выдача товара с контролем падения по фотодатчику.
   */
  router.post(
    '/vend/drop-check',
    asyncRoute(async (req, res) => {
      const { channel, timeoutMs } = req.body || {};

      const result = await controller.vendWithDropCheck(
        Number(channel),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          channel: result.channel,
          dropped: result.dropped,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /* ======================================================================== */
  /*                          КАНАЛЫ: ПРОВЕРКА/ОПРОС                          */
  /* ======================================================================== */

  /**
   * GET /channels/:channel/exists?timeoutMs=...
   *
   * Действие:
   *   Проверяет, существует ли физически указанный канал.
   */
  router.get(
    '/channels/:channel/exists',
    asyncRoute(async (req, res) => {
      const channel = Number(req.params.channel);
      const timeoutMs =
        req.query.timeoutMs !== undefined
          ? Number(req.query.timeoutMs)
          : undefined;

      const result = await controller.channelExists(channel, timeoutMs);

      res.json({
        success: true,
        data: {
          channel,
          exists: result.exists,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * GET /channels/poll?maxChannel=60&delayMs=50&timeoutMs=300
   *
   * Действие:
   *   Опрос каналов от 1 до maxChannel с задержкой между запросами.
   * Ответ:
   *   [
   *     {
   *       "channel": number,
   *       "exists": boolean,
   *       "status": "ok" | "controllerError" | "timeout" | "protocolError",
   *       "error": { code, message, details? } | null
   *     }, ...
   *   ]
   */
  router.get(
    '/channels/poll',
    asyncRoute(async (req, res) => {
      const maxChannel =
        req.query.maxChannel !== undefined
          ? Number(req.query.maxChannel)
          : undefined;
      const interChannelDelayMs =
        req.query.delayMs !== undefined
          ? Number(req.query.delayMs)
          : undefined;
      const timeoutMs =
        req.query.timeoutMs !== undefined
          ? Number(req.query.timeoutMs)
          : undefined;

      const results = await controller.pollAllChannels({
        maxChannel,
        interChannelDelayMs,
        timeoutMs,
      });

      res.json({
        success: true,
        data: results.map((r) => ({
          channel: r.channel,
          exists: r.exists,
          status: r.status,
          error: r.error
            ? {
                code:
                  r.error instanceof VendingControllerError
                    ? r.error.code
                    : 'INTERNAL_ERROR',
                message: r.error.message,
                details:
                  r.error instanceof VendingControllerError
                    ? r.error.details
                    : undefined,
              }
            : null,
        })),
      });
    }),
  );

  /* ======================================================================== */
  /*                          ДИАГНОСТИКА / САМТЕСТ                           */
  /* ======================================================================== */

  /**
   * POST /self-test
   *
   * Действие:
   *   Запускает самотест контроллера.
   * Ответ:
   *   { "ok": boolean, "rawHex": string }
   */
  router.post(
    '/self-test',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.selfTest(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /reset-all
   *
   * Действие:
   *   Один оборот всех каналов (сервисная операция).
   */
  router.post(
    '/reset-all',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.resetAll(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /repeat-last-reply
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Запрашивает повтор последнего ответа контроллера (без повторения действия).
   */
  router.post(
    '/repeat-last-reply',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.repeatLastReply(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /* ======================================================================== */
  /*                   ТИПЫ КАНАЛОВ / ОДИНОЧНЫЕ / ДВОЙНЫЕ                     */
  /* ======================================================================== */

  /**
   * POST /channels/:channel/type/belt
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Устанавливает тип канала как ленточный.
   */
  router.post(
    '/channels/:channel/type/belt',
    asyncRoute(async (req, res) => {
      const channel = Number(req.params.channel);
      const { timeoutMs } = req.body || {};

      const result = await controller.setChannelTypeBelt(
        channel,
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/:channel/type/spring
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Устанавливает тип канала как пружинный.
   */
  router.post(
    '/channels/:channel/type/spring',
    asyncRoute(async (req, res) => {
      const channel = Number(req.params.channel);
      const { timeoutMs } = req.body || {};

      const result = await controller.setChannelTypeSpring(
        channel,
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/type/all/spring
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Переводит все каналы в тип пружинные.
   */
  router.post(
    '/channels/type/all/spring',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.setAllSpring(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/type/all/belt
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Переводит все каналы в тип ленточные.
   */
  router.post(
    '/channels/type/all/belt',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.setAllBelt(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/:channel/mode/single
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Делает канал одиночным.
   */
  router.post(
    '/channels/:channel/mode/single',
    asyncRoute(async (req, res) => {
      const channel = Number(req.params.channel);
      const { timeoutMs } = req.body || {};

      const result = await controller.makeSingle(
        channel,
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/:channel/mode/double
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Объединяет два соседних канала (channel и channel+1) в двойной.
   */
  router.post(
    '/channels/:channel/mode/double',
    asyncRoute(async (req, res) => {
      const channel = Number(req.params.channel);
      const { timeoutMs } = req.body || {};

      const result = await controller.makeDouble(
        channel,
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /channels/mode/all/single
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Все каналы делает одиночными.
   */
  router.post(
    '/channels/mode/all/single',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.makeAllSingle(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /* ======================================================================== */
  /*                          ТЕМПЕРАТУРА / ХОЛОДИЛЬНИК                       */
  /* ======================================================================== */

  /**
   * GET /temperature?timeoutMs=...
   *
   * Действие:
   *   Читает текущую температуру шкафа.
   */
  router.get(
    '/temperature',
    asyncRoute(async (req, res) => {
      const timeoutMs =
        req.query.timeoutMs !== undefined
          ? Number(req.query.timeoutMs)
          : undefined;

      const result = await controller.readTemperature(timeoutMs);

      res.json({
        success: true,
        data: {
          celsius: result.celsius,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/control
   *
   * Тело:
   *   { "enabled": boolean, "timeoutMs"?: number }
   * Действие:
   *   Включает/выключает термоконтроль.
   */
  router.post(
    '/temp/control',
    asyncRoute(async (req, res) => {
      const { enabled, timeoutMs } = req.body || {};

      const result = await controller.tempControlEnable(
        Boolean(enabled),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/mode
   *
   * Тело:
   *   { "mode": "cool" | "heat", "timeoutMs"?: number }
   * Действие:
   *   Устанавливает режим термоконтроля (охлаждение/нагрев).
   */
  router.post(
    '/temp/mode',
    asyncRoute(async (req, res) => {
      const { mode, timeoutMs } = req.body || {};

      const result = await controller.setThermoMode(
        mode,
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/setpoint
   *
   * Тело:
   *   { "celsius": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает целевую температуру (уставку).
   */
  router.post(
    '/temp/setpoint',
    asyncRoute(async (req, res) => {
      const { celsius, timeoutMs } = req.body || {};

      const result = await controller.setSetpoint(
        Number(celsius),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/hysteresis
   *
   * Тело:
   *   { "deltaC": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает гистерезис термоконтроля.
   */
  router.post(
    '/temp/hysteresis',
    asyncRoute(async (req, res) => {
      const { deltaC, timeoutMs } = req.body || {};

      const result = await controller.setHysteresis(
        Number(deltaC),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/compensation
   *
   * Тело:
   *   { "celsius": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает температурную компенсацию.
   */
  router.post(
    '/temp/compensation',
    asyncRoute(async (req, res) => {
      const { celsius, timeoutMs } = req.body || {};

      const result = await controller.setCompensation(
        Number(celsius),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/defrost
   *
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает длительность дефроста (разморозки).
   */
  router.post(
    '/temp/defrost',
    asyncRoute(async (req, res) => {
      const { minutes, timeoutMs } = req.body || {};

      const result = await controller.setDefrostMinutes(
        Number(minutes),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/compressor-run
   *
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает максимальное непрерывное время работы компрессора.
   */
  router.post(
    '/temp/compressor-run',
    asyncRoute(async (req, res) => {
      const { minutes, timeoutMs } = req.body || {};

      const result = await controller.setCompressorRunMinutes(
        Number(minutes),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /temp/fan-idle-off
   *
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
   * Действие:
   *   Устанавливает задержку отключения вентилятора по простою.
   */
  router.post(
    '/temp/fan-idle-off',
    asyncRoute(async (req, res) => {
      const { minutes, timeoutMs } = req.body || {};

      const result = await controller.setFanIdleOffDelay(
        Number(minutes),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /glass-heater
   *
   * Тело:
   *   { "on": boolean, "timeoutMs"?: number }
   * Действие:
   *   Включает/выключает обогрев стекла.
   */
  router.post(
    '/glass-heater',
    asyncRoute(async (req, res) => {
      const { on, timeoutMs } = req.body || {};

      const result = await controller.setGlassHeater(
        Boolean(on),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /* ======================================================================== */
  /*                       ДВЕРЬ / СВЕТ / ЗВУК / АКСЕЛЕРОМЕТР                 */
  /* ======================================================================== */

  /**
   * GET /door?timeoutMs=...
   *
   * Действие:
   *   Читает состояние двери ('open' / 'closed').
   */
  router.get(
    '/door',
    asyncRoute(async (req, res) => {
      const timeoutMs =
        req.query.timeoutMs !== undefined
          ? Number(req.query.timeoutMs)
          : undefined;

      const result = await controller.readDoor(timeoutMs);

      res.json({
        success: true,
        data: {
          state: result.state,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /door/open
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Открывает дверь (дополнительная команда).
   */
  router.post(
    '/door/open',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.openDoor(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /door/unlock
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Разблокирует дверь выдачи.
   */
  router.post(
    '/door/unlock',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.unlockDoor(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /lighting
   *
   * Тело:
   *   { "on": boolean, "timeoutMs"?: number }
   * Действие:
   *   Включает/выключает подсветку витрины.
   */
  router.post(
    '/lighting',
    asyncRoute(async (req, res) => {
      const { on, timeoutMs } = req.body || {};

      const result = await controller.setLighting(
        Boolean(on),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /buzzer
   *
   * Тело:
   *   { "on": boolean, "timeoutMs"?: number }
   * Действие:
   *   Включает/выключает зуммер.
   */
  router.post(
    '/buzzer',
    asyncRoute(async (req, res) => {
      const { on, timeoutMs } = req.body || {};

      const result = await controller.setBuzzer(
        Boolean(on),
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /accelerometer/enable
   *
   * Тело:
   *   { "timeoutMs"?: number }
   * Действие:
   *   Включает акселерометр (если поддерживается железом).
   */
  router.post(
    '/accelerometer/enable',
    asyncRoute(async (req, res) => {
      const { timeoutMs } = req.body || {};

      const result = await controller.enableAccelerometer(
        timeoutMs !== undefined ? Number(timeoutMs) : undefined,
      );

      res.json({
        success: true,
        data: {
          ok: result.ok,
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /* ======================================================================== */
  /*                     МОНТАЖ ROUTER И ОБРАБОТКА ОШИБОК                     */
  /* ======================================================================== */

  app.use(basePath, router);

  // Централизованный обработчик ошибок
  app.use((err, _req, res, _next) => {
    logger({
      type: 'http-error',
      error: {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        ...(err instanceof VendingControllerError
          ? { code: err.code, details: err.details }
          : {}),
      },
    });

    const { status, body } = mapErrorToHttp(err);
    res.status(status).json(body);
  });

  return app;
}

/**
 * Утилита "всё-в-одном": создаёт контроллер, открывает UART-порт,
 * поднимает HTTP-сервер и возвращает ссылки на объекты.
 *
 * Удобно как из кода, так и для pm2.
 *
 * @param {object} options
 * @param {string} options.portPath - путь к UART-порту
 * @param {number} [options.baudRate=9600]
 * @param {number} [options.httpPort=5000]
 * @param {string} [options.basePath='/api/v1']
 * @param {(logObj:any) => void} [options.logger]
 * @returns {Promise<{ app: import('express').Express, server: import('http').Server, controller: VendingController }>}
 */
export async function startVendingHttpServer({
  portPath,
  baudRate = 9600,
  httpPort = 5000,
  basePath = '/api/v1',
  logger = console.log,
  emulator = false,
  emulatorOptions = {},
} = {}) {
  const emulationEnabled =
    typeof emulator === 'string'
      ? parseBooleanFlag(emulator, false)
      : Boolean(emulator);

  if (!emulationEnabled && !portPath) {
    throw new Error('startVendingHttpServer: "portPath" is required');
  }

  const hardwareController = portPath
    ? new VendingController({
        portPath,
        baudRate,
        logger,
      })
    : null;
  const emulatorController = new EmulatedVendingController({
    logger,
    ...emulatorOptions,
  });

  const controller = createSwitchableController({
    hardwareController,
    emulatorController,
    emulationEnabled,
  });

  await controller.open();

  const app = createVendingHttpApp({
    controller,
    basePath,
    logger,
  });

  const server = app.listen(httpPort, () => {
    logger({
      type: 'info',
      message: 'Vending HTTP API started',
      httpPort,
      basePath,
      portPath,
      baudRate,
      emulationEnabled:
        typeof controller.isEmulationEnabled === 'function'
          ? controller.isEmulationEnabled()
          : false,
    });
  });

  return { app, server, controller };
}

/* ========================================================================== */
/*                 АВТОЗАПУСК ПРИ ПРЯМОМ ЗАПУСКЕ (УДОБНО ДЛЯ PM2)            */
/* ========================================================================== */

/**
 * При запуске напрямую:
 *   node vending-http-api.mjs
 *
 * Можно настроить через env-переменные (идеально для pm2):
 *   VENDING_PORT_PATH=/dev/ttyUSB0
 *   VENDING_HTTP_PORT=5000
 *   VENDING_BAUD_RATE=9600
 *   VENDING_BASE_PATH=/api/v1
 *
 * Пример ecosystem.config.cjs:
 *
 *   module.exports = {
 *     apps: [
 *       {
 *         name: 'vending-http-api',
 *         script: './vending-http-api.mjs',
 *         interpreter: 'node',
 *         env: {
 *           VENDING_PORT_PATH: '/dev/ttyUSB0',
 *           VENDING_HTTP_PORT: 5000,
 *           VENDING_BAUD_RATE: 9600,
 *           VENDING_BASE_PATH: '/api/v1',
 *           NODE_ENV: 'production',
 *         },
 *       },
 *     ],
 *   };
 */
const entryFromArgv =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
const entryFromPm2 =
  process.env.pm_exec_path &&
  fileURLToPath(import.meta.url) === path.resolve(process.env.pm_exec_path);

if (entryFromArgv || entryFromPm2) {
  const { emulatorFlag, hardwareFlag, args } = parseCliArgs(
    process.argv.slice(2),
  );
  const emulatorEnabled = emulatorFlag
    ? true
    : hardwareFlag
      ? false
      : parseBooleanFlag(process.env.VENDING_EMULATOR, false);

  const portPathFromEnv = process.env.VENDING_PORT_PATH;
  const portPathFromArgs = args[0];
  const portPath =
    portPathFromEnv ||
    portPathFromArgs ||
    (emulatorEnabled ? null : '/dev/ttyS3');

  const httpPort = Number(
    process.env.VENDING_HTTP_PORT || args[1] || 5000,
  );

  const baudRate = Number(
    process.env.VENDING_BAUD_RATE || 9600,
  );

  const basePath =
    process.env.VENDING_BASE_PATH || '/api/v1';

  const logger = (entry) => {
    // eslint-disable-next-line no-console
    console.log(
      `[${new Date().toISOString()}]`,
      JSON.stringify(entry),
    );
  };

  let serverRef = null;
  let controllerRef = null;

  startVendingHttpServer({
    portPath,
    httpPort,
    baudRate,
    basePath,
    logger,
    emulator: emulatorEnabled,
  })
    .then(({ server, controller }) => {
      serverRef = server;
      controllerRef = controller;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to start Vending HTTP API:', err);
      process.exit(1);
    });

  const gracefulShutdown = async (signal) => {
    logger({ type: 'info', message: `Received ${signal}, shutting down...` });
    try {
      if (serverRef) {
        await new Promise((resolve) => serverRef.close(resolve));
      }
      if (controllerRef) {
        await controllerRef.close();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error during shutdown:', err);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
