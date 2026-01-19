// mdb-rs232-cashless-purchase-test.mjs
// Product First (Always Idle): VMC initiates payment AFTER product selection.
// Flow: readerEnable -> VEND REQUEST -> wait card -> vendApproved/vendDenied -> vendSuccess/vendFailure -> sessionComplete

import MdbRs232Cashless, { CashlessConstants } from "./mdb-rs232-cashless.mjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PORT_PATH = "/dev/ttyS4";
const CASHLESS_NUMBER = 1;
const DEBUG = true;

// таймауты теста
const T_WAIT_APPROVAL_MS = 90_000;        // ждать vendApproved/vendDenied после VEND REQUEST
const T_WAIT_END_SESSION_MS = 20_000;     // ждать endSession после sessionComplete (не критично)
const READER_ENABLE_TO_VEND_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitEvent(emitter, eventName, timeoutMs, filter = null) {
  return new Promise((resolve, reject) => {
    const onEvent = (ev) => {
      try {
        if (filter && !filter(ev)) return;
        cleanup();
        resolve(ev);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(t);
      emitter.removeListener(eventName, onEvent);
    }

    emitter.on(eventName, onEvent);
  });
}

async function waitAny(bridge, variants, timeoutMs) {
  // variants: [{ name, event }]
  return new Promise((resolve, reject) => {
    const listeners = [];
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for events: ${variants.map(v => v.event).join(", ")}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(t);
      for (const { event, fn } of listeners) bridge.removeListener(event, fn);
    }

    for (const v of variants) {
      const fn = (ev) => {
        cleanup();
        resolve({ name: v.name, event: v.event, ev });
      };
      listeners.push({ event: v.event, fn });
      bridge.on(v.event, fn);
    }
  });
}

function attachLogging(bridge) {
  bridge.on("banner", (t) => console.log("[BANNER]", t));
  bridge.on("debug:tx", (d) => console.log("[TX]", d.hex));
  bridge.on("debug:rx", (d) => console.log("[RX]", d.hex));
  bridge.on("warn", (w) => console.warn("[WARN]", w));
  bridge.on("error", (e) => console.error("[ERR]", e));

  bridge.on("displayRequest", (ev) => {
    console.log("[DISPLAY_REQUEST]", { t: ev.displayTimeTenthSec, text: ev.text });
  });

  // В Always Idle beginSession может появляться не всегда/не сразу — но логировать полезно
  bridge.on("beginSession", (ev) => console.log("[BEGIN_SESSION]", ev));
  bridge.on("vendApproved", (ev) => console.log("[VEND_APPROVED]", ev));
  bridge.on("vendDenied", (ev) => console.log("[VEND_DENIED]", ev));
  bridge.on("endSession", (ev) => console.log("[END_SESSION]", ev));
  bridge.on("cancelled", (ev) => console.log("[CANCELLED]", ev));
  bridge.on("sessionCancelRequest", (ev) => console.log("[SESSION_CANCEL_REQUEST]", ev));
  bridge.on("malfunction", (ev) => console.log("[MALFUNCTION]", ev));
  bridge.on("commandOutOfSequence", (ev) => console.log("[OUT_OF_SEQUENCE]", ev));
}

async function initBridge(bridge) {
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

  // Always Idle enable (bit b5)
  try {
    await bridge.expansionEnableOptions(CashlessConstants.OPT_FEATURE_ALWAYS_IDLE);
  } catch (e) {
    console.warn("EXPANSION/04 failed (optional), continue:", e.code || e);
  }

  // В idle держим ридер выключенным, чтобы “случайный” card-first не вмешивался
  await bridge.readerDisable();

  console.log("Init done. Reader is DISABLED in idle. Use: buy <item> <price>");
}

