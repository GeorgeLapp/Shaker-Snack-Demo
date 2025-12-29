import { VendingControllerError, ERROR_CODES } from './vending-controller.mjs';

const INVALID_ARGUMENT_MESSAGE = 'Invalid method argument';
const PORT_NOT_OPEN_MESSAGE = 'Serial port is not open';

const STATUS_OK = 0x5d;
const STATUS_ERROR = 0x5c;

const MIN_CHANNEL = 1;
const MAX_LOGICAL_CHANNEL = 80;
const DEFAULT_MAX_CHANNEL = 60;
const DEFAULT_TEMPERATURE_C = 4;

const DROP_CHECK_ENABLED = 0xaa;
const DROP_CHECK_DISABLED = 0x55;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildRawReply({ status = STATUS_OK, data = 0x00, aux = 0x00 } = {}) {
  return Buffer.from([0x00, status & 0xff, data & 0xff, aux & 0xff, 0x00]);
}

export class EmulatedVendingController {
  constructor({ logger, maxChannel = DEFAULT_MAX_CHANNEL, temperatureC = DEFAULT_TEMPERATURE_C } = {}) {
    this._logger = typeof logger === 'function' ? logger : () => {};
    this._maxChannel =
      Number.isInteger(maxChannel) && maxChannel > 0
        ? maxChannel
        : DEFAULT_MAX_CHANNEL;
    this._temperatureC = Number.isFinite(temperatureC)
      ? Math.round(temperatureC)
      : DEFAULT_TEMPERATURE_C;
    this._isOpen = false;
    this._doorState = 'closed';
    this._lighting = false;
    this._buzzer = false;
    this._glassHeater = false;
    this._tempControlEnabled = true;
    this._thermoMode = 'cool';
    this._setpoint = this._temperatureC;
    this._hysteresis = 2;
    this._compensation = 0;
    this._defrostMinutes = 0;
    this._compressorRunMinutes = 0;
    this._fanIdleOffDelay = 0;
    this._lastReply = {
      status: STATUS_OK,
      data: 0x00,
      aux: 0x00,
      raw: buildRawReply(),
    };
  }

  async open() {
    this._isOpen = true;
  }

  async close() {
    this._isOpen = false;
  }

  _ensureOpen() {
    if (!this._isOpen) {
      throw new VendingControllerError(
        ERROR_CODES.PORT_NOT_OPEN,
        PORT_NOT_OPEN_MESSAGE,
      );
    }
  }

