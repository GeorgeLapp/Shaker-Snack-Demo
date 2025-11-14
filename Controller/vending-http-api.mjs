// vending-http-api.mjs

/**
 * HTTP API для вызова методов модуля vending-controller.
 *
 * Этот модуль поднимает HTTP-сервер и предоставляет REST-эндпоинты
 * для управления контроллером вендингового автомата:
 *
 *   POST /api/v1/vend/simple
 *   POST /api/v1/vend/drop-check
 *   GET  /api/v1/channels/:channel/exists
 *   GET  /api/v1/channels/poll
 *   POST /api/v1/self-test
 *   POST /api/v1/reset-all
 *   GET  /api/v1/temperature
 *   GET  /api/v1/door
 *   POST /api/v1/door/open
 *   POST /api/v1/door/unlock
 *   POST /api/v1/lighting
 *   POST /api/v1/buzzer
 *   POST /api/v1/temp/control
 *   POST /api/v1/temp/mode
 *   POST /api/v1/temp/setpoint
 *   POST /api/v1/temp/hysteresis
 *   POST /api/v1/temp/compensation
 *   POST /api/v1/temp/defrost
 *   POST /api/v1/temp/compressor-run
 *   POST /api/v1/temp/fan-idle-off
 *
 * Формат ответов:
 *   Успех:
 *     { "success": true,  "data": { ... } }
 *
 *   Ошибка:
 *     {
 *       "success": false,
 *       "error": {
 *         "code": "INVALID_ARGUMENT",
 *         "message": "Invalid method argument",
 *         "details": { ... }        // может отсутствовать
 *       }
 *     }
 */

import express from 'express';
import {
  VendingController,
  VendingControllerError,
  ERROR_CODES,
} from './vending-controller.mjs';

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
  // Если это "наш" специализированный класс
  if (err instanceof VendingControllerError) {
    let status = 500;

    switch (err.code) {
      case ERROR_CODES.INVALID_ARGUMENT:
        status = 400; // некорректный параметр запроса клиента
        break;
      case ERROR_CODES.PORT_NOT_OPEN:
        status = 503; // порт недоступен, сервис временно не работает
        break;
      case ERROR_CODES.COMM_TIMEOUT:
        status = 504; // тайм-аут взаимодействия с контроллером
        break;
      case ERROR_CODES.CONTROLLER_ERROR:
        status = 502; // контроллер вернул ошибку (низкоуровневая)
        break;
      case ERROR_CODES.PROTOCOL_BAD_LENGTH:
      case ERROR_CODES.PROTOCOL_BAD_CHECKSUM:
      case ERROR_CODES.PROTOCOL_UNEXPECTED_STATUS:
        status = 502; // ошибка протокола
        break;
      default:
        status = 500;
    }

    const body = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        // details могут содержать расшифровку механических/оптических ошибок, статусы и т.п.
        ...(err.details ? { details: err.details } : {}),
      },
    };

    return { status, body };
  }

  // Непредвиденная ошибка (не из слоя контроллера)
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

/* ========================================================================== */
/*                     СОЗДАНИЕ HTTP-ПРИЛОЖЕНИЯ / СЕРВЕРА                     */
/* ========================================================================== */

