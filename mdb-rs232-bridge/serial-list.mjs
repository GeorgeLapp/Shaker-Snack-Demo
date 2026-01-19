import { SerialPort } from 'serialport';
import fs from 'node:fs/promises';

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    )
  ]);
}

async function listOpenablePorts() {
  try {
    const files = await fs.readdir('/dev');

    // Берём ВСЕ файлы, начинающиеся на "tty", кроме /dev/tty (это текущий виртуальный терминал)
    // Это позволит автоматически захватывать любые USB-serial устройства (ttyUSB*, ttyACM* и т.д.),
    // когда они появятся после подключения, без жёстких паттернов.
    let candidates = files
      .filter(file => file.startsWith('tty') && file !== 'tty')
      .map(file => `/dev/${file}`);

    if (candidates.length === 0) {
      console.log('not found');
      return;
    }

    candidates.sort();

    let found = false;

    for (const path of candidates) {
      let port;
      let opened = false;
      try {
        port = new SerialPort({
          path,
          baudRate: 9600,
          autoOpen: false
        });

        // Поглощаем события error, чтобы процесс не падал
        port.on('error', () => {});

        await withTimeout(port.open(), 2000);
        opened = true;

        console.log(path);
        found = true;
      } catch (err) {
        // Порт не открылся — просто пропускаем (не serial-устройство, занят, нет доступа и т.д.)
      } finally {
        if (opened && port?.isOpen) {
          try {
            await port.close();
          } catch (closeErr) {
            // Игнорируем ошибки закрытия
          }
        }
      }
    }

    if (!found) {
      console.log('not found');
    }
  } catch (err) {
    console.error('error:', err.message);
  }
}

listOpenablePorts();