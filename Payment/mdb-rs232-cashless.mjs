// mdb-rs232-cashless.mjs
// ESM module for Node.js
//
// Implements VMC-side control of a Wafer MDB-RS232 bridge for MDB cashless reader (Nayax etc).
// Focus: cashless only (no coin/bill logic), with practical helpers for Product-First (Always Idle) flows.

import { EventEmitter } from "node:events";
import { SerialPort } from "serialport";

/**
 * ----------------------------
 * Protocol errors
 * ----------------------------
 */
export class ProtocolError extends Error {
  constructor(message, { code = "PROTO", details = {} } = {}) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.details = details;
  }
}

/**
 * ----------------------------
 * MDB-RS232 / Wafer framing
 * ----------------------------
 *
 * NOTE:
 * This module implements the RS-232 framing used by the Wafer MDB-RS232 bridge as used in this project:
 * - Simple command frames (no ASCII wrapper)
 * - ACK is single byte 0x00
 * - Cashless “activity” frames are prefixed with DeviceID (0x10 or 0x60), followed by code + payload
 *
 * The module is designed to be tolerant to “silence” where bridge may ACK but not send an immediate reply.
 */

/**
 * ----------------------------
 * Device IDs as used by Wafer bridge
 * ----------------------------
 *
 * DEVICE_ID_CASHLESS_1: Cashless device #1 (MDB address 0x10)
 * DEVICE_ID_CASHLESS_2: Cashless device #2 (MDB address 0x60)
 */
const DEVICE_ID_COIN_CHANGER = 0x08;
const DEVICE_ID_BILL_VALIDATOR = 0x30;
const DEVICE_ID_CASHLESS_1 = 0x10;
const DEVICE_ID_CASHLESS_2 = 0x60;

/**
 * ----------------------------
 * MDB CASHLESS commands (VMC -> bridge -> MDB bus)
 * ----------------------------
 */
const MDB_CASHLESS_CMD_POLL = 0x10; // Cashless Poll
const MDB_CASHLESS_CMD_SETUP = 0x11; // Cashless Setup
const MDB_CASHLESS_CMD_READER = 0x14; // Reader enable/disable
const MDB_CASHLESS_CMD_VEND = 0x13; // Vend commands (request/cancel/success/failure/session complete)
const MDB_CASHLESS_CMD_REVALUE = 0x15; // Revalue commands
const MDB_CASHLESS_CMD_EXPANSION = 0x17; // Expansion commands (options, ID request, etc.)

/**
 * ----------------------------
 * Cashless Setup subcommands
 * ----------------------------
 */
const MDB_SETUP_SUBCMD_CONFIG = 0x00; // Setup/config
const MDB_SETUP_SUBCMD_MAX_MIN_PRICES = 0x01; // Setup max/min prices (bridge-specific packaging)

/**
 * ----------------------------
 * Cashless Reader subcommands
 * ----------------------------
 */
const MDB_READER_SUBCMD_DISABLE = 0x00;
const MDB_READER_SUBCMD_ENABLE = 0x01;

/**
 * ----------------------------
 * Cashless Vend subcommands
 * ----------------------------
 */
const MDB_VEND_SUBCMD_REQUEST = 0x00;
const MDB_VEND_SUBCMD_CANCEL = 0x01;
const MDB_VEND_SUBCMD_SUCCESS = 0x02;
const MDB_VEND_SUBCMD_FAILURE = 0x03;
const MDB_VEND_SUBCMD_SESSION_COMPLETE = 0x04;

/**
 * ----------------------------
 * Cashless Revalue subcommands
 * ----------------------------
 */
const MDB_REVALUE_SUBCMD_REQUEST = 0x00;
const MDB_REVALUE_SUBCMD_LIMIT = 0x01;

/**
 * ----------------------------
 * Cashless Expansion subcommands (bridge-level)
 * ----------------------------
 */
const MDB_EXP_SUBCMD_REQUEST_ID = 0x00;
const MDB_EXP_SUBCMD_ENABLE = 0x04;

/**
 * ----------------------------
 * Expansion enable option bits (CashlessConstants exports below)
 * ----------------------------
 */
const OPT_FEATURE_ALWAYS_IDLE = 0x20; // b5 (Always Idle / Product First)
const OPT_FEATURE_32BIT_MONEY = 0x02; // bridge/project bit mapping (see CashlessConstants)

/**
 * ----------------------------
 * Utilities
 * ----------------------------
 */
function toHex(buf) {
  if (!buf) return "";
  return Buffer.from(buf).toString("hex").toUpperCase().replace(/(..)/g, "$1 ").trim();
}

function u16be(hi, lo) {
  return ((hi & 0xFF) << 8) | (lo & 0xFF);
}

function encodeU16BE(v) {
  if (!Number.isInteger(v) || v < 0 || v > 0xFFFF) {
    throw new ProtocolError("u16 out of range", { code: "RANGE_U16", details: { v } });
  }
  return [ (v >> 8) & 0xFF, v & 0xFF ];
}

