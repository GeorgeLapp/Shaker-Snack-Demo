const path = require('path');
const { pathToFileURL } = require('url');
const { logEvent } = require('../logger');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off']);

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

const PAYMENT_APPROVAL_TIMEOUT_MS = Number(
  process.env.PAYMENT_APPROVAL_TIMEOUT_MS || 20000,
);
const PAYMENT_SESSION_TTL_MS = Number(
  process.env.PAYMENT_SESSION_TTL_MS || 60000,
);
const DEFAULT_PAYMENT_PORT_PATH = '/dev/ttyS4';
const PAYMENT_PORT_PATH =
  process.env.PAYMENT_PORT_PATH ||
  process.env.PAYMENT_DEVICE_PORT_PATH ||
  DEFAULT_PAYMENT_PORT_PATH;
const PAYMENT_BAUD_RATE = Number(process.env.PAYMENT_BAUD_RATE || 9600);
const PAYMENT_CASHLESS_NUMBER = Number(process.env.PAYMENT_CASHLESS_NUMBER || 1);
const PAYMENT_DEBUG = parseBoolean(process.env.PAYMENT_DEVICE_DEBUG, false);
const FORCE_32BIT_PRICE = parseBoolean(process.env.PAYMENT_FORCE_32BIT_PRICE, false);

