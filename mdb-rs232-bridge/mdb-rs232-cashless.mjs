// mdb-rs232-cashless.mjs
// ESM module for Node.js
//
// Implements VMC <-> Wafer MDB-RS232 bridge communication for MDB Cashless Reader (cashless only).
// Key bridge rules (Wafer):
//  - TX: raw binary bytes, no CR/LF.
//  - RX: ASCII-HEX text lines terminated by CRLF.
//  - Reply data: NO DeviceID prefix (often 00 ACK / FF NAK). Multi-byte reply ends with CHK.
//  - Activity data: ALWAYS starts with DeviceID (08/30/10/60) and usually has NO CHK.
//  - Multi-message: after each received block VMC must send single byte 00 to get the next block.

import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

/**
 * ----------------------------
 * RS232 framing / ASCII parsing
 * ----------------------------
 */

/** CR (carriage return) byte in RX framing. */
const RX_CR = 0x0D;
/** LF (line feed) byte in RX framing. */
const RX_LF = 0x0A;

/**
 * Bridge-level ACK that VMC sends to request the next multi-message block.
 * NOTE: This is a single raw byte 0x00 on TX, NOT ASCII "00".
 */
const BRIDGE_BLOCK_ACK = 0x00;

/**
 * How many "kick" 0x00 bytes we send after EXPANSION/00 to trigger the FIRST block.
 * Some Wafer firmwares won't start sending Peripheral ID until they see 0x00.
 * We LIMIT these kicks to avoid spamming TX/debug logs when device never responds.
 */
const MULTI_FIRST_BLOCK_KICK_MAX = 10;

/** Delay before first kick (ms) to let bridge forward 17 00 first. */
const MULTI_FIRST_BLOCK_KICK_START_DELAY_MS = 120;

/** Interval between kicks while waiting for the first bytes (ms). */
const MULTI_FIRST_BLOCK_KICK_INTERVAL_MS = 200;

/** Bridge reply ACK byte (reply data). */
const BRIDGE_REPLY_ACK = 0x00;
/** Bridge reply NAK byte (reply data). */
const BRIDGE_REPLY_NAK = 0xFF;

/**
 * ----------------------------
 * Wafer DeviceIDs (activity prefix)
 * ----------------------------
 * These bytes appear as the FIRST byte of activity data pushed by the bridge.
 */
const DEVICE_ID_COIN_CHANGER = 0x08;
const DEVICE_ID_BILL_VALIDATOR = 0x30;
const DEVICE_ID_CASHLESS_1 = 0x10;
const DEVICE_ID_CASHLESS_2 = 0x60;

/**
 * For Cashless #2, all command codes are Cashless#1 code + 0x50 (MDB addressing scheme for Wafer docs).
 */
const CASHLESS_2_CMD_OFFSET = 0x50;

/**
 * ----------------------------
 * MDB Cashless command codes (Cashless #1 base)
 * ----------------------------
 * Real command byte = BASE + offset (offset 0x00 for cashless#1, 0x50 for cashless#2).
 */
const MDB_CASHLESS_CMD_RESET = 0x10;
const MDB_CASHLESS_CMD_SETUP = 0x11;
const MDB_CASHLESS_CMD_VEND = 0x13;
const MDB_CASHLESS_CMD_READER_CONTROL = 0x14;
const MDB_CASHLESS_CMD_REVALUE = 0x15;
const MDB_CASHLESS_CMD_EXPANSION = 0x17;

/**
 * SETUP subcommands.
 */
const MDB_SETUP_SUBCMD_CONFIG_DATA = 0x00;
const MDB_SETUP_SUBCMD_MAX_MIN_PRICES = 0x01;

/**
 * READER CONTROL subcommands.
 */
const MDB_READER_CTRL_DISABLE = 0x00;
const MDB_READER_CTRL_ENABLE = 0x01;
/**
 * Some readers support CANCEL via 14 02 (seen in Wafer manual),
 * but cashless-doc focuses on 14 00/01 for disable/enable.
 */
const MDB_READER_CTRL_CANCEL = 0x02;

/**
 * VEND subcommands.
 */
const MDB_VEND_SUBCMD_REQUEST = 0x00;
const MDB_VEND_SUBCMD_CANCEL = 0x01;
const MDB_VEND_SUBCMD_SUCCESS = 0x02;
const MDB_VEND_SUBCMD_FAILURE = 0x03;
const MDB_VEND_SUBCMD_SESSION_COMPLETE = 0x04;
/** CASH SALE (not required for basic snack flow, but kept for completeness). */
const MDB_VEND_SUBCMD_CASH_SALE = 0x05;

/**
 * REVALUE subcommands.
 */
const MDB_REVALUE_SUBCMD_REQUEST = 0x00;
const MDB_REVALUE_SUBCMD_LIMIT_REQUEST = 0x01;

/**
 * EXPANSION subcommands.
 */
const MDB_EXPANSION_SUBCMD_REQUEST_ID = 0x00;
const MDB_EXPANSION_SUBCMD_OPTIONAL_FEATURE_ENABLE = 0x04;

/**
 * Optional Feature Bits (32-bit) for EXPANSION/04 (MDB 4.2).
 */
const OPT_FEATURE_FILE_TRANSPORT_LAYER = 0x00000001;
const OPT_FEATURE_32BIT_MONEY = 0x00000002;
const OPT_FEATURE_MULTI_CURRENCY_LANG = 0x00000004;
const OPT_FEATURE_NEGATIVE_VEND = 0x00000008;
const OPT_FEATURE_DATA_ENTRY = 0x00000010;
const OPT_FEATURE_ALWAYS_IDLE = 0x00000020;

/**
 * ----------------------------
 * MDB Poll/Activity response codes (cashless, after DeviceID)
 * ----------------------------
 */