function encodeU32BE(v) {
  if (!Number.isInteger(v) || v < 0 || v > 0xFFFFFFFF) {
    throw new ProtocolError("u32 out of range", { code: "RANGE_U32", details: { v } });
  }
  return [
    (v >>> 24) & 0xFF,
    (v >>> 16) & 0xFF,
    (v >>> 8) & 0xFF,
    v & 0xFF,
  ];
}

function decodeU32BE(b0, b1, b2, b3) {
  return (((b0 << 24) >>> 0) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

/**
 * ----------------------------
 * Cashless BEGIN SESSION paymentType (MDB 4.2)
 * ----------------------------
 *
 * paymentType is a single byte in BEGIN SESSION. High bits describe media type:
 *  - b7=1: Free vend card
 *  - else b6=1: Test media
 *  - else: Normal media
 *
 * Low 6 bits (b5..b0) describe pricing/discount mode and define meaning of paymentData bytes.
 * paymentData is typically 2 bytes (Z9..Z10) in Level 2/3 BEGIN SESSION.
 */
const PAYMENT_TYPE_FLAG_FREE_VEND = 0x80; // b7
const PAYMENT_TYPE_FLAG_TEST_MEDIA = 0x40; // b6
const PAYMENT_TYPE_MODE_MASK = 0x3F; // b5..b0

// Low-6-bit pricing modes (paymentType & 0x3F)
const PAYMENT_TYPE_MODE_DEFAULT_PRICES = 0x00; // Use VMC default prices; paymentData ignored
const PAYMENT_TYPE_MODE_USERGROUP_PRICELIST = 0x01; // paymentDataHi=userGroup, paymentDataLo=priceListNumber
const PAYMENT_TYPE_MODE_USERGROUP_DISCOUNTGROUP = 0x02; // paymentDataHi=userGroup, paymentDataLo=discountGroupIndex
const PAYMENT_TYPE_MODE_DISCOUNT_PERCENT = 0x03; // paymentDataLo=0..100 (% discount); paymentDataHi usually 0x00
const PAYMENT_TYPE_MODE_SURCHARGE_PERCENT = 0x04; // paymentDataLo=0..100 (% surcharge); paymentDataHi usually 0x00

function decodePaymentType(paymentType, paymentDataHi = 0x00, paymentDataLo = 0x00) {
  const paymentData16 = ((paymentDataHi << 8) | paymentDataLo) & 0xFFFF;

  const isFreeVend = (paymentType & PAYMENT_TYPE_FLAG_FREE_VEND) !== 0;
  const isTestMedia = !isFreeVend && (paymentType & PAYMENT_TYPE_FLAG_TEST_MEDIA) !== 0;

  const cardClass = isFreeVend ? "freeVend" : (isTestMedia ? "test" : "normal");

  const mode = paymentType & PAYMENT_TYPE_MODE_MASK;

  const info = {
    raw: paymentType,
    cardClass,
    isFreeVend,
    isTestMedia,
    mode,
    paymentDataHi,
    paymentDataLo,
    paymentData16,
  };

  switch (mode) {
    case PAYMENT_TYPE_MODE_DEFAULT_PRICES:
      info.modeName = "defaultPrices";
      break;
    case PAYMENT_TYPE_MODE_USERGROUP_PRICELIST:
      info.modeName = "userGroup+priceList";
      info.userGroup = paymentDataHi;
      info.priceListNumber = paymentDataLo;
      break;
    case PAYMENT_TYPE_MODE_USERGROUP_DISCOUNTGROUP:
      info.modeName = "userGroup+discountGroup";
      info.userGroup = paymentDataHi;
      info.discountGroupIndex = paymentDataLo;
      break;
    case PAYMENT_TYPE_MODE_DISCOUNT_PERCENT:
      info.modeName = "discountPercent";
      info.percent = paymentDataLo; // 0..100
      break;
    case PAYMENT_TYPE_MODE_SURCHARGE_PERCENT:
      info.modeName = "surchargePercent";
      info.percent = paymentDataLo; // 0..100
      break;
    default:
      info.modeName = "unknown";
      break;
  }

  return info;
}

/**
 * Identify if the first byte looks like a Wafer activity DeviceID.
 */
function isKnownDeviceId(b0) {
  return (
    b0 === DEVICE_ID_COIN_CHANGER ||
    b0 === DEVICE_ID_BILL_VALIDATOR ||
    b0 === DEVICE_ID_CASHLESS_1 ||
    b0 === DEVICE_ID_CASHLESS_2
  );
}

/**
 * ---------------
 * Main class
 * ---------------
 */
export default class MdbRs232Cashless extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.portPath - Serial port path (e.g. /dev/ttyS4, COM3)
   * @param {number} opts.cashlessNumber - 1 => 0x10, 2 => 0x60
   * @param {number} [opts.baudRate=9600] - RS-232 speed (bridge specific)
   * @param {boolean} [opts.debug=false] - Emit debug:tx/debug:rx events
   * @param {number} [opts.pollIntervalMs=250] - Poll interval for background poller
   */
  constructor(opts) {
    super();

    const {
      portPath,
      cashlessNumber,
      baudRate = 9600,
      debug = false,
      pollIntervalMs = 250,
    } = opts || {};

    if (!portPath) throw new ProtocolError("portPath required", { code: "NO_PORT" });
    if (cashlessNumber !== 1 && cashlessNumber !== 2) {
      throw new ProtocolError("cashlessNumber must be 1 or 2", { code: "BAD_CASHLESS_NO", details: { cashlessNumber } });
    }

    this.portPath = portPath;
    this.cashlessNumber = cashlessNumber;
    this.deviceId = cashlessNumber === 1 ? DEVICE_ID_CASHLESS_1 : DEVICE_ID_CASHLESS_2;

    this.baudRate = baudRate;
    this.debug = !!debug;
    this.pollIntervalMs = pollIntervalMs;

    this.port = null;

    // inbound buffer
    this._rxBuf = Buffer.alloc(0);

    // command queue / in-flight
    this._queue = [];
    this._inflight = null;

    // poller
    this._pollTimer = null;

    // state
    this.readerConfig = null; // last received READER CONFIG (from Poll, code=0x01)
    this.vmcConfig = null;

    // last expansion options used
    this.expansionOptions = 0x00;
  }

  /**
   * Build a "command byte" for a given MDB Cashless command, addressing configured cashless device number.
   *
   * For Wafer bridge we send raw MDB command bytes (already routed by bridge to correct MDB address).
   * We still keep helper to avoid magic numbers in higher-level methods.
   */
  _cmd(cmd) {
    return cmd & 0xFF;
  }

  /**
   * ----------------------------
   * Serial open/close
   * ----------------------------
   */
  async open() {
    if (this.port?.isOpen) return;

    this.port = new SerialPort({
      path: this.portPath,
      baudRate: this.baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      autoOpen: false,
    });

    await new Promise((resolve, reject) => {
      this.port.open((err) => (err ? reject(err) : resolve()));
    });

    this.port.on("data", (d) => this._onData(d));
    this.port.on("error", (e) => this.emit("error", e));

    // start poller
    this._startPoller();

    // optional banner
    this.emit("banner", `MDB-RS232 Cashless bridge opened on ${this.portPath} (cashless #${this.cashlessNumber}, devId=0x${this.deviceId.toString(16)})`);
  }

  async close() {
    this._stopPoller();
    if (!this.port) return;
    const p = this.port;
    this.port = null;

    if (p.isOpen) {
      await new Promise((resolve) => p.close(() => resolve()));
    }
  }

  /**
   * ----------------------------
   * RX/TX low-level
   * ----------------------------
   */
  _onData(chunk) {
    if (!chunk || !chunk.length) return;

    this._rxBuf = Buffer.concat([this._rxBuf, Buffer.from(chunk)]);

    // Parse as a stream of:
    // - ACK (single byte 0x00)
    // - Activity blocks starting with DeviceID and containing at least 2 bytes
    //
    // Wafer bridge is not length-prefixed here; in this project we rely on patterns:
    // - ACK is always 0x00
    // - Activity frame starts with known DeviceID and has at least code byte.
    //
    // We process conservatively:
    while (this._rxBuf.length > 0) {
      // ACK only
      if (this._rxBuf[0] === 0x00) {
        const b = this._rxBuf.slice(0, 1);
        this._rxBuf = this._rxBuf.slice(1);
        if (this.debug) this.emit("debug:rx", { hex: toHex(b), buf: b });
        this._handleAck();
        continue;
      }

      // If first byte looks like a DeviceID, we need at least 2 bytes: [DeviceID][code]
      if (!isKnownDeviceId(this._rxBuf[0])) {
        // unknown leading byte: drop it
        const drop = this._rxBuf.slice(0, 1);
        this._rxBuf = this._rxBuf.slice(1);
        if (this.debug) this.emit("debug:rx", { hex: toHex(drop), buf: drop });
        this.emit("warn", { code: "RX_GARBAGE", message: "Dropping unknown leading byte", byte: drop[0] });
        continue;
      }

      if (this._rxBuf.length < 2) return; // wait for code byte

      // We don't know length, but in this bridge/project the activity packet is delivered as one UART chunk most of time.
      // We try to decode whatever is currently buffered as a single activity frame. If later bytes belong to another frame,
      // the decoder should not break: we will treat extra bytes as next frames by re-looping.
      //
      // Heuristic: treat the whole current buffer as one activity frame, then clear it.
      const frame = this._rxBuf;
      this._rxBuf = Buffer.alloc(0);

      if (this.debug) this.emit("debug:rx", { hex: toHex(frame), buf: frame });

      this._handleActivityFrame(frame);
      continue;
    }
  }

  _write(buf) {
    if (!this.port?.isOpen) throw new ProtocolError("Port not open", { code: "PORT_CLOSED" });
    const b = Buffer.from(buf);
    if (this.debug) this.emit("debug:tx", { hex: toHex(b), buf: b });
    return new Promise((resolve, reject) => {
      this.port.write(b, (err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * ----------------------------
   * Command queueing
   * ----------------------------
   */
  async _enqueue(fn) {
    return await new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._drainQueue();
    });
  }

  async _drainQueue() {
    if (this._inflight) return;
    const job = this._queue.shift();
    if (!job) return;

    this._inflight = job;

    try {
      const res = await job.fn();
      this._inflight = null;
      job.resolve(res);
      this._drainQueue();
    } catch (e) {
      this._inflight = null;
      job.reject(e);
      this._drainQueue();
    }
  }

  _handleAck() {
    // ACK resolves the currently waiting command if it expects ACK
    const inflight = this._inflight?.waiter;
    if (inflight && inflight.expect === "ACK") {
      inflight.resolve({ type: "ack" });
      this._inflight.waiter = null;
    } else {
      // some commands are ACK_OR_SILENCE etc; still mark as seen
      if (inflight && inflight.expect === "ACK_OR_SILENCE") {
        inflight.resolve({ type: "ack" });
        this._inflight.waiter = null;
      }
    }
  }

  _handleActivityFrame(frame) {
    // [DeviceId][code][payload...]
    if (frame.length < 2) return;
    const devId = frame[0];
    const code = frame[1];
    const payload = frame.slice(1); // include code in payload to reuse decoders expecting [code]...
    // Only handle frames for our cashless device (some bridges may emit multiple device frames)
    if (devId !== this.deviceId) {
      this.emit("activity:other", { deviceId: devId, code, raw: frame });
      return;
    }

    const ev = this._decodeCashlessActivity(payload);
    if (!ev) return;

    this.emit(ev.type, ev);
    this.emit("activity:cashless", ev);
  }

  /**
   * ----------------------------
   * Waiters / send helpers
   * ----------------------------
   */
  _sendAndWait(cmdBuf, { expect = "ACK", timeoutMs = 1000 } = {}) {
    return new Promise(async (resolve, reject) => {
      if (!this._inflight) {
        reject(new ProtocolError("No inflight job for sendAndWait", { code: "INTERNAL" }));
        return;
      }

      const waiter = {
        expect,
        resolve: (v) => resolve(v),
        reject: (e) => reject(e),
        cancel: () => reject(new ProtocolError("Timeout waiting for reply", { code: "TIMEOUT", details: { expect } })),
      };

      this._inflight.waiter = waiter;

      // transmit
      await this._write(cmdBuf);

      // timer
      const t = setTimeout(() => {
        if (this._inflight?.waiter === waiter) {
          this._inflight.waiter = null;
          waiter.cancel();
        }
      }, timeoutMs);

      // wrap resolve/reject to clear timer
      const origResolve = waiter.resolve;
      const origReject = waiter.reject;
      waiter.resolve = (v) => {
        clearTimeout(t);
        origResolve(v);
      };
      waiter.reject = (e) => {
        clearTimeout(t);
        origReject(e);
      };
    });
  }

  /**
   * ----------------------------
   * Poller
   * ----------------------------
   */
  _startPoller() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => {
      // best-effort, do not queue if port closed
      if (!this.port?.isOpen) return;
      // send poll unqueued to avoid starving; it will still receive ACK/activities
      this._write(Buffer.from([this._cmd(MDB_CASHLESS_CMD_POLL)])).catch(() => {});
    }, this.pollIntervalMs);
  }

  _stopPoller() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * ----------------------------
   * Activity decoding
   * ----------------------------
   */
  _decodeCashlessActivity(payload) {
    if (!payload || payload.length < 1) return null;

    const code = payload[0];

    switch (code) {
      case 0x01:
        return this._decodeReaderConfig(payload);
      case 0x03:
        return this._decodeBeginSession(payload);
      case 0x04:
        return { type: "sessionCancelRequest", code, raw: Buffer.from(payload) };
      case 0x05:
        return this._decodeVendApproved(payload);
      case 0x06:
        return { type: "vendDenied", code, raw: Buffer.from(payload) };
      case 0x07:
        return { type: "endSession", code, raw: Buffer.from(payload) };
      case 0x00:
        return { type: "cancelled", code, raw: Buffer.from(payload) };
      case 0x09:
        return this._decodePeripheralId(payload);
      default:
        return { type: "unknownActivity", code, raw: Buffer.from(payload) };
    }
  }

  _decodeReaderConfig(payload) {
    // payload: [01][FeatureLevel][CountryHi][CountryLo][ScaleFactor][DecimalPlaces][MaxTime][MiscOptions]
    const raw = Buffer.from(payload);
    if (payload.length < 8) return { type: "readerConfig", code: payload[0], raw, incomplete: true };

    const code = payload[0];
    const readerFeatureLevel = payload[1];
    const countryCode = u16be(payload[2], payload[3]);
    const scalingFactor = payload[4];
    const decimalPlaces = payload[5];
    const maxResponseTimeSec = payload[6];
    const miscOptions = payload[7];

    const misc = {
      canRefund: (miscOptions & 0x01) !== 0,
      multivendCapable: (miscOptions & 0x02) !== 0,
      hasOwnDisplay: (miscOptions & 0x04) !== 0,
      supportsCashSale: (miscOptions & 0x08) !== 0,
    };

    const config = {
      readerFeatureLevel,
      countryCode,
      scalingFactor,
      decimalPlaces,
      maxResponseTimeSec,
      miscOptions,
      misc,
    };

    // store for scaling helpers
    this.readerConfig = config;

    return { type: "readerConfig", code, config, raw };
  }

  _decodeBeginSession(payload) {
    // payload: [03][...]
    // Variants (MDB 4.2, cashless Begin Session):
    //  - Level 1 minimal:              03 funds16
    //  - Some bridges short form:      03 funds16 paymentType paymentData8
    //  - Level 2 common:               03 funds16 mediaId32 paymentType paymentData16   (10 bytes total)
    //  - Expanded (Level 3 options):   03 funds32 currency16 language16 paymentType paymentData(8/16) ...
    const code = payload[0];
    const raw = Buffer.from(payload);

    if (payload.length === 3) {
      const fundsScaled = u16be(payload[1], payload[2]);
      return { type: "beginSession", code, mode: "funds16", fundsScaled, raw };
    }

    // Short/legacy: funds16 + paymentType + 1-byte paymentData (bridge-specific)
    if (payload.length === 5) {
      const fundsScaled = u16be(payload[1], payload[2]);
      const paymentType = payload[3];
      const paymentDataHi = 0x00;
      const paymentDataLo = payload[4];
      const paymentData16 = ((paymentDataHi << 8) | paymentDataLo) & 0xFFFF;
      const paymentTypeInfo = decodePaymentType(paymentType, paymentDataHi, paymentDataLo);
      return {
        type: "beginSession",
        code,
        mode: "funds16+type+data8",
        fundsScaled,
        paymentType,
        paymentTypeInfo,
        paymentDataHi,
        paymentDataLo,
        paymentData16,
        raw,
      };
    }

    // Level 2 common: funds16 + mediaId32 + paymentType + paymentData16
    if (payload.length === 10) {
      const fundsScaled = u16be(payload[1], payload[2]);
      const paymentMediaId = decodeU32BE(payload[3], payload[4], payload[5], payload[6]) >>> 0;
      const paymentType = payload[7];
      const paymentDataHi = payload[8];
      const paymentDataLo = payload[9];
      const paymentData16 = ((paymentDataHi << 8) | paymentDataLo) & 0xFFFF;
      const paymentTypeInfo = decodePaymentType(paymentType, paymentDataHi, paymentDataLo);
      return {
        type: "beginSession",
        code,
        mode: "funds16+mediaId32+type+data16",
        fundsScaled,
        paymentMediaId,
        paymentType,
        paymentTypeInfo,
        paymentDataHi,
        paymentDataLo,
        paymentData16,
        raw,
      };
    }

    // Expanded: funds32 + currency16 + language16 + paymentType + paymentData (8/16)
    if (payload.length >= 11) {
      const fundsScaled32 = decodeU32BE(payload[1], payload[2], payload[3], payload[4]) >>> 0;
      const currencyCode = u16be(payload[5], payload[6]);
      const languageCode = u16be(payload[7], payload[8]);
      const paymentType = payload[9];

      // Some bridges provide only 1 byte of paymentData; MDB Level 2/3 normally uses 2 bytes (Z9..Z10).
      let paymentDataHi = 0x00;
      let paymentDataLo = payload[10];
      if (payload.length >= 12) {
        paymentDataHi = payload[10];
        paymentDataLo = payload[11];
      }
      const paymentData16 = ((paymentDataHi << 8) | paymentDataLo) & 0xFFFF;
      const paymentTypeInfo = decodePaymentType(paymentType, paymentDataHi, paymentDataLo);

      return {
        type: "beginSession",
        code,
        mode: "funds32+currency+lang+type+data",
        fundsScaled: fundsScaled32,
        currencyCode,
        languageCode,
        paymentType,
        paymentTypeInfo,
        paymentDataHi,
        paymentDataLo,
        paymentData16,
        raw,
      };
    }

    // Unknown length; still emit something useful.
    return { type: "beginSession", code, mode: "unknown", raw };
  }

  _decodeVendApproved(payload) {
    // payload: [05][amountHi][amountLo]  OR [05][amount32][token?]
    const code = payload[0];
    const raw = Buffer.from(payload);

    if (payload.length === 3) {
      const amountScaled = u16be(payload[1], payload[2]);
      return { type: "vendApproved", code, mode: "amount16", amountScaled, raw };
    }

    if (payload.length >= 5) {
      const amountScaled = decodeU32BE(payload[1], payload[2], payload[3], payload[4]) >>> 0;
      const isToken = payload.length >= 6 ? (payload[5] !== 0x00) : false;
      return { type: "vendApproved", code, mode: "amount32", amountScaled, isToken, raw };
    }

    return { type: "vendApproved", code, mode: "unknown", raw };
  }

  _decodePeripheralId(payload) {
    // payload may be:
    //  A) [09][mfg3][serial12][model12][ver2][opt4?]  (total 30 or 34)
    //  B) [mfg3][serial12][model12][ver2][opt4?]      (total 29 or 33)
    //
    // We accept both and mark incomplete if not enough bytes.

    const raw = Buffer.from(payload);
    const has09 = raw.length >= 1 && raw[0] === 0x09;
    const off = has09 ? 1 : 0;

    if (raw.length < off + 3 + 12 + 12 + 2) {
      return { type: "peripheralId", code: 0x09, raw, incomplete: true };
    }

    const manufacturer = raw.slice(off + 0, off + 3).toString("ascii");
    const serial = raw.slice(off + 3, off + 15).toString("ascii").trim();
    const model = raw.slice(off + 15, off + 27).toString("ascii").trim();
    const version = raw.slice(off + 27, off + 29).toString("ascii");

    let options = null;
    if (raw.length >= off + 33) {
      options = raw.slice(off + 29, off + 33);
    }

    return {
      type: "peripheralId",
      code: 0x09,
      manufacturer,
      serial,
      model,
      version,
      options,
      raw,
    };
  }

  /**
   * ----------------------------
   * High-level commands
   * ----------------------------
   */

  /**
   * Reset bridge/MDB cashless device state (best effort).
   */
  async reset() {
    return await this._enqueue(async () => {
      // In Wafer bridge, POLL (0x10) serves as a "nudge", but reset here is implemented as a single poll + wait for ACK.
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_POLL)]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
    });
  }

  /**
   * Setup VMC configuration for cashless reader.
   *
   * @param {object} p
   * @param {number} p.vmcFeatureLevel - VMC cashless feature level (usually 3)
   * @param {number} p.columns - vending columns (optional, may be 0)
   * @param {number} p.rows - vending rows (optional, may be 0)
   * @param {"unused"|"fullAscii"} p.displayType - display configuration hint
   * @param {number} [p.timeoutMs=800]
   */
  async setupConfig(p) {
    return await this._enqueue(async () => {
      const {
        vmcFeatureLevel = 3,
        columns = 0,
        rows = 0,
        displayType = "unused",
        timeoutMs = 800,
      } = p || {};

      // For this bridge, Setup/Config is encoded as:
      // [11][00][vmcFeatureLevel][columns][rows][displayType]
      // displayType mapping:
      //  - "unused" => 0x00
      //  - "fullAscii" => 0x02 (practical for Nayax)
      const displayTypeCode = (displayType === "fullAscii") ? 0x02 : 0x00;

      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_SETUP),
        MDB_SETUP_SUBCMD_CONFIG,
        vmcFeatureLevel & 0xFF,
        columns & 0xFF,
        rows & 0xFF,
        displayTypeCode,
      ]);

      // ACK is expected; readerConfig will arrive asynchronously on Poll as activity 0x01.
      await this._sendAndWait(cmd, { expect: "ACK", timeoutMs });

      // Wait for readerConfig activity to populate scaling factors etc.
      // NOTE: Some bridges/readers may send config only on next Poll; so allow a longer wait.
      const ev = await this._waitForActivity("readerConfig", 1500);
      this.vmcConfig = { vmcFeatureLevel, columns, rows, displayType, displayTypeCode };
      return ev.config;
    });
  }

  async _waitForActivity(eventName, timeoutMs) {
    return await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        cleanup();
        reject(new ProtocolError("Timeout waiting for activity", { code: "TIMEOUT", details: { eventName } }));
      }, timeoutMs);

      const onEv = (ev) => {
        cleanup();
        resolve(ev);
      };

      const cleanup = () => {
        clearTimeout(t);
        this.removeListener(eventName, onEv);
      };

      this.on(eventName, onEv);
    });
  }

  /**
   * Setup max/min prices for cashless device.
   *
   * @param {object} p
   * @param {number} p.maxPriceScaled - max price in scaled integer units (u16, 0..65535)
   * @param {number} p.minPriceScaled - min price in scaled integer units (u16, 0..65535)
   * @param {number} [p.timeoutMs=600]
   */
  async setupMaxMinPrices(p) {
    return await this._enqueue(async () => {
      const {
        maxPriceScaled = 0xFFFF,
        minPriceScaled = 0x0000,
        timeoutMs = 600,
      } = p;

      const [maxHi, maxLo] = encodeU16BE(maxPriceScaled);
      const [minHi, minLo] = encodeU16BE(minPriceScaled);

      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_SETUP),
        MDB_SETUP_SUBCMD_MAX_MIN_PRICES,
        maxHi, maxLo,
        minHi, minLo,
      ]);

      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs });
    });
  }

  /**
   * Enable reader (VMC allows card interaction).
   */
  async readerEnable() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_READER), MDB_READER_SUBCMD_ENABLE]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 600 });
    });
  }

  /**
   * Disable reader.
   */
  async readerDisable() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_READER), MDB_READER_SUBCMD_DISABLE]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 600 });
    });
  }

  /**
   * Send Vend Request (Product First / Always Idle: send after product selection to make reader wait for card).
   *
   * @param {object} p
   * @param {number} p.priceScaled - price in scaled units
   * @param {number} p.itemNumber - item/selection number (u16)
   * @param {boolean} [p.use32bit=false] - encode price as u32 (requires feature/option support)
   */
  async vendRequest(p) {
    return await this._enqueue(async () => {
      const { priceScaled, itemNumber, use32bit = false } = p || {};
      if (!Number.isInteger(priceScaled) || priceScaled < 0) {
        throw new ProtocolError("priceScaled must be integer >= 0", { code: "BAD_PRICE", details: { priceScaled } });
      }
      if (!Number.isInteger(itemNumber) || itemNumber < 0 || itemNumber > 0xFFFF) {
        throw new ProtocolError("itemNumber must be u16", { code: "BAD_ITEM", details: { itemNumber } });
      }

      const [iHi, iLo] = encodeU16BE(itemNumber);

      let cmd;
      if (use32bit) {
        const [p0, p1, p2, p3] = encodeU32BE(priceScaled);
        // Bridge-specific 32-bit vend request encoding:
        // [13][00][price32][item16]
        cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_REQUEST, p0, p1, p2, p3, iHi, iLo]);
      } else {
        const [pHi, pLo] = encodeU16BE(priceScaled);
        // Standard 16-bit encoding:
        // [13][00][price16][item16]
        cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_REQUEST, pHi, pLo, iHi, iLo]);
      }

      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  async vendCancel() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_CANCEL]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  async vendSuccess(itemNumber) {
    return await this._enqueue(async () => {
      const [iHi, iLo] = encodeU16BE(itemNumber);
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_SUCCESS, iHi, iLo]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  async vendFailure() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_FAILURE]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  async sessionComplete() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_VEND), MDB_VEND_SUBCMD_SESSION_COMPLETE]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  /**
   * Revalue request (Level 2/3).
   */
  async revalueRequest(amountScaled) {
    return await this._enqueue(async () => {
      const [aHi, aLo] = encodeU16BE(amountScaled);
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_REVALUE),
        MDB_REVALUE_SUBCMD_REQUEST,
        aHi, aLo,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });
    });
  }

  /**
   * Expansion Request ID (Multi-peripheral ID).
   */
  async expansionRequestId() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_EXPANSION), MDB_EXP_SUBCMD_REQUEST_ID]);
      await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 800 });

      // The response comes as activity peripheralId (0x09) over Poll.
      const ev = await this._waitForActivity("peripheralId", 1200);
      return {
        manufacturer: ev.manufacturer,
        model: ev.model,
        serial: ev.serial,
        version: ev.version,
        options: ev.options,
      };
    });
  }

  /**
   * Expansion Enable Options (enable features like Always Idle).
   *
   * @param {number} optionsMask - bitmask of features (use CashlessConstants.OPT_*).
   */
  async expansionEnableOptions(optionsMask) {
    return await this._enqueue(async () => {
      if (!Number.isInteger(optionsMask) || optionsMask < 0 || optionsMask > 0xFF) {
        throw new ProtocolError("optionsMask must be u8", { code: "BAD_OPT", details: { optionsMask } });
      }

      // For this bridge, Nayax requires:
      // 17 04 00 00 00 20  (example enabling Always Idle)
      // i.e. [17][04][opt32]
      const opt32 = optionsMask >>> 0;
      const [o0, o1, o2, o3] = encodeU32BE(opt32);

      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_EXPANSION), MDB_EXP_SUBCMD_ENABLE, o0, o1, o2, o3]);
      await this._sendAndWait(cmd, { expect: "ACK", timeoutMs: 900 });
      this.expansionOptions = optionsMask & 0xFF;
      return { optionsMask: this.expansionOptions };
    });
  }

  /**
   * ----------------------------
   * Money scaling helpers
   * ----------------------------
   */

  /**
   * Convert scaled integer to real value (float) using last known readerConfig.
   */
  scaledToReal(scaled) {
    if (!this.readerConfig) {
      throw new ProtocolError("readerConfig unknown; call setupConfig first", { code: "NO_CFG" });
    }
    const { scalingFactor, decimalPlaces } = this.readerConfig;

    // MDB 4.2:
    // ActualPrice = P * ScaleFactor * 10^(-DecimalPlaces)
    // => actual = scaled * scalingFactor / 10^decimalPlaces
    const div = Math.pow(10, decimalPlaces);
    return (scaled * scalingFactor) / div;
  }

  /**
   * Convert real value (float) to scaled integer using last known readerConfig.
   *
   * @param {number} real
   * @param {object} [opts]
   * @param {"nearest"|"floor"|"ceil"} [opts.rounding="nearest"] - rounding strategy
   * @param {boolean} [opts.strict=false] - if true, throw when value is not exactly representable for current scaling
   */
  realToScaled(real, opts = undefined) {
    if (!this.readerConfig) {
      throw new ProtocolError("readerConfig unknown; call setupConfig first", { code: "NO_CFG" });
    }
    const { scalingFactor, decimalPlaces } = this.readerConfig;

    // MDB 4.2:
    // scaled P = actual / (ScaleFactor * 10^(-DecimalPlaces))
    // => P = actual * 10^decimalPlaces / scalingFactor
    const mul = Math.pow(10, decimalPlaces);
    const exact = (real * mul) / scalingFactor;

    const { rounding = "nearest", strict = false } = opts || {};

    let scaled;
    if (rounding === "floor") scaled = Math.floor(exact);
    else if (rounding === "ceil") scaled = Math.ceil(exact);
    else scaled = Math.round(exact); // "nearest" default

    // If strict, require the real value to be exactly representable with current scaling.
    // This prevents silent rounding when price step is coarse (e.g. scalingFactor=100, decimalPlaces=2 => step=1.00).
    if (strict) {
      const eps = 1e-9;
      if (Math.abs(exact - scaled) > eps) {
        const stepReal = scalingFactor / mul; // minimal representable increment in real currency units
        throw new ProtocolError("Price is not representable for current scaling; would be rounded", {
          code: "PRICE_NOT_REPRESENTABLE",
          details: { real, exactScaled: exact, roundedScaled: scaled, stepReal, scalingFactor, decimalPlaces },
        });
      }
    }

    return scaled;
  }
}