class PaymentError extends Error {
  constructor(message, { code = 'PAYMENT_ERROR', statusCode = 402, details } = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

let activeSession = null;
let hardwareDriver = null;
let hardwareInitPromise = null;
let hardwareConstants = null;
let hardwareOptions = {
  alwaysIdle: null,
  money32: null,
  raw: null,
};
const PAYMENT_INIT_BOOT_DELAY_MS = Number(
  process.env.PAYMENT_INIT_BOOT_DELAY_MS || 1200,
);
const PAYMENT_INIT_RETRY_COUNT = Number(
  process.env.PAYMENT_INIT_RETRY_COUNT || 3,
);
const PAYMENT_INIT_RETRY_DELAY_MS = Number(
  process.env.PAYMENT_INIT_RETRY_DELAY_MS || 800,
);

const clearExpiredSession = () => {
  if (!activeSession) return null;
  if (
    Number.isFinite(PAYMENT_SESSION_TTL_MS) &&
    PAYMENT_SESSION_TTL_MS > 0 &&
    Date.now() - activeSession.createdAt > PAYMENT_SESSION_TTL_MS
  ) {
    logEvent('payment.session.expired', {
      cellNumber: activeSession.cellNumber,
      sessionId: activeSession.id,
    });
    activeSession = null;
  }
  return activeSession;
};

const setActiveSession = (session) => {
  activeSession = session;
};

const ensureNoActiveSession = () => {
  const current = clearExpiredSession();
  if (current) {
    throw new PaymentError('Another payment session is already in progress', {
      code: 'PAYMENT_IN_PROGRESS',
      statusCode: 409,
      details: { cellNumber: current.cellNumber, sessionId: current.id },
    });
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadHardwareModule = async () => {
  const modulePath = path.resolve(
    __dirname,
    './mdb-rs232-cashless.mjs',
  );
  const moduleUrl = pathToFileURL(modulePath).href;
  try {
    return await import(moduleUrl);
  } catch (err) {
    throw new PaymentError(
      `Payment driver module is not available: ${err.message}`,
      {
      code: 'PAYMENT_MODULE_NOT_FOUND',
      statusCode: 503,
      details: { modulePath, message: err.message },
      },
    );
  }
};

const attachDriverLogging = (driver) => {
  driver.on('warn', (payload) => {
    logEvent('payment.hardware.warn', payload || {});
  });

  driver.on('error', (err) => {
    logEvent('payment.hardware.error', {
      message: err?.message,
      code: err?.code,
    });
  });

  if (PAYMENT_DEBUG) {
    driver.on('activity:cashless', (ev) => {
      const raw =
        ev?.raw && Buffer.isBuffer(ev.raw)
          ? ev.raw.toString('hex').toUpperCase()
          : undefined;
      logEvent('payment.hardware.activity', {
        type: ev?.type,
        code: ev?.code,
        raw,
      });
    });
  }
};

const ensureHardwareDriver = async () => {
  if (hardwareDriver) return hardwareDriver;
  if (hardwareInitPromise) return hardwareInitPromise;

  hardwareInitPromise = (async () => {
    if (!PAYMENT_PORT_PATH) {
      throw new PaymentError('Payment serial port is not configured', {
        code: 'PAYMENT_PORT_UNSET',
        statusCode: 503,
      });
    }

    const module = await loadHardwareModule();
    const Driver = module?.default;
    if (!Driver) {
      throw new PaymentError('Payment driver export is missing', {
        code: 'PAYMENT_DRIVER_MISSING',
        statusCode: 503,
      });
    }

    hardwareConstants = module.CashlessConstants || {};

    const driver = new Driver({
      portPath: PAYMENT_PORT_PATH,
      cashlessNumber: PAYMENT_CASHLESS_NUMBER,
      baudRate: PAYMENT_BAUD_RATE,
      debug: PAYMENT_DEBUG,
      autoPoll: false,
    });

    attachDriverLogging(driver);

    await driver.open();
    logEvent('payment.hardware.opened', {
      portPath: PAYMENT_PORT_PATH,
      baudRate: PAYMENT_BAUD_RATE,
      cashlessNumber: PAYMENT_CASHLESS_NUMBER,
    });

    const initSequence = async () => {
      // Reset and wake up bridge
      try {
        await driver.reset();
      } catch (err) {
        logEvent('payment.hardware.reset.failed', { message: err.message });
      }

      // Request optional feature bits then enable Always Idle (early init)
      let idInfo = null;
      try {
        idInfo = await driver.expansionRequestId(1600);
      } catch (err) {
        logEvent('payment.hardware.expansion.requestId.warn', { message: err.message });
      }

      if (idInfo?.options && Buffer.isBuffer(idInfo.options) && idInfo.options.length > 0) {
        const optByte = idInfo.options[idInfo.options.length - 1];
        hardwareOptions = {
          alwaysIdle: (optByte & (hardwareConstants.OPT_FEATURE_ALWAYS_IDLE || 0)) !== 0,
          money32: (optByte & (hardwareConstants.OPT_FEATURE_32BIT_MONEY || 0)) !== 0,
          raw: idInfo.options,
        };
        logEvent('payment.hardware.options.detected', {
          raw: idInfo.options.toString('hex').toUpperCase(),
          alwaysIdle: hardwareOptions.alwaysIdle,
          money32: hardwareOptions.money32,
        });
      } else {
        hardwareOptions = { alwaysIdle: null, money32: null, raw: null };
        logEvent('payment.hardware.options.unknown', {});
      }

      if (hardwareOptions.alwaysIdle === false) {
        throw new PaymentError('Always Idle is not supported by reader', {
          code: 'PAYMENT_ALWAYS_IDLE_UNSUPPORTED',
          statusCode: 503,
          details: { options: hardwareOptions.raw?.toString('hex') || null },
        });
      }

      const optionsMask =
        (hardwareConstants.OPT_FEATURE_ALWAYS_IDLE || 0) |
        (hardwareOptions.money32 ? hardwareConstants.OPT_FEATURE_32BIT_MONEY || 0 : 0);

      try {
        await driver.expansionEnableOptions(optionsMask, { timeoutMs: 1500 });
        logEvent('payment.hardware.options.enabled', { optionsMask });
      } catch (err) {
        throw new PaymentError('Failed to enable Always Idle mode', {
          code: 'PAYMENT_ALWAYS_IDLE_FAILED',
          statusCode: 503,
          details: { message: err.message },
        });
      }

      // Base config (Feature Level 3, ASCII display)
      const cfg = await driver.setupConfig({
        vmcFeatureLevel: 3,
        columns: 0,
        rows: 0,
        displayType: 'fullAscii',
      });
      logEvent('payment.hardware.readerConfig', {
        scalingFactor: cfg?.scalingFactor,
        decimalPlaces: cfg?.decimalPlaces,
      });

      await driver.setupMaxMinPrices({
        maxPriceScaled: 0xffff,
        minPriceScaled: 0x0000,
      });

      // Re-apply Always Idle after setup to ensure it stays enabled.
      await driver.expansionEnableOptions(optionsMask, { timeoutMs: 1500 });
      logEvent('payment.hardware.options.reapplied', { optionsMask });

      try {
        await driver.readerEnable();
      } catch (err) {
        throw new PaymentError('Failed to enable cashless reader', {
          code: 'PAYMENT_READER_ENABLE_FAILED',
          statusCode: 503,
          details: { message: err.message },
        });
      }
    };

    try {
      await sleep(PAYMENT_INIT_BOOT_DELAY_MS);
    } catch {}

    for (let attempt = 1; attempt <= PAYMENT_INIT_RETRY_COUNT; attempt += 1) {
      try {
        await driver.flush();
      } catch (err) {
        logEvent('payment.hardware.flush.warn', { message: err.message });
      }

      try {
        await initSequence();
        break;
      } catch (err) {
        if (attempt >= PAYMENT_INIT_RETRY_COUNT) {
          throw err;
        }
        logEvent('payment.hardware.init.retry', {
          attempt,
          message: err.message,
        });
        await sleep(PAYMENT_INIT_RETRY_DELAY_MS);
      }
    }

    driver.startPoller();

    hardwareDriver = driver;
    return driver;
  })();

  return hardwareInitPromise.catch((err) => {
    hardwareInitPromise = null;
    hardwareDriver = null;
    throw err;
  });
};

const normalizePrice = (price) => {
  const normalized = Number(price);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new PaymentError('Price must be a positive number', {
      code: 'BAD_PRICE',
      statusCode: 400,
      details: { price },
    });
  }
  return normalized;
};

const scalePrice = (driver, price) => {
  const normalized = normalizePrice(price);
  let scaled = Math.round(normalized * 100);
  let usedReaderScale = false;

  if (driver && typeof driver.realToScaled === 'function') {
    try {
      scaled = driver.realToScaled(normalized, { rounding: 'ceil' });
      usedReaderScale = true;
    } catch (err) {
      logEvent('payment.hardware.scaleFallback', {
        message: err.message,
        price,
        fallbackScaled: scaled,
      });
    }
  }

  const supports32Bit = hardwareOptions.money32 === true;
  if (!supports32Bit && scaled > 0xffff) {
    throw new PaymentError('Price exceeds 16-bit range for reader', {
      code: 'PRICE_TOO_LARGE',
      statusCode: 400,
      details: { price: normalized, scaled },
    });
  }
  const use32bit =
    supports32Bit && (FORCE_32BIT_PRICE || scaled > 0xffff);
  return { scaled, use32bit, usedReaderScale };
};

const waitForApproval = (driver, session) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      driver.off('vendApproved', onApproved);
      driver.off('vendDenied', onDenied);
      driver.off('sessionCancelRequest', onCancel);
      driver.off('cancelled', onCancel);
      driver.off('endSession', onEnded);
      driver.off('error', onError);
      clearTimeout(timer);
    };

    const onApproved = (ev) => {
      cleanup();
      resolve(ev);
    };
    const onDenied = (ev) => {
      cleanup();
      reject(
        new PaymentError('Payment was declined by reader', {
          code: 'PAYMENT_DECLINED',
          statusCode: 402,
          details: { event: ev },
        }),
      );
    };
    const onCancel = (ev) => {
      cleanup();
      reject(
        new PaymentError('Payment was cancelled', {
          code: 'PAYMENT_CANCELLED',
          statusCode: 499,
          details: { event: ev },
        }),
      );
    };
    const onEnded = (ev) => {
      cleanup();
      reject(
        new PaymentError('Payment session ended prematurely', {
          code: 'PAYMENT_SESSION_ENDED',
          statusCode: 409,
          details: { event: ev },
        }),
      );
    };
    const onError = (err) => {
      cleanup();
      reject(
        new PaymentError(err?.message || 'Payment device error', {
          code: err?.code || 'PAYMENT_DEVICE_ERROR',
          statusCode: err?.statusCode || 502,
        }),
      );
    };

    driver.on('vendApproved', onApproved);
    driver.on('vendDenied', onDenied);
    driver.on('sessionCancelRequest', onCancel);
    driver.on('cancelled', onCancel);
    driver.on('endSession', onEnded);
    driver.on('error', onError);

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new PaymentError('Timed out waiting for payment approval', {
          code: 'PAYMENT_TIMEOUT',
          statusCode: 504,
          details: { cellNumber: session.cellNumber },
        }),
      );
    }, PAYMENT_APPROVAL_TIMEOUT_MS);
  });

