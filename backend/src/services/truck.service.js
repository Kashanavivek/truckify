'use strict';

const { db } = require('../db');
const { parseJSON, ACTIVE_BOOKING_STATUSES } = require('../utils/helpers');

const SORTS = {
  rating: 't.rating_avg DESC, t.rating_count DESC',
  newest: 'datetime(t.created_at) DESC',
  price_asc: 'starting_price ASC',
  price_desc: 'starting_price DESC',
  name: 't.name ASC',
};

/**
 * Search trucks by event date + area (+ cuisine / keyword / price), exactly as
 * described in the Truckify abstract. Returns card-ready rows including the
 * cheapest package price and per-date availability.
 */
function searchTrucks(filters = {}) {
  const {
    date = null,
    area = null,
    cuisine = null,
    q = null,
    priceRange = null,
    sort = 'rating',
    page = 1,
    limit = 12,
    includeInactive = false,
    ownerId = null,
  } = filters;

  const where = [];
  const params = {};

  if (ownerId) {
    where.push('t.owner_id = @ownerId');
    params.ownerId = ownerId;
  } else if (!includeInactive) {
    where.push("t.status = 'active'");
  }

  if (cuisine) { where.push('LOWER(t.cuisine) = LOWER(@cuisine)'); params.cuisine = cuisine; }
  if (priceRange) { where.push('t.price_range = @priceRange'); params.priceRange = priceRange; }

  if (q) {
    where.push(`(LOWER(t.name) LIKE @q OR LOWER(IFNULL(t.tagline,'')) LIKE @q
                 OR LOWER(IFNULL(t.description,'')) LIKE @q
                 OR LOWER(t.cuisine) LIKE @q
                 OR LOWER(IFNULL(t.base_city,'')) LIKE @q)`);
    params.q = `%${String(q).toLowerCase()}%`;
  }

  if (area) {
    where.push(`EXISTS (SELECT 1 FROM service_areas sa
                         WHERE sa.truck_id = t.id AND LOWER(sa.area_name) = LOWER(@area))`);
    params.area = area;
  }

  if (date) {
    // exclude trucks already holding a live booking on that date
    const ph = ACTIVE_BOOKING_STATUSES.map((s) => `'${s}'`).join(',');
    where.push(`NOT EXISTS (SELECT 1 FROM bookings b
                            WHERE b.truck_id = t.id AND b.event_date = @date
                              AND b.status IN (${ph}))`);
    params.date = date;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[sort] || SORTS.rating;
  const lim = Math.min(Math.max(Number(limit) || 12, 1), 60);
  const off = (Math.max(Number(page) || 1, 1) - 1) * lim;

  const base = `
    FROM trucks t
    JOIN users u ON u.id = t.owner_id
    LEFT JOIN (
      SELECT truck_id, MIN(price_per_event) AS starting_price
      FROM packages WHERE is_active = 1 GROUP BY truck_id
    ) p ON p.truck_id = t.id
    ${whereSql}`;

  const total = db.prepare(`SELECT COUNT(*) AS c ${base}`).get(params).c;

  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.tagline, t.cuisine, t.price_range, t.base_city,
              t.image_url, t.gallery, t.status, t.rating_avg, t.rating_count,
              t.created_at, p.starting_price, u.name AS owner_name
       ${base}
       ORDER BY ${orderSql}
       LIMIT @lim OFFSET @off`
    )
    .all({ ...params, lim, off });

  const areasStmt = db.prepare('SELECT area_name FROM service_areas WHERE truck_id = ?');
  const pkgCount = db.prepare('SELECT COUNT(*) AS c FROM packages WHERE truck_id = ? AND is_active = 1');

  const data = rows.map((r) => ({
    ...r,
    gallery: parseJSON(r.gallery, []),
    starting_price: r.starting_price ?? null,
    package_count: pkgCount.get(r.id).c,
    areas: areasStmt.all(r.id).map((a) => a.area_name),
  }));

  return {
    data,
    meta: { page: Math.max(Number(page) || 1, 1), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  };
}

/** Full truck profile: menu, packages, service areas, reviews, stats. */
function getTruckProfile(id, opts = {}) {
  const truck = db
    .prepare(
      `SELECT t.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM trucks t JOIN users u ON u.id = t.owner_id WHERE t.id = ?`
    )
    .get(id);
  if (!truck) return null;

  const menu = db
    .prepare('SELECT * FROM menu_items WHERE truck_id = ? ORDER BY category, name')
    .all(id);
  const packages = db
    .prepare('SELECT * FROM packages WHERE truck_id = ? ORDER BY price_per_event')
    .all(id)
    .map((p) => ({ ...p, includes: parseJSON(p.includes, []) }));
  const areas = db
    .prepare('SELECT id, area_name, radius_km FROM service_areas WHERE truck_id = ? ORDER BY area_name')
    .all(id);
  const reviews = db
    .prepare(
      `SELECT r.*, u.name AS customer_name FROM reviews r
        JOIN users u ON u.id = r.customer_id
       WHERE r.truck_id = ? ORDER BY datetime(r.created_at) DESC LIMIT 20`
    )
    .all(id);

  const stats = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM bookings WHERE truck_id = ? AND status = 'completed') AS events_completed,
         (SELECT COUNT(*) FROM reviews  WHERE truck_id = ?)                        AS review_count`
    )
    .get(id, id);

  const availability = db
    .prepare(
      `SELECT event_date, status FROM bookings
        WHERE truck_id = ? AND status IN ('pending','accepted','confirmed','en_route','arrived','completed')
          AND event_date >= date('now') ORDER BY event_date LIMIT 100`
    )
    .all(id);

  const bookedDates = availability.map((b) => b.event_date);
  const upcoming = opts.month
    ? availability.filter((b) => b.event_date.startsWith(opts.month))
    : availability;

  return {
    ...truck,
    gallery: parseJSON(truck.gallery, []),
    menu,
    packages,
    areas,
    reviews,
    review_count: stats.review_count,
    events_completed: stats.events_completed,
    booked_dates: bookedDates,
    upcoming_bookings: upcoming,
    starting_price: packages.length ? Math.min(...packages.map((p) => p.price_per_event)) : null,
  };
}

/** Recompute a truck's denormalised rating columns from the reviews table. */
function refreshRating(truckId) {
  const agg = db
    .prepare('SELECT COUNT(*) AS c, AVG(rating) AS avg FROM reviews WHERE truck_id = ?')
    .get(truckId);
  db.prepare('UPDATE trucks SET rating_avg = ?, rating_count = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(Math.round((agg.avg || 0) * 100) / 100, agg.c || 0, truckId);
}

function ownedTruckOr403(truckId, user) {
  const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
  if (!truck) return { truck: null, allowed: false };
  const allowed = user.role === 'admin' || truck.owner_id === user.id;
  return { truck, allowed };
}

module.exports = { searchTrucks, getTruckProfile, refreshRating, ownedTruckOr403, SORTS };
