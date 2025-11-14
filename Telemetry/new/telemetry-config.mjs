// telemetry-config.mjs
// Конфигурация сервиса телеметрии.
// Все значения можно переопределить через переменные окружения.
// Комментарии на русском, тексты ошибок/логов — на английском.

export const HTTP_PORT = Number(process.env.TELEMETRY_HTTP_PORT ?? 3000);

// URL для получения OAuth2 access_token
export const TELEMETRY_OAUTH_URL =
  process.env.TELEMETRY_OAUTH_URL
  ?? 'https://dev.ishaker.ru/auth/realms/telemetry/protocol/openid-connect/token';

// WebSocket URL сервера телеметрии
export const TELEMETRY_WS_URL =
  process.env.TELEMETRY_WS_URL
  ?? 'ws://185.46.8.39:8315/ws';

// Идентификатор автомата (serialNumber) и его секрет
export const TELEMETRY_CLIENT_ID =
  process.env.TELEMETRY_CLIENT_ID
  ?? 'snack_02';

export const TELEMETRY_CLIENT_SECRET =
  process.env.TELEMETRY_CLIENT_SECRET
  ?? 'GJTymndg8RCVZ7l52eMUjQUmmYgbeHE7';

// Путь к локальной базе данных товаров/матрицы
export const DB_PATH =
  process.env.TELEMETRY_DB_PATH
  ?? 'c:/Users/user/Desktop/Shaker-Snack-Demo/Telemetry/goods.db';
