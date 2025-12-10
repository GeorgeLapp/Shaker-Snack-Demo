// telemetry-config.mjs
// Конфигурация HTTP API телеметрии с рабочими значениями по умолчанию,
// чтобы сервис можно было запустить без переменных окружения.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Порт HTTP-сервера телеметрии.
// По умолчанию используем 3002, чтобы не конфликтовать с BFF (3001).
export const HTTP_PORT = Number(process.env.TELEMETRY_HTTP_PORT ?? 3002);

// URL для получения OAuth2 access_token.
export const TELEMETRY_OAUTH_URL =
  process.env.TELEMETRY_OAUTH_URL ??
  'https://kk.ishaker.ru:4437/realms/machine-realm/protocol/openid-connect/token';

// WebSocket URL для обмена с сервером телеметрии.
export const TELEMETRY_WS_URL =
  process.env.TELEMETRY_WS_URL ?? 'ws://185.46.8.39:8315/ws';

// Клиентские реквизиты (обычно соответствуют серийному номеру автомата).
export const TELEMETRY_CLIENT_ID =
  process.env.TELEMETRY_CLIENT_ID ?? 'snack_02';

export const TELEMETRY_CLIENT_SECRET =
  process.env.TELEMETRY_CLIENT_SECRET ?? 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';

// Путь к локальной SQLite-базе (goods.db) с данными автомата.
// Telemetry/new -> Telemetry/goods.db
export const DB_PATH =
  process.env.TELEMETRY_DB_PATH ??
  path.resolve(__dirname, '..', 'goods.db');

// Каталог с картинками товаров.
// По умолчанию — SnackMedia в корне репозитория:
// Telemetry/new -> <repo-root>/SnackMedia
export const PRODUCT_IMAGES_DIR =
  process.env.TELEMETRY_PRODUCT_IMAGES_DIR
    ? path.resolve(process.env.TELEMETRY_PRODUCT_IMAGES_DIR)
    : path.resolve(__dirname, '..', '..', 'SnackMedia');

