import MdbRs232Cashless, { CashlessConstants } from "./mdb-rs232-cashless.mjs";

const bridge = new MdbRs232Cashless({
  portPath: "/dev/ttyS4",
  cashlessNumber: 1,
  debug: true,
  multiBlockTimeoutMs: 8000,
});

bridge.on("banner", (t) => console.log("[BANNER]", t));
bridge.on("debug:tx", (d) => console.log("[TX]", d.hex));
bridge.on("debug:rx", (d) => console.log("[RX]", d.hex));
bridge.on("warn", (w) => console.warn("[WARN]", w));
bridge.on("error", (e) => console.error("[ERR]", e));

// Cashless activity
bridge.on("activity:cashless", (ev) => console.log("[CASHLESS]", ev.type, ev));

await bridge.open();

// Рекомендуемая последовательность старта
await bridge.reset();
const cfg = await bridge.setupConfig({ vmcFeatureLevel: 3, columns: 0, rows: 0, displayType: "fullAscii" });

// (Опционально) min/max prices
await bridge.setupMaxMinPrices({
  minPriceScaled: bridge.realToScaled(1.0),
  maxPriceScaled: bridge.realToScaled(500.0),
});

// Разрешить ридер
await bridge.readerEnable();

let id = null;

try {
  id = await bridge.expansionRequestId();
  console.log("Reader:", id.manufacturer, id.model, id.serial);
} catch (e) {
  console.warn("RequestId failed (can be unsupported/busy), continue:", e.code || e);
}

// дальше пробуем optional features
try {
  await bridge.expansionEnableOptions(CashlessConstants.OPT_FEATURE_ALWAYS_IDLE);
} catch (e) {
  console.warn("EnableOptions failed, continue:", e.code || e);
}

// Получить ID устройства
// const id = await bridge.expansionRequestId();
// console.log("Reader:", id.manufacturer, id.model, id.serial);

// Включить Always Idle (часто требуется для некоторых терминалов)
// await bridge.expansionEnableOptions(CashlessConstants.OPT_FEATURE_ALWAYS_IDLE);

console.log("Ready for sessions...");