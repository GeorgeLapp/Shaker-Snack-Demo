// resize-images.js (CommonJS, stable 'cover' crop)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TARGET_W = 313;
const TARGET_H = 374;
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.gif']);

function isImageFile(file) {
  const ext = path.extname(file).toLowerCase();
  return exts.has(ext);
}

function addUnderscoreToName(filename) {
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  return `${base}_${ext}`;
}

async function processImage(file) {
  const full = path.resolve(file);
  const ext = path.extname(full);
  const base = path.basename(full, ext);

  if (base.endsWith('_')) {
    console.log(`- Пропуск (исходник с "_"): ${file}`);
    return;
  }

  const dir = path.dirname(full);
  const originalRenamed = path.join(dir, addUnderscoreToName(path.basename(full)));

  // Переименуем исходник -> name_.ext (если ещё не)
  if (!fs.existsSync(originalRenamed)) {
    fs.renameSync(full, originalRenamed);
  } else {
    console.log(`! Исходник уже существует: ${originalRenamed}`);
  }

  // Центр-кроп с сохранением пропорций до точных 313×374
  let pipeline = sharp(originalRenamed).rotate().resize({
    width: TARGET_W,
    height: TARGET_H,
    fit: 'cover',       // масштабировать пропорционально, заполняя кадр
    position: 'centre', // кроп строго из центра
    withoutEnlargement: false
  });

  const fmt = ext.toLowerCase().slice(1);
  if (fmt === 'jpg' || fmt === 'jpeg') pipeline = pipeline.jpeg({ quality: 90, progressive: true });
  else if (fmt === 'png') pipeline = pipeline.png({ compressionLevel: 9 });
  else if (fmt === 'webp') pipeline = pipeline.webp({ quality: 90 });
  else if (fmt === 'tif' || fmt === 'tiff') pipeline = pipeline.tiff({ quality: 90 });
  else if (fmt === 'gif') pipeline = pipeline.gif(); // (один кадр)

  await pipeline.toFile(full);
  console.log(`✔ Готово: ${path.basename(full)} (313×374)`);
}

(async () => {
  const files = fs.readdirSync(process.cwd()).filter(isImageFile);
  if (files.length === 0) {
    console.log('В текущей папке нет поддерживаемых изображений.');
    return;
  }
  console.log(`Найдено изображений: ${files.length}`);
  for (const f of files) {
    try {
      await processImage(f);
    } catch (e) {
      console.error(`✖ Сбой для ${f}:`, e.message);
    }
  }
  console.log('Готово!');
})();
