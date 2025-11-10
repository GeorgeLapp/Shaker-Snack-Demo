-- =========================
-- 1) Служебная таблица синхронизации
-- =========================
CREATE TABLE IF NOT EXISTS catalog_sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_ts  INTEGER,         -- unix epoch ms последней успешной загрузки
  source_hash   TEXT             -- опционально: хэш/etag последнего каталога
);

INSERT OR IGNORE INTO catalog_sync_state (id, last_sync_ts, source_hash) VALUES (1, NULL, NULL);

-- =========================
-- 2) Бренды
-- =========================
CREATE TABLE IF NOT EXISTS catalog_brand (
  id    INTEGER PRIMARY KEY,     -- goodBrand.id с сервера
  name  TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_catalog_brand_name ON catalog_brand(name);

-- =========================
-- 3) Товары каталога
-- =========================
CREATE TABLE IF NOT EXISTS catalog_product (
  id             INTEGER PRIMARY KEY,          -- товар.id с сервера
  brand_id       INTEGER REFERENCES catalog_brand(id) ON UPDATE CASCADE ON DELETE SET NULL,
  taste          TEXT NOT NULL,                -- «вкус»/краткое имя для отображения
  img_url        TEXT,                         -- imgPath
  is_adult       INTEGER NOT NULL DEFAULT 0,   -- 0/1
  price_minor    REAL,                      -- цена в минимальных единицах (копейки/цента); может быть NULL, если цена берётся из матрицы
  vendor_code    TEXT,                         -- артикул, бывает пустым
  -- КБЖУ (опционально, если сервер прислал)
  calories       REAL,
  proteins       REAL,
  fats           REAL,
  carbohydrates  REAL,
  -- Информ. поля (опционально)
  compound       TEXT,                         -- состав
  allergens      TEXT,
  description    TEXT,
  -- Тех. признак обновления записи
  updated_at     INTEGER                        -- unix epoch ms
);

-- Поисковые индексы
CREATE INDEX IF NOT EXISTS idx_catalog_product_brand ON catalog_product(brand_id);
CREATE INDEX IF NOT EXISTS idx_catalog_product_taste ON catalog_product(taste);

-- Автообновление updated_at
CREATE TRIGGER IF NOT EXISTS trg_catalog_product_updated_at
AFTER INSERT ON catalog_product
BEGIN
  UPDATE catalog_product SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_catalog_product_updated_at_u
AFTER UPDATE ON catalog_product
BEGIN
  UPDATE catalog_product SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE id = NEW.id;
END;

-- =========================
-- 4) Представление «товар с брендом» (удобно для UI)
-- =========================
CREATE VIEW IF NOT EXISTS vw_catalog_product_full AS
SELECT
  p.id,
  p.taste,
  p.img_url,
  p.is_adult,
  p.price_minor,
  p.vendor_code,
  p.calories, p.proteins, p.fats, p.carbohydrates,
  p.compound, p.allergens, p.description,
  b.id  AS brand_id,
  b.name AS brand_name,
  p.updated_at
FROM catalog_product p
LEFT JOIN catalog_brand b ON b.id = p.brand_id;