async function purchaseOnce(bridge, rl, itemNumber, priceReal) {
  const priceScaled = bridge.realToScaled(priceReal);

  console.log("");
  console.log("=== PURCHASE START (Always Idle / Product First) ===");
  console.log("Selected item:", itemNumber, "priceReal:", priceReal, "priceScaled:", priceScaled);

  // 1) Enable reader
  console.log("Step 1) Enable reader...");
  await bridge.readerEnable();
  await sleep(READER_ENABLE_TO_VEND_DELAY_MS);

  // 2) IMPORTANT: In Always Idle we DO NOT wait for beginSession.
  // We send VEND REQUEST immediately after product selection.
  console.log("Step 2) Send VEND REQUEST now (reader will wait for card)...");
  await bridge.vendRequest({ priceScaled, itemNumber });

  console.log("Step 3) Now tap/insert card. Waiting vendApproved/vendDenied...");

  const r = await waitAny(
    bridge,
    [
      { name: "approved", event: "vendApproved" },
      { name: "denied", event: "vendDenied" },
      { name: "cancelReq", event: "sessionCancelRequest" },
      { name: "cancelled", event: "cancelled" },
      { name: "end", event: "endSession" },
      { name: "malf", event: "malfunction" },
      { name: "oos", event: "commandOutOfSequence" },
    ],
    T_WAIT_APPROVAL_MS
  );

  if (r.name === "approved") {
    console.log("Step 4) APPROVED. Vend item on real hardware.");
    const ans = (await rl.question('Type "ok" if vend succeeded, "fail" if vend failed: ')).trim().toLowerCase();

    if (ans === "ok") {
      console.log("Sending vendSuccess...");
      await bridge.vendSuccess(itemNumber);
    } else {
      console.log("Sending vendFailure (refund if supported)...");
      await bridge.vendFailure();
    }

    console.log("Sending sessionComplete...");
    await bridge.sessionComplete();

    try {
      await waitEvent(bridge, "endSession", T_WAIT_END_SESSION_MS);
    } catch {
      console.warn("No EndSession after sessionComplete (tolerated).");
    }

    console.log("Disable reader back to idle.");
    await bridge.readerDisable();

    console.log("=== PURCHASE END (approved) ===");
    return;
  }

  // Not approved or abnormal termination
  console.warn("Purchase not approved / aborted:", r.name);

  // Best-effort cleanup:
  // In Always Idle, if user didn't tap card, cancelling is correct behavior.
  try { await bridge.vendCancel(); } catch {}
  try { await bridge.sessionComplete(); } catch {}
  try { await bridge.readerDisable(); } catch {}

  console.log("=== PURCHASE END (not approved) ===");
}

async function main() {
  const rl = createInterface({ input, output });

  const bridge = new MdbRs232Cashless({
    portPath: PORT_PATH,
    cashlessNumber: CASHLESS_NUMBER,
    debug: DEBUG,
  });

  attachLogging(bridge);
  await initBridge(bridge);

  let busy = false;

  const shutdown = async () => {
    console.log("\nShutting down...");
    try { await bridge.readerDisable(); } catch {}
    try { await bridge.close(); } catch {}
    try { rl.close(); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (true) {
    const line = (await rl.question("> ")).trim();
    if (!line) continue;

    if (line === "quit" || line === "exit") {
      await shutdown();
      return;
    }

    const [cmd, a, b] = line.split(/\s+/);

    if (cmd === "buy") {
      if (busy) {
        console.warn("Already in purchase flow. Wait until it finishes.");
        continue;
      }

      const itemNumber = Number.parseInt(a, 10);
      const priceReal = Number.parseFloat(b);

      if (!Number.isInteger(itemNumber) || itemNumber < 0 || itemNumber > 0xffff) {
        console.warn('Bad itemNumber. Example: buy 21 2');
        continue;
      }
      if (!Number.isFinite(priceReal) || priceReal <= 0) {
        console.warn('Bad price. Example: buy 21 2');
        continue;
      }

      busy = true;
      try {
        await purchaseOnce(bridge, rl, itemNumber, priceReal);
      } catch (e) {
        console.error("Purchase flow error:", e);
        try { await bridge.vendCancel(); } catch {}
        try { await bridge.sessionComplete(); } catch {}
        try { await bridge.readerDisable(); } catch {}
      } finally {
        busy = false;
      }
      continue;
    }

    console.log('Unknown command. Use: buy <itemNumber> <priceReal> or exit');
  }
}

await main();
