PRAGMA foreign_keys = ON;

-- =========================
-- 0) Служебная таблица синхронизации матрицы
-- =========================
CREATE TABLE IF NOT EXISTS matrix_sync_state (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_ts   INTEGER,
  source_hash    TEXT,
  matrix_version INTEGER
);
INSERT OR IGNORE INTO matrix_sync_state (id, last_sync_ts, source_hash, matrix_version)
VALUES (1, NULL, NULL, NULL);

-- =========================
-- 1) Конфигурация ячеек (планограмма)
-- =========================
CREATE TABLE IF NOT EXISTS matrix_cell_config (
  cell_number   INTEGER PRIMARY KEY,                                      -- cellNumber
  row_number    INTEGER,                                                  -- опц.: ряд
  size          INTEGER NOT NULL DEFAULT 0,                                -- 0=одинарн., 1=сдвоен., 2=тройн.
  good_id       INTEGER REFERENCES catalog_product(id)
                 ON UPDATE CASCADE ON DELETE SET NULL,                     -- привязка к каталогу
  price_minor   REAL,                                                   -- NULL => брать из catalog_product
  enabled       INTEGER NOT NULL DEFAULT 1,                                -- 0/1
  updated_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_matrix_cell_config_good ON matrix_cell_config(good_id);
CREATE INDEX IF NOT EXISTS idx_matrix_cell_config_row  ON matrix_cell_config(row_number);

CREATE TRIGGER IF NOT EXISTS trg_matrix_cell_config_updated_at_i
AFTER INSERT ON matrix_cell_config
BEGIN
  UPDATE matrix_cell_config
     SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
   WHERE cell_number = NEW.cell_number;
END;

CREATE TRIGGER IF NOT EXISTS trg_matrix_cell_config_updated_at_u
AFTER UPDATE ON matrix_cell_config
BEGIN
  UPDATE matrix_cell_config
     SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
   WHERE cell_number = NEW.cell_number;
END;

-- Авто-инициализация состояния при добавлении конфигурации
CREATE TRIGGER IF NOT EXISTS trg_matrix_cell_config_init_state
AFTER INSERT ON matrix_cell_config
WHEN NOT EXISTS (
  SELECT 1 FROM matrix_cell_state s WHERE s.cell_number = NEW.cell_number
)
BEGIN
  INSERT INTO matrix_cell_state (cell_number, volume, max_volume, last_refill_ts, updated_at)
  VALUES (NEW.cell_number, 0, 0, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000);
END;

-- =========================
-- 2) Текущее состояние/наполнение ячеек
-- =========================
CREATE TABLE IF NOT EXISTS matrix_cell_state (
  cell_number    INTEGER PRIMARY KEY
                 REFERENCES matrix_cell_config(cell_number)
                 ON UPDATE CASCADE ON DELETE CASCADE,  -- авто-удаление при удалении конфигурации
  volume         INTEGER NOT NULL DEFAULT 0,
  max_volume     INTEGER NOT NULL DEFAULT 0,
  last_refill_ts INTEGER,
  updated_at     INTEGER,
  CHECK (volume >= 0),
  CHECK (max_volume >= 0),
  CHECK (volume <= max_volume)
);

CREATE TRIGGER IF NOT EXISTS trg_matrix_cell_state_updated_at_i
AFTER INSERT ON matrix_cell_state
BEGIN
  UPDATE matrix_cell_state
     SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
   WHERE cell_number = NEW.cell_number;
END;

CREATE TRIGGER IF NOT EXISTS trg_matrix_cell_state_updated_at_u
AFTER UPDATE ON matrix_cell_state
BEGIN
  UPDATE matrix_cell_state
     SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
   WHERE cell_number = NEW.cell_number;
END;

-- =========================
-- 3) Журналы операций
-- =========================

