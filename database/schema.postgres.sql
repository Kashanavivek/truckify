-- =====================================================================
-- Truckify - PostgreSQL schema (production flavour)
-- Mirrors src/db/schema.sql exactly (types + partial unique index).
--   createdb truckify && psql truckify -f database/schema.postgres.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(180)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  role          VARCHAR(16)   NOT NULL CHECK (role IN ('customer','owner','admin')),
  phone         VARCHAR(30),
  status        VARCHAR(16)   NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trucks (
  id               SERIAL PRIMARY KEY,
  owner_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name             VARCHAR(160) NOT NULL,
  tagline          VARCHAR(200),
  description      TEXT,
  cuisine          VARCHAR(80)  NOT NULL,
  price_range      VARCHAR(4)   NOT NULL DEFAULT '$$' CHECK (price_range IN ('$','$$','$$$')),
  base_city        VARCHAR(120),
  image_url        TEXT,
  gallery          JSONB,
  status           VARCHAR(16)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','rejected','inactive')),
  rejection_reason TEXT,
  rating_avg       NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count     INTEGER      NOT NULL DEFAULT 0,
  approved_at      TIMESTAMPTZ,
  approved_by      INTEGER REFERENCES users (id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trucks_owner  ON trucks (owner_id);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks (status);

CREATE TABLE IF NOT EXISTS service_areas (
  id         SERIAL PRIMARY KEY,
  truck_id   INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  area_name  VARCHAR(120) NOT NULL,
  radius_km  INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (truck_id, area_name)
);
CREATE INDEX IF NOT EXISTS idx_areas_name ON service_areas (area_name);

CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  truck_id     INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  category     VARCHAR(60)  NOT NULL DEFAULT 'Main',
  price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  is_veg       BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_truck ON menu_items (truck_id);

CREATE TABLE IF NOT EXISTS packages (
  id              SERIAL PRIMARY KEY,
  truck_id        INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  includes        JSONB,
  price_per_event NUMERIC(10,2) NOT NULL CHECK (price_per_event >= 0),
  min_guests      INTEGER NOT NULL DEFAULT 20,
  max_guests      INTEGER NOT NULL DEFAULT 300,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_packages_truck ON packages (truck_id);

CREATE TABLE IF NOT EXISTS bookings (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(32) NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  truck_id       INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  package_id     INTEGER REFERENCES packages (id) ON DELETE SET NULL,
  event_date     DATE NOT NULL,
  event_type     VARCHAR(60) NOT NULL DEFAULT 'Private Party',
  area_name      VARCHAR(120) NOT NULL,
  venue_address  TEXT,
  guests         INTEGER NOT NULL CHECK (guests > 0),
  notes          TEXT,
  status         VARCHAR(16) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','cancelled',
                                     'confirmed','en_route','arrived','completed')),
  decline_reason TEXT,
  cancel_reason  TEXT,
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','paid','refunded')),
  payment_ref    VARCHAR(60),
  paid_at        TIMESTAMPTZ,
  accepted_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_truck    ON bookings (truck_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date     ON bookings (event_date);

-- Double-booking prevention: at most ONE live booking per truck per event date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
  ON bookings (truck_id, event_date)
  WHERE status IN ('pending','accepted','confirmed','en_route','arrived','completed');

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  truck_id    INTEGER NOT NULL REFERENCES trucks (id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_truck ON reviews (truck_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      VARCHAR(180) NOT NULL,
  body       TEXT,
  type       VARCHAR(24) NOT NULL DEFAULT 'info',
  booking_id INTEGER REFERENCES bookings (id) ON DELETE CASCADE,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  actor_id   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  INTEGER,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