const processPayment = async ({ cellNumber, price, productId } = {}) => {
  if (!Number.isInteger(cellNumber) || cellNumber <= 0) {
    throw new PaymentError(
      'processPayment: "cellNumber" must be a positive integer',
      { code: 'BAD_CELL', statusCode: 400 },
    );
  }

  ensureNoActiveSession();

  const driver = await ensureHardwareDriver();
  const { scaled, use32bit } = scalePrice(driver, price);
  const sessionId = `hw-${Date.now()}`;

  setActiveSession({
    id: sessionId,
    mode: 'hardware',
    cellNumber,
    productId,
    scaledPrice: scaled,
    use32bit,
    state: 'pending',
    createdAt: Date.now(),
  });

  try {
    await driver.vendRequest({
      priceScaled: scaled,
      itemNumber: cellNumber,
      use32bit,
    });
    const approval = await waitForApproval(driver, activeSession);
    activeSession.state = 'approved';
    activeSession.reference = sessionId;

    logEvent('payment.hardware.approved', {
      cellNumber,
      scaledPrice: scaled,
      use32bit,
      paymentType: approval?.paymentTypeInfo?.modeName,
    });

    return { success: true, reference: sessionId };
  } catch (err) {
    const wrapped =
      err instanceof PaymentError
        ? err
        : new PaymentError(err?.message || 'Payment failed', {
            code: err?.code || 'PAYMENT_FAILED',
            statusCode: err?.statusCode || 502,
          });
    setActiveSession(null);
    throw wrapped;
  }
};