-- 3.1 Журнал пополнений
CREATE TABLE IF NOT EXISTS matrix_refill_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,                   -- unix ms
  cell_number   INTEGER NOT NULL
                REFERENCES matrix_cell_config(cell_number)
                ON UPDATE CASCADE ON DELETE RESTRICT,
  qty           INTEGER NOT NULL CHECK (qty > 0),   -- сколько добавили
  actor         TEXT,                               -- кто/что пополнил (user/ws)
  note          TEXT
);

-- При вставке пополнения - увеличиваем volume, но не выше max_volume
CREATE TRIGGER IF NOT EXISTS trg_refill_apply
AFTER INSERT ON matrix_refill_log
BEGIN
  UPDATE matrix_cell_state
     SET volume = MIN(max_volume, volume + NEW.qty),
         last_refill_ts = NEW.ts,
         updated_at = NEW.ts
   WHERE cell_number = NEW.cell_number;
END;

-- 3.2 Журнал продаж (минимально)
CREATE TABLE IF NOT EXISTS matrix_sale_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,                    -- unix ms
  cell_number   INTEGER NOT NULL
                REFERENCES matrix_cell_config(cell_number)
                ON UPDATE CASCADE ON DELETE RESTRICT,
  qty           INTEGER NOT NULL CHECK (qty > 0),    -- обычно 1
  good_id       INTEGER,                             -- денорм: какой товар продавался (на момент продажи)
  price_minor   REAL,                             -- денорм: цена на момент продажи
  payment_ref   TEXT,                                -- опц.: ссылка на платёж/чек
  note          TEXT
);

-- При вставке продажи - уменьшаем volume, но не ниже 0
CREATE TRIGGER IF NOT EXISTS trg_sale_apply
AFTER INSERT ON matrix_sale_log
BEGIN
  UPDATE matrix_cell_state
     SET volume = MAX(0, volume - NEW.qty),
         updated_at = NEW.ts
   WHERE cell_number = NEW.cell_number;
END;

-- (Опционально) Защитный триггер: запретить проведение продажи, если volume < qty
-- Закомментировано по «минимальному» требованию; раскомментируйте при необходимости «жёсткой» инвариантности.
CREATE TRIGGER IF NOT EXISTS trg_sale_guard_volume
BEFORE INSERT ON matrix_sale_log
WHEN (SELECT volume FROM matrix_cell_state WHERE cell_number = NEW.cell_number) < NEW.qty
BEGIN
  SELECT RAISE(ABORT, 'Insufficient volume for sale');
END;

-- =========================
-- 4) Представления
-- =========================
CREATE VIEW IF NOT EXISTS vw_matrix_cell_price AS
SELECT
  c.cell_number,
  COALESCE(c.price_minor, p.price_minor) AS effective_price_minor
FROM matrix_cell_config c
LEFT JOIN catalog_product p ON p.id = c.good_id;

CREATE VIEW IF NOT EXISTS vw_matrix_cell_full AS
SELECT
  c.cell_number,
  c.row_number,
  c.size,
  c.good_id,
  p.taste       AS product_name,
  p.img_url     AS product_img,
  p.is_adult    AS product_is_adult,
  COALESCE(c.price_minor, p.price_minor) AS price_minor,
  s.volume,
  s.max_volume,
  c.enabled,
  c.updated_at  AS cfg_updated_at,
  s.updated_at  AS state_updated_at
FROM matrix_cell_config c
LEFT JOIN matrix_cell_state s ON s.cell_number = c.cell_number
LEFT JOIN catalog_product p   ON p.id = c.good_id;

-- =========================
-- 5) Инициализация (пример)
-- =========================
-- WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x < 40)
-- INSERT INTO matrix_cell_config(cell_number, row_number, size, good_id, price_minor, enabled)
-- SELECT x, ((x-1)/10)+1, 0, NULL, NULL, 1 FROM seq;
-- (Состояния создадутся автоматически триггером trg_matrix_cell_config_init_state)