/**
 * Создаёт и настраивает экземпляр Express-приложения для HTTP API.
 *
 * ВАЖНО:
 *   - Открытие/закрытие UART-порта здесь НЕ выполняется.
 *     Предполагается, что экземпляр VendingController уже создан и открыт
 *     во внешнем коде (или вы используете startVendingHttpServer).
 *
 * @param {object} options
 * @param {VendingController} options.controller - уже созданный экземпляр контроллера
 * @param {string} [options.basePath='/api/v1'] - базовый путь для всех эндпоинтов
 * @param {(logObj:any) => void} [options.logger] - опциональный логгер (по умолчанию console.log)
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

  // Простейший middleware-логгер HTTP-запросов (можно выключить при необходимости).
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

  /* ------------------------------------------------------------------------ */
  /*                       ГРУППИРОВКА МАРШРУТОВ ПО basePath                   */
  /* ------------------------------------------------------------------------ */

  const router = express.Router();

  /* ============================== ВЫДАЧА ТОВАРА =========================== */

  /**
   * POST /vend/simple
   * Тело запроса:
   *   { "channel": number, "timeoutMs"?: number }
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
   * Выдача с контролем падения.
   * Тело:
   *   { "channel": number, "timeoutMs"?: number }
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

  /* ========================= ПРОВЕРКА / ОПРОС КАНАЛОВ ===================== */

  /**
   * GET /channels/:channel/exists?timeoutMs=...
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
   * Возвращает массив с результатом по каждому каналу.
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
          // Ошибку (если есть) сводим к "плоскому" виду,
          // чтобы не тащить туда Buffer'ы и прочее.
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

  /* ======================== ДИАГНОСТИКА / САМТЕСТ ======================== */

  /**
   * POST /self-test
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

  /* ============================ ТЕМПЕРАТУРА ============================== */

  /**
   * GET /temperature
   * Параметр timeoutMs можно передать как query.
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
   * Тело:
   *   { "enabled": boolean, "timeoutMs"?: number }
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
   * Тело:
   *   { "mode": "cool" | "heat", "timeoutMs"?: number }
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
   * Тело:
   *   { "celsius": number, "timeoutMs"?: number }
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
   * Тело:
   *   { "deltaC": number, "timeoutMs"?: number }
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
   * Тело:
   *   { "celsius": number, "timeoutMs"?: number }
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
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
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
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
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
   * Тело:
   *   { "minutes": number, "timeoutMs"?: number }
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

  /* =============================== ДВЕРЬ/СВЕТ/ЗВУК ======================== */

  /**
   * GET /door
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
          state: result.state, // 'open' | 'closed'
          rawHex: result.raw.toString('hex'),
        },
      });
    }),
  );

  /**
   * POST /door/open
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
   * Тело:
   *   { "on": boolean, "timeoutMs"?: number }
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
   * Тело:
   *   { "on": boolean, "timeoutMs"?: number }
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

  /* ========================== МОНТАЖ ROUTER И ОБРАБОТКА ОШИБОК ============ */

  app.use(basePath, router);

  // Централизованный обработчик ошибок всех asyncRoute
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
 * Удобно использовать для быстрого запуска демо/сервиса:
 *
 *   node vending-http-api.mjs
 *
 * или импортировать и вызвать програмно.
 *
 * @param {object} options
 * @param {string} options.portPath - путь к UART-порту (COM3, /dev/ttyS0 и т.п.)
 * @param {number} [options.baudRate=9600] - скорость порта
 * @param {number} [options.httpPort=3001] - порт HTTP-сервера
 * @param {string} [options.basePath='/api/v1'] - базовый путь API
 * @param {(logObj:any) => void} [options.logger] - логгер (по умолчанию console.log)
 * @returns {Promise<{ app: import('express').Express, server: import('http').Server, controller: VendingController }>}
 */
export async function startVendingHttpServer({
  portPath,
  baudRate = 9600,
  httpPort = 3001,
  basePath = '/api/v1',
  logger = console.log,
} = {}) {
  if (!portPath) {
    throw new Error('startVendingHttpServer: "portPath" is required');
  }

  const controller = new VendingController({
    portPath,
    baudRate,
    logger,
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
    });
  });

  return { app, server, controller };
}

/* ========================================================================== */
/*                 НЕОБЯЗАТЕЛЬНЫЙ АВТОЗАПУСК ПРИ ПРЯМОМ ЗАПУСКЕ              */
/* ========================================================================== */

/**
 * Если файл запущен напрямую командой:
 *   node vending-http-api.mjs /dev/ttyUSB0 3001
 * или:
 *   node vending-http-api.mjs COM3 3001
 * — автоматически стартуем HTTP-сервер.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const portPath = process.argv[2] || '/dev/ttyUSB0';
  const httpPort = process.argv[3] ? Number(process.argv[3]) : 3001;

  // Простейший логгер
  const logger = (entry) => {
    // Можно заменить на более структурированный лог
    // или прокинуть в winston/pino.
    // Здесь — просто консоль.
    // eslint-disable-next-line no-console
    console.log(
      `[${new Date().toISOString()}]`,
      JSON.stringify(entry),
    );
  };

  // Запускаем без await, но обрабатываем возможную ошибку запуска.
  startVendingHttpServer({
    portPath,
    httpPort,
    logger,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start Vending HTTP API:', err);
    process.exit(1);
  });
}
