// Используем готовую функцию из вашего модуля, без лишних импортов
import { sendCellVolumesFromSqlite } from './sendCellVolumesFromSqlite.mjs';

// node sync-volume.mjs goods.db 1 2 3
const dbPath = process.argv[2] || 'goods.db';
const cells = process.argv.slice(3).map(n => parseInt(n, 10)).filter(Number.isInteger);

(async () => {
  try {
    const confirmed = await sendCellVolumesFromSqlite(dbPath, {
      cellNumbers: cells.length ? cells : undefined
    });
    if (!confirmed.length) {
      console.log('Нет подтвержденных ячеек (возможно, нечего отправлять или не включены в planogram).');
      return;
    }
    for (const { cellNumber, volume } of confirmed) {
      console.log(`✓ confirmed: cell ${cellNumber} → volume=${volume}`);
    }
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exitCode = 1;
  }
})();