const POLL_JUST_RESET = 0x00;
const POLL_READER_CONFIG_DATA = 0x01;
const POLL_DISPLAY_REQUEST = 0x02;
const POLL_BEGIN_SESSION = 0x03;
const POLL_SESSION_CANCEL_REQUEST = 0x04;
const POLL_VEND_APPROVED = 0x05;
const POLL_VEND_DENIED = 0x06;
const POLL_END_SESSION = 0x07;
const POLL_CANCELLED = 0x08;
const POLL_PERIPHERAL_ID = 0x09;
const POLL_MALFUNCTION = 0x0A;
const POLL_CMD_OUT_OF_SEQUENCE = 0x0B;
const POLL_REVALUE_APPROVED = 0x0D;
const POLL_REVALUE_DENIED = 0x0E;
const POLL_REVALUE_LIMIT_AMOUNT = 0x0F;

/**
 * Peripheral ID payload length (without DeviceID prefix):
 *  1 (0x09) + 3 (mfg) + 12 (serial) + 12 (model) + 2 (ver) + 4 (optional bits) = 34 bytes.
 */
const PERIPHERAL_ID_TOTAL_LEN = 34;

/**
 * ----------------------------
 * Errors
 * ----------------------------
 */
class ProtocolError extends Error {
  constructor(message, { code, details } = {}) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.details = details;
  }
}

/**
 * ----------------------------
 * Small helpers (no magic numbers)
 * ----------------------------
 */
function toHex2(b) {
  return b.toString(16).toUpperCase().padStart(2, "0");
}

function bufToHexSpaced(buf) {
  return [...buf].map(toHex2).join(" ");
}

/**
 * Parse ASCII-HEX line into bytes.
 * Accepts extra spaces. Throws if tokens are not 2-hex chars.
 */
function parseAsciiHexLineToBytes(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const out = [];
  for (const t of tokens) {
    if (!/^[0-9a-fA-F]{2}$/.test(t)) {
      throw new ProtocolError("Non-hex token in RX line", {
        code: "RX_NOT_HEX",
        details: { token: t, line },
      });
    }
    out.push(parseInt(t, 16));
  }
  return Buffer.from(out);
}

/**
 * MDB checksum (CHK) = 8-bit sum of bytes without CHK.
 */
function mdbChk8(bytesWithoutChk) {
  let s = 0;
  for (const b of bytesWithoutChk) s = (s + b) & 0xFF;
  return s;
}

