const PAYMENT_DELAY_MS = Number(process.env.PAYMENT_DELAY_MS || 5000);

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off']);

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
};

const parseNumberList = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const DEFAULT_FAIL_CELLS = parseNumberList(
  process.env.PAYMENT_DEVICE_FAIL_CELL_NUMBERS || '',
);

let emulationEnabled = parseBoolean(process.env.PAYMENT_DEVICE_EMULATOR, true);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldFail = (cellNumber) => DEFAULT_FAIL_CELLS.includes(cellNumber);

const emulatePayment = async ({ cellNumber }) => {
  if (Number.isFinite(PAYMENT_DELAY_MS) && PAYMENT_DELAY_MS > 0) {
    await delay(PAYMENT_DELAY_MS);
  }

  if (shouldFail(cellNumber)) {
    const error = new Error('Payment rejected by payment emulator');
    error.statusCode = 402;
    error.code = 'PAYMENT_DECLINED';
    error.details = { cellNumber };
    throw error;
  }

  return {
    success: true,
    reference: `emu-${Date.now()}`,
  };
};

const processPayment = async ({ cellNumber, price, productId } = {}) => {
  if (!Number.isInteger(cellNumber) || cellNumber <= 0) {
    const error = new Error(
      'processPayment: "cellNumber" must be a positive integer',
    );
    error.statusCode = 400;
    throw error;
  }

  if (emulationEnabled) {
    return emulatePayment({ cellNumber, price, productId });
  }

  const error = new Error('Payment device is not available');
  error.statusCode = 503;
  error.code = 'PAYMENT_DEVICE_OFFLINE';
  error.details = { cellNumber };
  throw error;
};

const isPaymentEmulationEnabled = () => emulationEnabled;

const setPaymentEmulationEnabled = (enabled) => {
  emulationEnabled = Boolean(enabled);
  return emulationEnabled;
};

module.exports = {
  processPayment,
  isPaymentEmulationEnabled,
  setPaymentEmulationEnabled,
};
