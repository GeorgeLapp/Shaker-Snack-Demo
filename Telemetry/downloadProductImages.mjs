#!/usr/bin/env node
//
// Назначение:
//   1) Прочитать из SQLite-БД все товары с непустым catalog_product.img_url
//   2) Скачать изображения по этим ссылкам
//   3) Сохранить их под именем <goodId>.<расширение> в указанную папку
//
// Использование как CLI:
//   node downloadProductImages.mjs [path/to/goods.db] [outputDir]
//
//   Примеры:
//     node downloadProductImages.mjs
//     node downloadProductImages.mjs ./goods.db ./images
//
// Использование как модуля:
//   import { downloadAllProductImages } from './downloadProductImages.mjs';
//   await downloadAllProductImages({ dbPath: 'goods.db', outputDir: 'images' });
//
// Требования:
//   - Node.js >= 18 (чтобы был глобальный fetch).
//   - Пакет sqlite3: npm i sqlite3
//

import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// =========================
// Вспомогательные функции для SQLite3 (обёртка в промисы)
// =========================

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READONLY,
      (err) => (err ? reject(err) : resolve(db))
    );
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

// =========================
// Определение расширения файла
// =========================

/**
 * Определяет расширение файла по Content-Type или URL.
 *
 * @param {string | null} contentType - заголовок Content-Type (например, "image/jpeg")
 * @param {string} urlStr - исходный URL картинки
 * @returns {string} расширение без точки, например "jpg"
 */
function resolveExtension(contentType, urlStr) {
  // 1) Пробуем по Content-Type
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    switch (ct) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      case 'image/bmp':
        return 'bmp';
      case 'image/svg+xml':
        return 'svg';
      default:
      // оставим попытку по URL
    }
  }

  // 2) Если по Content-Type не получилось — пробуем вытащить расширение из URL
  try {
    const u = new URL(urlStr);
    const basename = path.basename(u.pathname); // например, "image01.png"
    const dotIdx = basename.lastIndexOf('.');
    if (dotIdx > 0 && dotIdx < basename.length - 1) {
      const ext = basename.slice(dotIdx + 1).toLowerCase();
      // Минимальная фильтрация "адекватных" расширений
      if (/^[a-z0-9]{2,5}$/.test(ext)) {
        return ext;
      }
    }
  } catch {
    // Если URL кривой — просто игнорируем и берём дефолт
  }

  // 3) Дефолт — jpg
  return 'jpg';
}

// =========================
// Загрузка одной картинки
// =========================

/**
 * Качает картинку по URL и сохраняет в файл destPath.
 *
 * @param {string} urlStr - URL картинки
 * @param {string} destPath - путь до файла, включая имя и расширение
 */
async function downloadImage(urlStr, destPath) {
  const res = await fetch(urlStr);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(destPath, buffer);
}

// =========================
// Основная функция
// =========================

/**
 * Основная функция:
 *   - читает товары из catalog_product
 *   - скачивает и сохраняет изображения
 *
 * @param {Object} options
 * @param {string} [options.dbPath='goods.db'] - путь к SQLite-БД
 * @param {string} [options.outputDir='images'] - каталог для сохранения картинок
 * @param {number} [options.delayMs=100] - задержка между скачиваниями, мс (для снижения нагрузки)
 */
export async function downloadAllProductImages({
  dbPath = 'goods.db',
  outputDir = 'images',
  delayMs = 100
} = {}) {
  console.log(`→ Используем БД: ${dbPath}`);
  console.log(`→ Папка для изображений: ${outputDir}`);

  // 1) Убедимся, что папка существует
  await fs.mkdir(outputDir, { recursive: true });

  // 2) Открываем БД и выбираем товары
  const db = await openDb(dbPath);

  try {
    const rows = await allAsync(
      db,
      `
      SELECT id AS good_id, img_url
      FROM catalog_product
      WHERE img_url IS NOT NULL
        AND TRIM(img_url) <> ''
      ORDER BY id
      `
    );

    if (!rows.length) {
      console.log('⚠ В таблице catalog_product нет товаров с непустым img_url.');
      return;
    }

    console.log(`→ Найдено товаров с картинками: ${rows.length}`);

    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
      const goodId = row.good_id;
      const urlStr = row.img_url;

      // Простейшая проверка протокола
      if (!/^https?:\/\//i.test(urlStr)) {
        console.warn(
          `✖ [id=${goodId}] Пропуск: img_url не http/https: "${urlStr}"`
        );
        failCount++;
        continue;
      }

      try {
        console.log(`↓ [id=${goodId}] Скачиваю: ${urlStr}`);

        // Сначала HEAD/GET, чтобы узнать Content-Type.
        // Для простоты делаем один полноценный GET и определяем расширение по заголовку.
        const res = await fetch(urlStr);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type');
        const ext = resolveExtension(contentType, urlStr);
        const fileName = `${goodId}.${ext}`;
        const destPath = path.join(outputDir, fileName);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(destPath, buffer);

        console.log(`✔ [id=${goodId}] Сохранено в: ${destPath} (Content-Type: ${contentType || 'unknown'})`);
        successCount++;
      } catch (err) {
        console.error(`✖ [id=${goodId}] Ошибка при скачивании: ${err.message}`);
        failCount++;
      }

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }

    console.log('=== Итог ===');
    console.log(`✔ Успешно: ${successCount}`);
    console.log(`✖ Ошибок:  ${failCount}`);
  } finally {
    await closeDb(db);
  }
}

// =========================
// Запуск как отдельный скрипт
// =========================

// =========================
// Запуск как отдельный скрипт
// =========================

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const dbPath = process.argv[2] || 'goods.db';
  const outputDir = process.argv[3] || 'images';

  downloadAllProductImages({ dbPath, outputDir })
    .then(() => {
      console.log('Готово.');
    })
    .catch((err) => {
      console.error('Фатальная ошибка:', err);
      process.exitCode = 1;
    });
}