const cancelPayment = async () => {
  const session = clearExpiredSession();
  if (!session) {
    return;
  }

  try {
    const driver = await ensureHardwareDriver();
    await driver.vendCancel();
    try {
      await driver.sessionComplete();
    } catch (err) {
      logEvent('payment.hardware.cancel.sessionComplete.warn', { message: err.message });
    }
  } catch (err) {
    logEvent('payment.hardware.cancel.error', { message: err?.message });
  } finally {
    setActiveSession(null);
  }
};

const finalizePaymentAfterVend = async ({
  cellNumber,
  success,
  reason = null,
} = {}) => {
  const session = clearExpiredSession();
  if (!session || session.cellNumber !== Number(cellNumber)) {
    return;
  }

  if (session.state === 'finalizing' || session.state === 'finalized') {
    return;
  }

  session.state = 'finalizing';

  try {
    const driver = await ensureHardwareDriver();
    if (success) {
      await driver.vendSuccess(session.cellNumber);
      logEvent('payment.hardware.vendSuccess', { cellNumber });
    } else {
      await driver.vendFailure();
      logEvent('payment.hardware.vendFailure', { cellNumber, reason });
    }

    try {
      await driver.sessionComplete();
    } catch (err) {
      logEvent('payment.hardware.sessionComplete.warn', {
        message: err.message,
      });
    }
  } catch (err) {
    logEvent('payment.hardware.finalize.error', {
      cellNumber,
      success,
      message: err?.message,
    });
  } finally {
    session.state = 'finalized';
    setActiveSession(null);
  }
};

const warmupPaymentDevice = async () => {
  try {
    await ensureHardwareDriver();
    logEvent('payment.hardware.ready', {});
  } catch (err) {
    logEvent('payment.hardware.warmup.failed', { message: err?.message });
    throw err;
  }
};

module.exports = {
  processPayment,
  finalizePaymentAfterVend,
  cancelPayment,
  warmupPaymentDevice,
  PaymentError,
};
