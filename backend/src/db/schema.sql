-- =====================================================================
-- Truckify - relational schema (SQLite dialect; PostgreSQL version is in
-- /database/schema.postgres.sql with identical table/column semantics)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('customer', 'owner', 'admin')),
  phone         TEXT,
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------- trucks
CREATE TABLE IF NOT EXISTS trucks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  tagline          TEXT,
  description      TEXT,
  cuisine          TEXT    NOT NULL,
  price_range      TEXT    NOT NULL DEFAULT '$$'
                     CHECK (price_range IN ('$', '$$', '$$$')),
  base_city        TEXT,
  image_url        TEXT,
  gallery          TEXT,                       -- JSON array of image URLs
  status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'rejected', 'inactive')),
  rejection_reason TEXT,
  rating_avg       REAL    NOT NULL DEFAULT 0,
  rating_count     INTEGER NOT NULL DEFAULT 0,
  approved_at      TEXT,
  approved_by      INTEGER REFERENCES users (id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trucks_owner  ON trucks (owner_id);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks (status);

-- -------------------------------------------------------- service_areas
CREATE TABLE IF NOT EXISTS service_areas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  truck_id   INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  area_name  TEXT    NOT NULL,
  radius_km  INTEGER,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (truck_id, area_name)
);
CREATE INDEX IF NOT EXISTS idx_areas_name ON service_areas (area_name);

-- ----------------------------------------------------------- menu_items
CREATE TABLE IF NOT EXISTS menu_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  truck_id    INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  category    TEXT    NOT NULL DEFAULT 'Main',
  price       REAL    NOT NULL CHECK (price >= 0),
  is_veg      INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_menu_truck ON menu_items (truck_id);

-- ------------------------------------------------------------- packages
CREATE TABLE IF NOT EXISTS packages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  truck_id        INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  description     TEXT,
  includes        TEXT,                     -- JSON array of bullet strings
  price_per_event REAL    NOT NULL CHECK (price_per_event >= 0),
  min_guests      INTEGER NOT NULL DEFAULT 20,
  max_guests      INTEGER NOT NULL DEFAULT 300,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_packages_truck ON packages (truck_id);

-- ------------------------------------------------------------- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  truck_id       INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  package_id     INTEGER REFERENCES packages (id) ON DELETE SET NULL,
  event_date     TEXT    NOT NULL,            -- YYYY-MM-DD
  event_type     TEXT    NOT NULL DEFAULT 'Private Party',
  area_name      TEXT    NOT NULL,
  venue_address  TEXT,
  guests         INTEGER NOT NULL CHECK (guests > 0),
  notes          TEXT,
  status         TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled',
                                     'confirmed', 'en_route', 'arrived', 'completed')),
  decline_reason TEXT,
  cancel_reason  TEXT,
  amount         REAL    NOT NULL DEFAULT 0,
  payment_status TEXT    NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_ref    TEXT,
  paid_at        TEXT,
  accepted_at    TEXT,
  completed_at   TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_truck    ON bookings (truck_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date     ON bookings (event_date);

-- ---------------------------------------------------------------------
-- Double-booking prevention enforced at the DATABASE level:
-- one truck can hold at most one *live* booking per event date.
-- Cancelled / declined requests release the date automatically.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
  ON bookings (truck_id, event_date)
  WHERE status IN ('pending', 'accepted', 'confirmed', 'en_route', 'arrived', 'completed');

-- -------------------------------------------------------------- reviews
CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  truck_id    INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_truck ON reviews (truck_id);

-- -------------------------------------------------------- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  body       TEXT,
  type       TEXT    NOT NULL DEFAULT 'info',
  booking_id INTEGER REFERENCES bookings (id) ON DELETE CASCADE,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

-- ------------------------------------------------------- audit (admin) log
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  meta       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