  _validateChannel(channel) {
    if (
      typeof channel !== 'number' ||
      !Number.isInteger(channel) ||
      channel < MIN_CHANNEL ||
      channel > MAX_LOGICAL_CHANNEL
    ) {
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        INVALID_ARGUMENT_MESSAGE,
        {
          reason: 'Invalid channel number',
          channel,
          allowedRange: [MIN_CHANNEL, MAX_LOGICAL_CHANNEL],
        },
      );
    }
  }

  _validateTimeout(timeoutMs) {
    if (timeoutMs === undefined) return;
    if (
      typeof timeoutMs !== 'number' ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new VendingControllerError(
        ERROR_CODES.INVALID_ARGUMENT,
        INVALID_ARGUMENT_MESSAGE,
        {
          reason: 'Invalid timeoutMs',
          timeoutMs,
        },
      );
    }
  }

  _buildReply({ status = STATUS_OK, data = 0x00, aux = 0x00 } = {}) {
    const reply = {
      status,
      data,
      aux,
      raw: buildRawReply({ status, data, aux }),
    };
    this._lastReply = reply;
    return reply;
  }

  _log(event, payload = {}) {
    this._logger({ type: 'emulator', event, ...payload });
  }

  async vendSimple(channel, timeoutMs = 10_000) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({
      status: STATUS_OK,
      data: channel & 0xff,
      aux: DROP_CHECK_DISABLED,
    });
    this._log('vendSimple', { channel });

    return {
      channel,
      raw: reply.raw,
    };
  }

  async vendWithDropCheck(channel, timeoutMs = 10_000) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({
      status: STATUS_OK,
      data: channel & 0xff,
      aux: DROP_CHECK_ENABLED,
    });
    this._log('vendWithDropCheck', { channel, dropped: true });

    return {
      channel,
      dropped: true,
      raw: reply.raw,
    };
  }

  async channelExists(channel, timeoutMs = 300) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const exists = channel <= this._maxChannel;
    const reply = this._buildReply({
      status: exists ? STATUS_OK : STATUS_ERROR,
      data: exists ? 0x01 : 0x00,
    });

    return {
      exists,
      raw: reply.raw,
    };
  }

  async pollAllChannels({
    maxChannel = DEFAULT_MAX_CHANNEL,
    interChannelDelayMs = 50,
    timeoutMs = 300,
  } = {}) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const effectiveMax = Math.min(
      MAX_LOGICAL_CHANNEL,
      Math.max(MIN_CHANNEL, Number(maxChannel) || DEFAULT_MAX_CHANNEL),
    );
    const delayMs = Number.isFinite(interChannelDelayMs)
      ? Math.max(0, interChannelDelayMs)
      : 0;

    const results = [];
    for (let ch = MIN_CHANNEL; ch <= effectiveMax; ch += 1) {
      if (delayMs > 0 && ch > MIN_CHANNEL) {
        await delay(delayMs);
      }
      const res = await this.channelExists(ch, timeoutMs);
      results.push({
        channel: ch,
        exists: res.exists,
        status: 'ok',
        error: null,
      });
    }

    return results;
  }

  async selfTest(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: 0x01 });
    this._log('selfTest', { ok: true });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async resetAll(timeoutMs = 10_000) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK });
    this._log('resetAll');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async repeatLastReply(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._lastReply || this._buildReply({ status: STATUS_OK });
    this._log('repeatLastReply');

    return {
      raw: reply.raw,
    };
  }

  async setChannelTypeBelt(channel, timeoutMs = 300) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: channel & 0xff });
    this._log('setChannelTypeBelt', { channel });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setChannelTypeSpring(channel, timeoutMs = 300) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: channel & 0xff });
    this._log('setChannelTypeSpring', { channel });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setAllSpring(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: 0x01 });
    this._log('setAllSpring');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setAllBelt(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: 0x01 });
    this._log('setAllBelt');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async makeSingle(channel, timeoutMs = 300) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: channel & 0xff });
    this._log('makeSingle', { channel });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async makeDouble(channel, timeoutMs = 300) {
    this._ensureOpen();
    this._validateChannel(channel);
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK, data: channel & 0xff });
    this._log('makeDouble', { channel });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async makeAllSingle(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK });
    this._log('makeAllSingle');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async readTemperature(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const celsius = Math.max(-128, Math.min(127, this._temperatureC));
    const reply = this._buildReply({ status: STATUS_OK, data: celsius & 0xff });
    this._log('readTemperature', { celsius });

    return {
      celsius,
      raw: reply.raw,
    };
  }

  async tempControlEnable(enabled, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._tempControlEnabled = Boolean(enabled);
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._tempControlEnabled ? 0x01 : 0x00,
    });
    this._log('tempControlEnable', { enabled: this._tempControlEnabled });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setThermoMode(mode, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._thermoMode = mode === 'heat' ? 'heat' : 'cool';
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._thermoMode === 'cool' ? 0x01 : 0x00,
    });
    this._log('setThermoMode', { mode: this._thermoMode });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setSetpoint(celsius, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._setpoint = Number.isFinite(celsius) ? Math.round(celsius) : this._setpoint;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._setpoint & 0xff,
    });
    this._log('setSetpoint', { celsius: this._setpoint });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setHysteresis(deltaC, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._hysteresis = Number.isFinite(deltaC) ? Math.round(deltaC) : this._hysteresis;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._hysteresis & 0xff,
    });
    this._log('setHysteresis', { deltaC: this._hysteresis });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setCompensation(celsius, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._compensation = Number.isFinite(celsius) ? Math.round(celsius) : this._compensation;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._compensation & 0xff,
    });
    this._log('setCompensation', { celsius: this._compensation });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setDefrostMinutes(minutes, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._defrostMinutes = Number.isFinite(minutes) ? Math.round(minutes) : this._defrostMinutes;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._defrostMinutes & 0xff,
    });
    this._log('setDefrostMinutes', { minutes: this._defrostMinutes });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setCompressorRunMinutes(minutes, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._compressorRunMinutes = Number.isFinite(minutes)
      ? Math.round(minutes)
      : this._compressorRunMinutes;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._compressorRunMinutes & 0xff,
    });
    this._log('setCompressorRunMinutes', { minutes: this._compressorRunMinutes });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setFanIdleOffDelay(minutes, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._fanIdleOffDelay = Number.isFinite(minutes)
      ? Math.round(minutes)
      : this._fanIdleOffDelay;
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._fanIdleOffDelay & 0xff,
    });
    this._log('setFanIdleOffDelay', { minutes: this._fanIdleOffDelay });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setGlassHeater(on, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._glassHeater = Boolean(on);
    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._glassHeater ? 0x01 : 0x00,
    });
    this._log('setGlassHeater', { on: this._glassHeater });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async readDoor(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({
      status: STATUS_OK,
      data: this._doorState === 'open' ? 0x01 : 0x00,
    });
    this._log('readDoor', { state: this._doorState });

    return {
      state: this._doorState,
      raw: reply.raw,
    };
  }

  async openDoor(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._doorState = 'open';
    const reply = this._buildReply({
      status: STATUS_OK,
      data: 0x01,
    });
    this._log('openDoor');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async unlockDoor(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._doorState = 'open';
    const reply = this._buildReply({
      status: STATUS_OK,
      data: 0x01,
    });
    this._log('unlockDoor');

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setLighting(on, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._lighting = Boolean(on);
    const reply = this._buildReply({
      status: STATUS_OK,
      aux: this._lighting ? DROP_CHECK_ENABLED : DROP_CHECK_DISABLED,
    });
    this._log('setLighting', { on: this._lighting });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async setBuzzer(on, timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    this._buzzer = Boolean(on);
    const reply = this._buildReply({
      status: STATUS_OK,
      aux: this._buzzer ? DROP_CHECK_ENABLED : DROP_CHECK_DISABLED,
    });
    this._log('setBuzzer', { on: this._buzzer });

    return {
      ok: true,
      raw: reply.raw,
    };
  }

  async enableAccelerometer(timeoutMs = 300) {
    this._ensureOpen();
    this._validateTimeout(timeoutMs);

    const reply = this._buildReply({ status: STATUS_OK });
    this._log('enableAccelerometer');

    return {
      ok: true,
      raw: reply.raw,
    };
  }
}