function u16be(hi, lo) {
  return ((hi << 8) | lo) >>> 0;
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
 * ----------------------------
 * Main class
 * ----------------------------
 */
export class MdbRs232Cashless extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} [options.portPath]                 Serial port path (e.g. "COM3", "/dev/ttyS1").
   * @param {number} [options.cashlessNumber=1]         1 or 2 (maps to DeviceID 0x10 or 0x60).
   * @param {object} [options.serial]                   Serial options override (baudRate, etc).
   * @param {object} [options.transport]                Optional pre-created transport (Duplex-like).
   * @param {number} [options.commandTimeoutMs=1200]    Default timeout for reply data.
   * @param {number} [options.multiBlockTimeoutMs=4000] Timeout for multi-message collection.
   * @param {boolean} [options.debug=false]             Emit verbose debug events.
   */
  constructor(options = {}) {
    super();

    const {
      portPath,
      cashlessNumber = 1,
      serial = {},
      transport,
      commandTimeoutMs = 1200,
      multiBlockTimeoutMs = 4000,
      debug = false,
    } = options;

    if (cashlessNumber !== 1 && cashlessNumber !== 2) {
      throw new ProtocolError("cashlessNumber must be 1 or 2", {
        code: "BAD_CASHLESS_NUMBER",
        details: { cashlessNumber },
      });
    }

    this.portPath = portPath ?? null;
    this.cashlessNumber = cashlessNumber;
    this.debug = !!debug;

    this.commandTimeoutMs = commandTimeoutMs;
    this.multiBlockTimeoutMs = multiBlockTimeoutMs;

    this._transport = transport ?? null;

    // Serial defaults per spec: 9600/8N1, no flow control.
    this._serialOptions = {
      baudRate: 9600,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      autoOpen: false,
      ...serial,
    };

    this.cashlessCmdOffset = cashlessNumber === 2 ? CASHLESS_2_CMD_OFFSET : 0x00;
    this.cashlessDeviceId = (DEVICE_ID_CASHLESS_1 + this.cashlessCmdOffset) & 0xFF;

    // RX line accumulation (raw bytes from serial stream).
    this._rxAcc = Buffer.alloc(0);

    // Single in-flight command guard (bridge replies are not correlatable).
    this._cmdChain = Promise.resolve();
    this._pending = null;

    // Cached reader config from SETUP/00.
    this.readerConfig = null;

    // Session state (best-effort; device can also push out-of-order errors).
    this.session = {
      active: false,
      fundsScaled: null,
      lastVendPriceScaled: null,
      lastVendItem: null,
    };
  }

  /**
   * Open serial port (or attach to provided transport).
   */
  async open() {
    if (this._transport) {
      this._attachTransport(this._transport);
      return;
    }
    if (!this.portPath) {
      throw new ProtocolError("portPath is required when transport is not provided", {
        code: "NO_PORT_PATH",
      });
    }

    let SerialPortCtor;
    try {
      // Dynamic import to keep module usable without serialport dependency in unit tests.
      const mod = await import("serialport");
      SerialPortCtor = mod.SerialPort;
    } catch (e) {
      throw new ProtocolError(
        "Package 'serialport' is required (npm i serialport) or provide options.transport",
        { code: "NO_SERIALPORT", details: { cause: String(e) } }
      );
    }

    const port = new SerialPortCtor({ path: this.portPath, ...this._serialOptions });
    await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
    this._transport = port;
    this._attachTransport(port);
  }

  /**
   * Close transport.
   */
  async close() {
    if (!this._transport) return;

    const t = this._transport;
    t.off?.("data", this._onDataBound);
    t.off?.("error", this._onErrorBound);

    // If it's a SerialPort (has close(cb)), close it.
    if (typeof t.close === "function") {
      await new Promise((resolve) => t.close(() => resolve()));
    }
    this._transport = null;
  }

  /**
   * Attach RX handlers to a transport.
   */
  _attachTransport(t) {
    this._onDataBound = (chunk) => this._onData(chunk);
    this._onErrorBound = (err) => this.emit("error", err);

    t.on("data", this._onDataBound);
    t.on("error", this._onErrorBound);
  }

  /**
   * Low-level write (binary TX, no CR/LF).
   */
  async _writeBytes(buf) {
    if (!this._transport) {
      throw new ProtocolError("Transport not opened", { code: "NOT_OPEN" });
    }
    if (this.debug) {
      this.emit("debug:tx", { hex: bufToHexSpaced(buf), bytes: Buffer.from(buf) });
    }

    await new Promise((resolve, reject) => {
      this._transport.write(buf, (err) => (err ? reject(err) : resolve()));
    });

    // Drain if supported (SerialPort has drain()).
    if (typeof this._transport.drain === "function") {
      await new Promise((resolve, reject) => {
        this._transport.drain((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  /**
   * Serial RX: accumulate until CRLF, then parse line.
   */
  _onData(chunk) {
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
    this._rxAcc = Buffer.concat([this._rxAcc, chunk]);

    while (true) {
      const crIndex = this._rxAcc.indexOf(RX_CR);
      if (crIndex < 0) break;
      if (crIndex + 1 >= this._rxAcc.length) break;
      if (this._rxAcc[crIndex + 1] !== RX_LF) {
        // Not a CRLF; drop up to CR to resync.
        this._rxAcc = this._rxAcc.slice(crIndex + 1);
        continue;
      }

      const lineBuf = this._rxAcc.slice(0, crIndex);
      this._rxAcc = this._rxAcc.slice(crIndex + 2);

      const line = lineBuf.toString("ascii");
      this._handleRxLine(line);
    }
  }

  /**
   * Handle one RX line (ASCII text).
   */
  _handleRxLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Try parse ASCII-HEX. If fails, treat as banner/plain text.
    let bytes = null;
    try {
      bytes = parseAsciiHexLineToBytes(trimmed);
    } catch (e) {
      this.emit("banner", trimmed);
      if (this.debug) this.emit("debug:rx:banner", { text: trimmed });
      return;
    }

    if (!bytes) return;

    if (this.debug) {
      this.emit("debug:rx", { hex: bufToHexSpaced(bytes), bytes: Buffer.from(bytes) });
    }
    this.emit("raw", bytes);

    this._dispatchRx(bytes);
  }

  /**
   * Dispatch parsed RX bytes into:
   *  - pending command reply collector, OR
   *  - activity event (DeviceID-prefixed), OR
   *  - unclassified reply bytes
   */
  _dispatchRx(bytes) {
    // 1) If activity (DeviceID-prefixed) -> parse and emit.
    if (isKnownDeviceId(bytes[0])) {
      this._handleDeviceActivity(bytes);
      return;
    }

    // 2) Not activity -> could be reply data for an in-flight command.
    if (this._pending && this._pending.acceptReply(bytes)) {
      return;
    }

    // 3) Otherwise emit as orphan reply.
    this.emit("reply:orphan", bytes);
  }

  /**
   * Handle activity from any MDB device (we only parse cashless; others are forwarded as generic).
   */
  _handleDeviceActivity(bytes) {
    const deviceId = bytes[0];

    // Forward non-cashless activity without deep parsing.
    if (deviceId !== this.cashlessDeviceId) {
      this.emit("activity:other", { deviceId, bytes });
      return;
    }

    // Cashless activity: [DeviceID][code][payload...]
    const code = bytes[1] ?? null;
    const payload = bytes.slice(1); // keep [code][payload...] for parsing convenience

    const parsed = this._parseCashlessActivity(payload);
    this.emit("activity:cashless", parsed);

    // If pending collector expects this (e.g., Peripheral ID may arrive as activity), allow it.
    if (this._pending && this._pending.acceptActivity(parsed, bytes)) {
      return;
    }
  }

  /**
   * Parse cashless poll/activity payload (without DeviceID).
   * payload[0] = poll code.
   */
  _parseCashlessActivity(payload) {
    const code = payload[0];

    switch (code) {
      case POLL_JUST_RESET: {
        // Expected: 00 00 (two bytes) after code, but some bridges may send only 00 00 total in docs.
        const isJustReset = payload.length >= 3 && payload[1] === 0x00 && payload[2] === 0x00;
        const ev = { type: "justReset", code, isJustReset, raw: Buffer.from(payload) };
        this.emit("justReset", ev);
        return ev;
      }

      case POLL_READER_CONFIG_DATA: {
        // Payload identical to Reader Config Data but without CHK:
        // [01][Z2..Z8]
        const cfg = this._decodeReaderConfigDataNoChk(payload);
        const ev = { type: "readerConfig", code, config: cfg, raw: Buffer.from(payload) };
        this.readerConfig = cfg;
        this.emit("readerConfig", ev);
        return ev;
      }

      case POLL_DISPLAY_REQUEST: {
        const displayTimeTenthSec = payload[1] ?? 0;
        const textBytes = payload.slice(2);
        const text = textBytes.toString("ascii");
        const ev = { type: "displayRequest", code, displayTimeTenthSec, text, raw: Buffer.from(payload) };
        this.emit("displayRequest", ev);
        return ev;
      }

      case POLL_BEGIN_SESSION: {
        const ev = this._decodeBeginSession(payload);
        this.session.active = true;
        this.session.fundsScaled = ev.fundsScaled ?? null;
        this.emit("beginSession", ev);
        return ev;
      }

      case POLL_SESSION_CANCEL_REQUEST: {
        const ev = { type: "sessionCancelRequest", code, raw: Buffer.from(payload) };
        this.emit("sessionCancelRequest", ev);
        return ev;
      }

      case POLL_VEND_APPROVED: {
        const ev = this._decodeVendApproved(payload);
        this.emit("vendApproved", ev);
        return ev;
      }

      case POLL_VEND_DENIED: {
        const ev = { type: "vendDenied", code, raw: Buffer.from(payload) };
        this.emit("vendDenied", ev);
        return ev;
      }

      case POLL_END_SESSION: {
        this.session.active = false;
        const ev = { type: "endSession", code, raw: Buffer.from(payload) };
        this.emit("endSession", ev);
        return ev;
      }

      case POLL_CANCELLED: {
        const ev = { type: "cancelled", code, raw: Buffer.from(payload) };
        this.emit("cancelled", ev);
        return ev;
      }

      case POLL_PERIPHERAL_ID: {
        const ev = this._decodePeripheralId(payload);
        this.emit("peripheralId", ev);
        return ev;
      }

      case POLL_MALFUNCTION: {
        const ee = payload[1] ?? 0;
        const ss = payload[2] ?? 0;
        const errorType = (ee >> 3) & 0x1F; // top 5 bits
        const subcode = ((ee & 0x07) << 8) | ss;

        const ev = {
          type: "malfunction",
          code,
          errorType,
          subcode,
          raw: Buffer.from(payload),
        };
        this.emit("malfunction", ev);
        return ev;
      }

      case POLL_CMD_OUT_OF_SEQUENCE: {
        const badCmd = payload[1] ?? 0;
        const ev = { type: "commandOutOfSequence", code, badCmd, raw: Buffer.from(payload) };
        this.emit("commandOutOfSequence", ev);
        return ev;
      }

      case POLL_REVALUE_APPROVED: {
        const amountScaled = payload.length >= 3 ? u16be(payload[1], payload[2]) : null;
        const ev = { type: "revalueApproved", code, amountScaled, raw: Buffer.from(payload) };
        this.emit("revalueApproved", ev);
        return ev;
      }

      case POLL_REVALUE_DENIED: {
        const ev = { type: "revalueDenied", code, raw: Buffer.from(payload) };
        this.emit("revalueDenied", ev);
        return ev;
      }

      case POLL_REVALUE_LIMIT_AMOUNT: {
        const limitScaled = payload.length >= 3 ? u16be(payload[1], payload[2]) : null;
        const ev = { type: "revalueLimitAmount", code, limitScaled, raw: Buffer.from(payload) };
        this.emit("revalueLimitAmount", ev);
        return ev;
      }

      default: {
        const ev = { type: "unknown", code, raw: Buffer.from(payload) };
        this.emit("unknownActivity", ev);
        return ev;
      }
    }
  }

  _decodeReaderConfigDataNoChk(payload) {
    // payload: [01][Z2][Z3][Z4][Z5][Z6][Z7][Z8]
    if (payload.length < 8 || payload[0] !== POLL_READER_CONFIG_DATA) {
      throw new ProtocolError("Bad Reader Config Data activity", { code: "BAD_READER_CONFIG_ACTIVITY" });
    }
    const z2 = payload[1];
    const countryCode = u16be(payload[2], payload[3]);
    const scalingFactor = payload[4];
    const decimalPlaces = payload[5] & 0x0F;
    const maxResponseTimeSec = payload[6];
    const miscOptions = payload[7];

    return {
      readerFeatureLevel: z2,
      countryCode,
      scalingFactor,
      decimalPlaces,
      maxResponseTimeSec,
      miscOptions,
      misc: {
        canRefund: !!(miscOptions & 0x01),
        multivendCapable: !!(miscOptions & 0x02),
        hasOwnDisplay: !!(miscOptions & 0x04),
        supportsCashSale: !!(miscOptions & 0x08),
      },
    };
  }

  _decodeBeginSession(payload) {
    // payload: [03][...]
    // Variants (per spec):
    //  - 16-bit funds:            03 FF FF
    //  - 16-bit + PT PD:          03 FF FF PT PD
    //  - Expanded (32-bit etc):   03 FFFF FFFF CC CC LL LL PT PD
    const code = payload[0];
    const raw = Buffer.from(payload);

    if (payload.length === 3) {
      const fundsScaled = u16be(payload[1], payload[2]);
      return { type: "beginSession", code, mode: "funds16", fundsScaled, raw };
    }

    if (payload.length === 5) {
      const fundsScaled = u16be(payload[1], payload[2]);
      const paymentType = payload[3];
      const paymentData = payload[4];
      return { type: "beginSession", code, mode: "funds16+meta", fundsScaled, paymentType, paymentData, raw };
    }

    if (payload.length >= 11) {
      const fundsScaled32 = decodeU32BE(payload[1], payload[2], payload[3], payload[4]);
      const currencyCode = u16be(payload[5], payload[6]);
      const languageCode = u16be(payload[7], payload[8]);
      const paymentType = payload[9];
      const paymentData = payload[10];
      return {
        type: "beginSession",
        code,
        mode: "funds32+currency+lang+meta",
        fundsScaled: fundsScaled32,
        currencyCode,
        languageCode,
        paymentType,
        paymentData,
        raw,
      };
    }

    // Unknown length; still emit something useful.
    return { type: "beginSession", code, mode: "unknown", raw };
  }

  _decodeVendApproved(payload) {
    // payload: [05][AA AA] or [05][AA AA AA AA]
    const code = payload[0];
    const raw = Buffer.from(payload);

    if (payload.length === 3) {
      const amountScaled = u16be(payload[1], payload[2]);
      return { type: "vendApproved", code, mode: "amount16", amountScaled, raw };
    }

    if (payload.length >= 5) {
      const amountScaled = decodeU32BE(payload[1], payload[2], payload[3], payload[4]);
      const isToken = amountScaled === 0xFFFFFFFF;
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
    const has09 = raw.length >= 1 && raw[0] === POLL_PERIPHERAL_ID;
    const off = has09 ? 1 : 0;

    const BASE_LEN = off + 29; // mfg(3)+serial(12)+model(12)+ver(2)
    const OPT_LEN  = off + 33; // base + optbits(4)

    if (raw.length < BASE_LEN) {
      return { type: "peripheralId", code: POLL_PERIPHERAL_ID, incomplete: true, raw };
    }

    const mfg = raw.slice(off + 0,  off + 3).toString("ascii");
    const serial = raw.slice(off + 3, off + 15).toString("ascii").trim();
    const model = raw.slice(off + 15, off + 27).toString("ascii").trim();

    const verBcd0 = raw[off + 27];
    const verBcd1 = raw[off + 28];

    const swVersion = {
      raw: [verBcd0, verBcd1],
      text: `${(verBcd0 >> 4) & 0x0F}${verBcd0 & 0x0F}.${(verBcd1 >> 4) & 0x0F}${verBcd1 & 0x0F}`,
    };

    let optionalFeatureBits = null;
    if (raw.length >= OPT_LEN) {
      optionalFeatureBits = decodeU32BE(raw[off + 29], raw[off + 30], raw[off + 31], raw[off + 32]) >>> 0;
    }

    return {
      type: "peripheralId",
      code: POLL_PERIPHERAL_ID,
      manufacturer: mfg,
      serial,
      model,
      swVersion,
      optionalFeatureBits,
      raw,
    };
  }

  /**
   * ----------------------------
   * Command sending (single in-flight)
   * ----------------------------
   */

  /**
   * Serialize commands: only one pending reply context at a time.
   */
  async _enqueue(fn) {
    const prev = this._cmdChain;
    let release;
    this._cmdChain = new Promise((r) => (release = r));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Build cashless command byte for cashless#1 base.
   */
  _cmd(baseCashless1) {
    return (baseCashless1 + this.cashlessCmdOffset) & 0xFF;
  }

  /**
   * Send command and wait for reply (or handle multi-message).
   *
   * @param {Buffer} txBytes
   * @param {object} opts
   * @param {"ACK"|"ACK_OR_SILENCE"|"READER_CONFIG"|"MULTI_PERIPHERAL_ID"|"NONE"} opts.expect
   * @param {number} [opts.timeoutMs]
   * @returns {Promise<any>}
   */
  async _sendAndWait(txBytes, opts) {
    const { expect, timeoutMs } = opts;
    const tmo = timeoutMs ?? this.commandTimeoutMs;

    if (this._pending) {
      throw new ProtocolError("Command already pending", { code: "INTERNAL_PENDING" });
    }

    return await new Promise(async (resolve, reject) => {
      const deadline = Date.now() + tmo;

      const pending = {
        expect,
        buffer: Buffer.alloc(0),
        started: Date.now(),
        acceptReply: (rx) => {
          try {
            if (expect === "NONE") return false;

            if (expect === "ACK") {
              if (rx.length === 1 && (rx[0] === BRIDGE_REPLY_ACK || rx[0] === BRIDGE_REPLY_NAK)) {
                this._pending = null;
                if (rx[0] === BRIDGE_REPLY_ACK) return resolve({ ack: true, rx });
                return reject(new ProtocolError("Bridge NAK", { code: "BRIDGE_NAK", details: { rx } }));
              }
              return false;
            }

            if (expect === "ACK_OR_SILENCE") {
              if (rx.length === 1 && (rx[0] === BRIDGE_REPLY_ACK || rx[0] === BRIDGE_REPLY_NAK)) {
                this._pending = null;
                if (rx[0] === BRIDGE_REPLY_ACK) return resolve({ ack: true, rx });
                return reject(new ProtocolError("Bridge NAK", { code: "BRIDGE_NAK", details: { rx } }));
              }
              // other replies are ignored here
              return false;
            }

            if (expect === "READER_CONFIG") {
              // Некоторые мосты/ридеры отвечают на SETUP/00 сначала single-byte ACK (00),
              // а сам Reader Config Data присылают как activity (DeviceID 10/60 + 01 ... без CHK).
              // Поэтому:
              //  - 00: считаем "принял команду", но НЕ завершаем ожидание
              //  - FF: NAK -> ошибка
              //  - 01 ...: полноценный reply (обычно с CHK) -> завершаем ожидание

              if (rx.length === 1) {
                if (rx[0] === BRIDGE_REPLY_NAK) {
                  this._pending = null;
                  return reject(new ProtocolError("Bridge NAK", { code: "BRIDGE_NAK", details: { rx } }));
                }
                if (rx[0] === BRIDGE_REPLY_ACK) {
                  // consume ACK and keep waiting for config
                  return true;
                }
              }

              // Reply to SETUP/00: 01 Z2..Z8 CHK (или без CHK на некоторых реализациях)
              if (rx.length >= 2 && rx[0] === 0x01) {
                // Validate CHK if present
                if (rx.length >= 9) {
                  const chk = rx[rx.length - 1];
                  const calc = mdbChk8(rx.slice(0, rx.length - 1));
                  if (chk !== calc) {
                    this.emit("warn", {
                      type: "chkMismatch",
                      where: "READER_CONFIG_REPLY",
                      expected: calc,
                      got: chk,
                      rx,
                    });
                  }
                }

                const cfg = this._decodeReaderConfigReply(rx);
                this.readerConfig = cfg;

                this._pending = null;
                return resolve(cfg);
              }

              return false;
            }

            if (expect === "MULTI_PERIPHERAL_ID") {
              // Ignore single-byte ACK/NAK noise; actual ID is multi-byte ASCII fields.
              if (rx.length === 1) {
                if (rx[0] === BRIDGE_REPLY_NAK) {
                  this._pending = null;
                  return reject(new ProtocolError("Bridge NAK", { code: "BRIDGE_NAK", details: { rx } }));
                }
                if (rx[0] === BRIDGE_REPLY_ACK) {
                  // just consume; kick loop will request blocks anyway
                  return true;
                }
              }

              // Append data chunk. Some bridges may repeat 0x09 at the start of each chunk; de-duplicate.
              let chunk = rx;
              if (pending.buffer.length > 0 && chunk.length > 0 && chunk[0] === POLL_PERIPHERAL_ID) {
                chunk = chunk.slice(1);
              }
              pending.buffer = Buffer.concat([pending.buffer, chunk]);

              // Try decode as soon as we have enough (29 bytes w/o 09, or 30 bytes with 09)
              const buf = pending.buffer;
              const has09 = buf.length >= 1 && buf[0] === POLL_PERIPHERAL_ID;
              const minLen = has09 ? 30 : 29;

              if (buf.length >= minLen) {
                const decoded = this._decodePeripheralId(buf);
                if (!decoded.incomplete) {
                  this._pending = null;
                  return resolve(decoded);
                }
              }

              // If not enough bytes yet, ask for the next block (one-shot).
              // (Do not await: keep parsing path fast.)
              if (pending.buffer.length < 29) {
                this._writeBytes(Buffer.from([BRIDGE_BLOCK_ACK])).catch((e) => {
                  this.emit("warn", { type: "multiAckWriteFailed", error: String(e) });
                });
              }

              return true;
            }

            return false;
          } catch (e) {
            this._pending = null;
            return reject(e);
          }
        },
        
        acceptActivity: (parsed, fullBytes) => {
          // 1) SETUP/00 может завершиться по activity Reader Config Data:
          //    [DeviceID] 01 Z2..Z8  (без CHK)
          if (expect === "READER_CONFIG") {
            if (parsed && parsed.type === "readerConfig") {
              // parsed.config не содержит chk/chkOk (activity без CHK) — это нормально.
              const cfg = {
                ...parsed.config,
                chk: null,
                chkOk: null,
                raw: parsed.raw,
                source: "activity",
              };
              this.readerConfig = cfg;
              this._pending = null;
              return resolve(cfg);
            }
            return false;
          }

          // 2) Peripheral ID может прийти как activity:
          if (expect === "MULTI_PERIPHERAL_ID") {
            if (!parsed || parsed.type !== "peripheralId") return false;
            const rx = parsed.raw; // payload (09 + fields)
            return pending.acceptReply(rx);
          }

          return false;
        },

        cancel: () => {
          this._pending = null;
          reject(new ProtocolError("Timeout waiting for reply", { code: "TIMEOUT", details: { expect } }));
        },
      };

      this._pending = pending;

      // Write command.
      try {
        await this._writeBytes(txBytes);

        // Kick loop for multi-message devices (Wafer):
        // Some firmwares start sending blocks only after repeated 0x00 block-acks.
        // We keep sending 0x00 periodically while MULTI_PERIPHERAL_ID is pending.
        if (expect === "MULTI_PERIPHERAL_ID") {
          (async () => {
            await delay(MULTI_FIRST_BLOCK_KICK_START_DELAY_MS);

            let kicks = 0;

            // Kick only until we receive the first bytes (pending.buffer becomes non-empty),
            // and only up to MULTI_FIRST_BLOCK_KICK_MAX times to avoid log spam.
            while (this._pending === pending && pending.buffer.length === 0 && kicks < MULTI_FIRST_BLOCK_KICK_MAX) {
              await this._writeBytes(Buffer.from([BRIDGE_BLOCK_ACK]));
              kicks++;
              await delay(MULTI_FIRST_BLOCK_KICK_INTERVAL_MS);
            }

            // Optional: warn if we kicked but still got nothing (device likely doesn't support Request ID).
            if (this._pending === pending && pending.buffer.length === 0 && kicks >= MULTI_FIRST_BLOCK_KICK_MAX) {
              this.emit("warn", { type: "multiKickLimitReached", kicks });
            }
          })().catch((e) => {
            this.emit("warn", { type: "multiKickLoopFailed", error: String(e) });
          });
        }
      } catch (e) {
        this._pending = null;
        return reject(e);
      }

      // Timeout watchdog.
      const tick = async () => {
        while (this._pending === pending) {
          if (Date.now() > deadline) {
            // For ACK_OR_SILENCE: treat timeout as success with ack=false.
            if (expect === "ACK_OR_SILENCE") {
              this._pending = null;
              return resolve({ ack: false, rx: null });
            }
            pending.cancel();
            return;
          }
          await delay(10);
        }
      };
      tick().catch(() => {});
    });
  }

  /**
   * Decode SETUP/00 reply: 01 Z2 Z3 Z4 Z5 Z6 Z7 Z8 CHK
   */
  _decodeReaderConfigReply(rx) {
    if (rx[0] !== 0x01) throw new ProtocolError("Bad reader config reply header", { code: "BAD_CFG_HDR" });
    if (rx.length < 9) {
      // Short reply (should not happen for standard readers); return partial.
      return { partial: true, raw: rx };
    }

    const readerFeatureLevel = rx[1];
    const countryCode = u16be(rx[2], rx[3]);
    const scalingFactor = rx[4];
    const decimalPlaces = rx[5] & 0x0F;
    const maxResponseTimeSec = rx[6];
    const miscOptions = rx[7];
    const chk = rx[8];
    const calc = mdbChk8(rx.slice(0, 8));

    return {
      readerFeatureLevel,
      countryCode,
      scalingFactor,
      decimalPlaces,
      maxResponseTimeSec,
      miscOptions,
      chk,
      chkOk: chk === calc,
      misc: {
        canRefund: !!(miscOptions & 0x01),
        multivendCapable: !!(miscOptions & 0x02),
        hasOwnDisplay: !!(miscOptions & 0x04),
        supportsCashSale: !!(miscOptions & 0x08),
      },
      raw: rx,
    };
  }

  /**
   * ----------------------------
   * Public API (commands)
   * ----------------------------
   */

  /**
   * RESET (10/60)
   * Reply: 00 ACK / FF NAK
   */
  async reset() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([this._cmd(MDB_CASHLESS_CMD_RESET)]);
      return await this._sendAndWait(cmd, { expect: "ACK" });
    });
  }

  /**
   * SETUP/00 Config Data (11 00 Y2 Y3 Y4 Y5) WITHOUT CHK.
   * Reply: Reader Config Data (01 ... CHK)
   *
   * @param {object} cfg
   * @param {number} [cfg.vmcFeatureLevel=3]   1..3
   * @param {number} [cfg.columns=0]          0..255
   * @param {number} [cfg.rows=0]             0..255
   * @param {"unused"|"numbers+upper"|"fullAscii"} [cfg.displayType="fullAscii"]
   */
  async setupConfig(cfg = {}) {
    return await this._enqueue(async () => {
      const {
        vmcFeatureLevel = 3,
        columns = 0,
        rows = 0,
        displayType = "fullAscii",
      } = cfg;

      if (![1, 2, 3].includes(vmcFeatureLevel)) {
        throw new ProtocolError("VMC feature level must be 1..3", {
          code: "BAD_FEATURE_LEVEL",
          details: { vmcFeatureLevel },
        });
      }
      if (!Number.isInteger(columns) || columns < 0 || columns > 0xFF) {
        throw new ProtocolError("columns out of range", { code: "BAD_COLUMNS", details: { columns } });
      }
      if (!Number.isInteger(rows) || rows < 0 || rows > 0xFF) {
        throw new ProtocolError("rows out of range", { code: "BAD_ROWS", details: { rows } });
      }

      // Y5 Display Information: upper 5 bits unused (0), lower 3 bits type:
      //  000 unused
      //  001 numbers+upper+blank+decimal point
      //  010 full ASCII
      const yyy =
        displayType === "unused" ? 0b000 :
        displayType === "numbers+upper" ? 0b001 :
        displayType === "fullAscii" ? 0b010 :
        (() => { throw new ProtocolError("Unknown displayType", { code: "BAD_DISPLAY_TYPE", details: { displayType } }); })();

      const y5 = yyy & 0x07;

      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_SETUP),
        MDB_SETUP_SUBCMD_CONFIG_DATA,
        vmcFeatureLevel & 0xFF,
        columns & 0xFF,
        rows & 0xFF,
        y5,
      ]);

      return await this._sendAndWait(cmd, { expect: "READER_CONFIG" });
    });
  }

  /**
   * SETUP/01 Max-Min Prices (11 01 YY YY YY YY) WITHOUT CHK.
   * Some Wafer/Nayax combinations may reply with ACK, others may be silent (seen in manual),
   * so default behavior is "ACK_OR_SILENCE".
   *
   * @param {object} p
   * @param {number} [p.maxPriceScaled=0xFFFF]
   * @param {number} [p.minPriceScaled=0x0000]
   * @param {number} [p.timeoutMs=600]
   */
  async setupMaxMinPrices(p = {}) {
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

      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs });
    });
  }

  /**
   * EXPANSION/00 Request ID (17 00) WITHOUT CHK.
   * Reply may arrive as:
   *  - reply data starting with 09 ... (often multi-message), OR
   *  - activity data: [DeviceID] 09 ...
   *
   * Module collects blocks until full Peripheral ID (34 bytes) is assembled.
   */
  async expansionRequestId() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_EXPANSION),
        MDB_EXPANSION_SUBCMD_REQUEST_ID,
      ]);

      // Use a longer timeout for multi-message collection.
      return await this._sendAndWait(cmd, { expect: "MULTI_PERIPHERAL_ID", timeoutMs: this.multiBlockTimeoutMs });
    });
  }

  /**
   * EXPANSION/04 Optional Feature Enable: 17 04 BB BB BB BB
   *
   * @param {number} featureMask32 32-bit mask (see OPT_FEATURE_* constants)
   */
  async expansionEnableOptions(featureMask32) {
    return await this._enqueue(async () => {
      const mask = featureMask32 >>> 0;
      const [b0, b1, b2, b3] = encodeU32BE(mask);

      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_EXPANSION),
        MDB_EXPANSION_SUBCMD_OPTIONAL_FEATURE_ENABLE,
        b0, b1, b2, b3,
      ]);

      return await this._sendAndWait(cmd, { expect: "ACK" });
    });
  }

  /**
   * READER CONTROL: Disable (14 00)
   */
  async readerDisable() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_READER_CONTROL),
        MDB_READER_CTRL_DISABLE,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK" });
    });
  }

  /**
   * READER CONTROL: Enable (14 01)
   */
  async readerEnable() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_READER_CONTROL),
        MDB_READER_CTRL_ENABLE,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK" });
    });
  }

  /**
   * READER CONTROL: Cancel (14 02) - optional.
   */
  async readerCancel() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_READER_CONTROL),
        MDB_READER_CTRL_CANCEL,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 600 });
    });
  }

  /**
   * VEND/00 Vend Request.
   * Standard (16-bit money): 13 00 PP PP II II
   * Expanded (32-bit money): 13 00 PP PP PP PP II II
   *
   * @param {object} r
   * @param {number} r.priceScaled     Price in scaled units (u16 or u32 depending on mode).
   * @param {number} [r.itemNumber=0xFFFF]  Item number (u16) or 0xFFFF.
   * @param {boolean} [r.use32bit=false] Force 32-bit price format (if reader supports and enabled).
   */
  async vendRequest(r) {
    return await this._enqueue(async () => {
      const { priceScaled, itemNumber = 0xFFFF, use32bit = false } = r ?? {};
      if (!Number.isInteger(priceScaled) || priceScaled < 0) {
        throw new ProtocolError("priceScaled must be non-negative integer", {
          code: "BAD_PRICE",
          details: { priceScaled },
        });
      }

      const [iiHi, iiLo] = encodeU16BE(itemNumber);

      let cmd;
      if (use32bit) {
        const [p0, p1, p2, p3] = encodeU32BE(priceScaled >>> 0);
        cmd = Buffer.from([
          this._cmd(MDB_CASHLESS_CMD_VEND),
          MDB_VEND_SUBCMD_REQUEST,
          p0, p1, p2, p3,
          iiHi, iiLo,
        ]);
      } else {
        const [ppHi, ppLo] = encodeU16BE(priceScaled);
        cmd = Buffer.from([
          this._cmd(MDB_CASHLESS_CMD_VEND),
          MDB_VEND_SUBCMD_REQUEST,
          ppHi, ppLo,
          iiHi, iiLo,
        ]);
      }

      this.session.lastVendPriceScaled = priceScaled;
      this.session.lastVendItem = itemNumber;

      // In MDB cashless, vend request typically replies ACK/NAK (bridge reply data).
      return await this._sendAndWait(cmd, { expect: "ACK" });
    });
  }

  /**
   * VEND/01 Vend Cancel: 13 01
   * Reader should respond with Vend Denied (activity 10 06).
   */
  async vendCancel() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_VEND),
        MDB_VEND_SUBCMD_CANCEL,
      ]);
      // Often ACK, but can be silent on some readers; keep tolerant.
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 600 });
    });
  }

  /**
   * VEND/02 Vend Success: 13 02 II II
   */
  async vendSuccess(itemNumber = 0xFFFF) {
    return await this._enqueue(async () => {
      const [iiHi, iiLo] = encodeU16BE(itemNumber);
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_VEND),
        MDB_VEND_SUBCMD_SUCCESS,
        iiHi, iiLo,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
    });
  }

  /**
   * VEND/03 Vend Failure: 13 03
   * Meaning: refund (if supported by reader).
   */
  async vendFailure() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_VEND),
        MDB_VEND_SUBCMD_FAILURE,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
    });
  }

  /**
   * VEND/04 Session Complete: 13 04
   * Reader should respond with End Session (activity 10 07).
   */
  async sessionComplete() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_VEND),
        MDB_VEND_SUBCMD_SESSION_COMPLETE,
      ]);
      this.session.active = false;
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
    });
  }

  /**
   * REVALUE/00 Revalue Request: 15 00 AA AA
   */
  async revalueRequest(amountScaled) {
    return await this._enqueue(async () => {
      const [aHi, aLo] = encodeU16BE(amountScaled);
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_REVALUE),
        MDB_REVALUE_SUBCMD_REQUEST,
        aHi, aLo,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
    });
  }

  /**
   * REVALUE/01 Revalue Limit Request: 15 01
   * Reader responds with activity 10 0F (limit) or 10 0E (denied).
   */
  async revalueLimitRequest() {
    return await this._enqueue(async () => {
      const cmd = Buffer.from([
        this._cmd(MDB_CASHLESS_CMD_REVALUE),
        MDB_REVALUE_SUBCMD_LIMIT_REQUEST,
      ]);
      return await this._sendAndWait(cmd, { expect: "ACK_OR_SILENCE", timeoutMs: 800 });
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
   * Convert real value (number) to scaled integer using last known readerConfig (round to nearest int).
   */

  realToScaled(real) {
    if (!this.readerConfig) {
      throw new ProtocolError("readerConfig unknown; call setupConfig first", { code: "NO_CFG" });
    }
    const { scalingFactor, decimalPlaces } = this.readerConfig;

    // MDB 4.2:
    // scaled P = actual / (ScaleFactor * 10^(-DecimalPlaces))
    // => P = actual * 10^decimalPlaces / scalingFactor
    const mul = Math.pow(10, decimalPlaces);
    return Math.round((real * mul) / scalingFactor);
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

  // Optional feature bits
  OPT_FEATURE_FILE_TRANSPORT_LAYER,
  OPT_FEATURE_32BIT_MONEY,
  OPT_FEATURE_MULTI_CURRENCY_LANG,
  OPT_FEATURE_NEGATIVE_VEND,
  OPT_FEATURE_DATA_ENTRY,
  OPT_FEATURE_ALWAYS_IDLE,

  // Poll codes (cashless activity)
  POLL_JUST_RESET,
  POLL_READER_CONFIG_DATA,
  POLL_DISPLAY_REQUEST,
  POLL_BEGIN_SESSION,
  POLL_SESSION_CANCEL_REQUEST,
  POLL_VEND_APPROVED,
  POLL_VEND_DENIED,
  POLL_END_SESSION,
  POLL_CANCELLED,
  POLL_PERIPHERAL_ID,
  POLL_MALFUNCTION,
  POLL_CMD_OUT_OF_SEQUENCE,
  POLL_REVALUE_APPROVED,
  POLL_REVALUE_DENIED,
  POLL_REVALUE_LIMIT_AMOUNT,

  // Bridge ack bytes
  BRIDGE_BLOCK_ACK,
  BRIDGE_REPLY_ACK,
  BRIDGE_REPLY_NAK,
};

export default MdbRs232Cashless;