/**
 * Export useful constants for integrators (no magic numbers).
 */
export const CashlessConstants = {
  // Device IDs
  DEVICE_ID_COIN_CHANGER,
  DEVICE_ID_BILL_VALIDATOR,
  DEVICE_ID_CASHLESS_1,
  DEVICE_ID_CASHLESS_2,

  // Commands
  MDB_CASHLESS_CMD_POLL,
  MDB_CASHLESS_CMD_SETUP,
  MDB_CASHLESS_CMD_VEND,
  MDB_CASHLESS_CMD_READER,
  MDB_CASHLESS_CMD_REVALUE,
  MDB_CASHLESS_CMD_EXPANSION,

  // Subcommands
  MDB_SETUP_SUBCMD_CONFIG,
  MDB_SETUP_SUBCMD_MAX_MIN_PRICES,

  MDB_READER_SUBCMD_DISABLE,
  MDB_READER_SUBCMD_ENABLE,

  MDB_VEND_SUBCMD_REQUEST,
  MDB_VEND_SUBCMD_CANCEL,
  MDB_VEND_SUBCMD_SUCCESS,
  MDB_VEND_SUBCMD_FAILURE,
  MDB_VEND_SUBCMD_SESSION_COMPLETE,

  MDB_REVALUE_SUBCMD_REQUEST,
  MDB_REVALUE_SUBCMD_LIMIT,

  MDB_EXP_SUBCMD_REQUEST_ID,
  MDB_EXP_SUBCMD_ENABLE,

  // Expansion options
  OPT_FEATURE_ALWAYS_IDLE,
  OPT_FEATURE_32BIT_MONEY,

  // BEGIN SESSION paymentType decode constants (useful for debugging)
  PAYMENT_TYPE_FLAG_FREE_VEND,
  PAYMENT_TYPE_FLAG_TEST_MEDIA,
  PAYMENT_TYPE_MODE_MASK,

  PAYMENT_TYPE_MODE_DEFAULT_PRICES,
  PAYMENT_TYPE_MODE_USERGROUP_PRICELIST,
  PAYMENT_TYPE_MODE_USERGROUP_DISCOUNTGROUP,
  PAYMENT_TYPE_MODE_DISCOUNT_PERCENT,
  PAYMENT_TYPE_MODE_SURCHARGE_PERCENT,
};