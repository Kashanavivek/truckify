'use strict';

const express = require('express');

const { db } = require('../db');
const { asyncHandler, ApiError, parseJSON } = require('../utils/helpers');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createTruckSchema, updateTruckSchema, menuItemSchema, packageSchema,
  packageUpdateSchema, serviceAreaSchema,
} = require('../validators/schemas');
const { searchTrucks, getTruckProfile, ownedTruckOr403 } = require('../services/truck.service');
const { push } = require('../services/notification.service');

const router = express.Router();

/* ------------------------------------------------------------------ public */

/**
 * GET /api/trucks
 * Public marketplace search - filter by event date, service area, cuisine,
 * keyword, price band; sortable and paginated.
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = req.query;
    const mine = q.mine === '1' && req.user;
    const result = searchTrucks({
      date: q.date || null,
      area: q.area || null,
      cuisine: q.cuisine || null,
      q: q.q || null,
      priceRange: q.price_range || null,
      sort: q.sort || 'rating',
      page: q.page || 1,
      limit: q.limit || 12,
      ownerId: mine ? req.user.id : null,
      includeInactive: q.include_inactive === '1' && req.user && ['owner', 'admin'].includes(req.user.role),
    });
    res.json({ success: true, ...result });
  })
);

/** GET /api/trucks/:id - full public profile (menu, packages, areas, reviews). */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const truck = getTruckProfile(Number(req.params.id), { month: req.query.month });
    if (!truck) throw ApiError.notFound('Truck not found.');
    const isOwnerOrAdmin =
      req.user && (req.user.role === 'admin' || req.user.id === truck.owner_id);
    if (truck.status !== 'active' && !isOwnerOrAdmin) {
      throw ApiError.notFound('This truck is not available on the marketplace yet.');
    }
    res.json({ success: true, data: truck });
  })
);

/** GET /api/trucks/:id/availability?month=YYYY-MM - calendar of booked dates. */
router.get(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    const truckId = Number(req.params.id);
    const month = req.query.month; // optional YYYY-MM
    const rows = db
      .prepare(
        `SELECT event_date, status FROM bookings
          WHERE truck_id = @truckId AND status IN ('pending','accepted','confirmed','en_route','arrived','completed')
            AND event_date >= date('now')
            AND (@month IS NULL OR substr(event_date, 1, 7) = @month)
          ORDER BY event_date`
      )
      .all({ truckId, month: month || null });
    res.json({
      success: true,
      data: { truck_id: truckId, booked_dates: rows.map((r) => r.event_date), detail: rows },
    });
  })
);

/** GET /api/trucks/:id/reviews - verified reviews (only after a completed event). */
router.get(
  '/:id/reviews',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name,
                b.event_type, b.event_date
           FROM reviews r
           JOIN users u   ON u.id = r.customer_id
           JOIN bookings b ON b.id = r.booking_id
          WHERE r.truck_id = ? ORDER BY datetime(r.created_at) DESC`
      )
      .all(Number(req.params.id));
    res.json({ success: true, data: rows });
  })
);

/* -------------------------------------------------------- owner: trucks */

/** GET /api/trucks/owner/mine - owner console list. */
router.get(
  '/owner/mine',
  authenticate,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT t.*,
                (SELECT COUNT(*) FROM menu_items m WHERE m.truck_id = t.id)      AS menu_count,
                (SELECT COUNT(*) FROM packages p WHERE p.truck_id = t.id)        AS package_count,
                (SELECT COUNT(*) FROM service_areas a WHERE a.truck_id = t.id)   AS area_count,
                (SELECT COUNT(*) FROM bookings b WHERE b.truck_id = t.id)        AS booking_count
           FROM trucks t WHERE t.owner_id = ? ORDER BY datetime(t.created_at) DESC`
      )
      .all(req.user.id);
    res.json({ success: true, data: rows.map((r) => ({ ...r, gallery: parseJSON(r.gallery, []) })) });
  })
);

/** POST /api/trucks - register a truck; goes live only after admin approval. */
router.post(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  validate({ body: createTruckSchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const info = db
      .prepare(
        `INSERT INTO trucks
           (owner_id, name, tagline, description, cuisine, price_range, base_city, image_url, gallery, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        req.user.id, b.name, b.tagline || null, b.description || null, b.cuisine,
        b.price_range || '$$', b.base_city || null, b.image_url || null,
        JSON.stringify(b.gallery || [])
      );

    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(info.lastInsertRowid);

    // notify every admin that a listing is waiting for verification
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const a of admins) {
      push({
        userId: a.id,
        title: 'New truck awaiting approval',
        body: `"${truck.name}" was submitted by ${req.user.name}.`,
        type: 'approval',
      });
    }

    res.status(201).json({ success: true, data: { ...truck, gallery: b.gallery || [] } });
  })
);

/** PUT /api/trucks/:id - owner edits their own truck (re-submits for approval). */
router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  validate({ body: updateTruckSchema }),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('You can only edit your own trucks.');

    const b = req.body;
    const fields = [];
    const params = [];
    for (const key of ['name', 'tagline', 'description', 'cuisine', 'price_range', 'base_city', 'image_url']) {
      if (b[key] !== undefined) { fields.push(`${key} = ?`); params.push(b[key]); }
    }
    if (b.gallery !== undefined) { fields.push('gallery = ?'); params.push(JSON.stringify(b.gallery)); }
    if (!fields.length) throw ApiError.badRequest('Nothing to update.');

    // an already-active truck that changes core details returns to review
    const reReview = truck.status === 'active' && !['admin'].includes(req.user.role);
    if (reReview) fields.push("status = 'pending'", "rejection_reason = NULL");

    params.push(truck.id);
    db.prepare(`UPDATE trucks SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck.id);
    res.json({
      success: true,
      data: { ...updated, gallery: parseJSON(updated.gallery, []) },
      message: reReview ? 'Truck updated and re-submitted for admin approval.' : 'Truck updated.',
    });
  })
);

/** POST /api/trucks/:id/submit - (re)submit for verification. */
router.post(
  '/:id/submit',
  authenticate,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('You can only submit your own trucks.');

    const counts = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM menu_items WHERE truck_id = @id)     AS menu,
                (SELECT COUNT(*) FROM packages   WHERE truck_id = @id)     AS pkgs,
                (SELECT COUNT(*) FROM service_areas WHERE truck_id = @id)  AS areas`
      )
      .get({ id: truck.id });

    if (!counts.pkgs) throw ApiError.badRequest('Add at least one package before submitting for approval.');
    if (!counts.areas) throw ApiError.badRequest('Add at least one service area before submitting for approval.');

    db.prepare("UPDATE trucks SET status = 'pending', rejection_reason = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(truck.id);

    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const a of admins) {
      push({ userId: a.id, title: 'Truck submitted for approval', body: `"${truck.name}" is awaiting verification.`, type: 'approval' });
    }
    res.json({ success: true, message: 'Submitted for admin approval.', data: { ...counts, status: 'pending' } });
  })
);

/** DELETE /api/trucks/:id */
router.delete(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('You can only delete your own trucks.');
    const live = db
      .prepare("SELECT COUNT(*) AS c FROM bookings WHERE truck_id = ? AND status IN ('pending','accepted','confirmed','en_route','arrived')")
      .get(truck.id).c;
    if (live) throw ApiError.conflict('This truck has active bookings and cannot be deleted.');
    db.prepare('DELETE FROM trucks WHERE id = ?').run(truck.id);
    res.json({ success: true, message: 'Truck deleted.' });
  })
);

/* ------------------------------------------- owner sub-resources: menu */

router.post(
  '/:id/menu',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: menuItemSchema }),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('Not your truck.');
    const b = req.body;
    const info = db
      .prepare('INSERT INTO menu_items (truck_id, name, description, category, price, is_veg, is_available) VALUES (?,?,?,?,?,?,?)')
      .run(truck.id, b.name, b.description || null, b.category, b.price, b.is_veg ? 1 : 0, b.is_available ? 1 : 0);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid) });
  })
);

router.put(
  '/menu/:itemId',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: menuItemSchema.partial() }),
  asyncHandler(async (req, res) => {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(req.params.itemId));
    if (!item) throw ApiError.notFound('Menu item not found.');
    const { truck, allowed } = ownedTruckOr403(item.truck_id, req.user);
    if (!truck || !allowed) throw ApiError.forbidden('Not your menu item.');
    const b = req.body;
    const sets = []; const params = [];
    for (const k of ['name', 'description', 'category', 'price']) if (b[k] !== undefined) { sets.push(`${k} = ?`); params.push(b[k]); }
    if (b.is_veg !== undefined) { sets.push('is_veg = ?'); params.push(b.is_veg ? 1 : 0); }
    if (b.is_available !== undefined) { sets.push('is_available = ?'); params.push(b.is_available ? 1 : 0); }
    if (!sets.length) throw ApiError.badRequest('Nothing to update.');
    params.push(item.id);
    db.prepare(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true, data: db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id) });
  })
);

router.delete(
  '/menu/:itemId',
  authenticate, requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(req.params.itemId));
    if (!item) throw ApiError.notFound('Menu item not found.');
    const { allowed } = ownedTruckOr403(item.truck_id, req.user);
    if (!allowed) throw ApiError.forbidden('Not your menu item.');
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id);
    res.json({ success: true, message: 'Menu item removed.' });
  })
);

/* --------------------------------------- owner sub-resources: packages */

router.post(
  '/:id/packages',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: packageSchema }),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('Not your truck.');
    const b = req.body;
    const info = db
      .prepare(`INSERT INTO packages (truck_id, name, description, includes, price_per_event, min_guests, max_guests, is_active)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run(truck.id, b.name, b.description || null, JSON.stringify(b.includes || []),
           b.price_per_event, b.min_guests, b.max_guests, b.is_active ? 1 : 0);
    const row = db.prepare('SELECT * FROM packages WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: { ...row, includes: parseJSON(row.includes, []) } });
  })
);

router.put(
  '/packages/:pkgId',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: packageUpdateSchema }),
  asyncHandler(async (req, res) => {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(req.params.pkgId));
    if (!pkg) throw ApiError.notFound('Package not found.');
    const { allowed } = ownedTruckOr403(pkg.truck_id, req.user);
    if (!allowed) throw ApiError.forbidden('Not your package.');
    const b = req.body;
    const sets = []; const params = [];
    for (const k of ['name', 'description', 'price_per_event', 'min_guests', 'max_guests']) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); params.push(b[k]); }
    }
    if (b.includes !== undefined) { sets.push('includes = ?'); params.push(JSON.stringify(b.includes)); }
    if (b.is_active !== undefined) { sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0); }
    if (!sets.length) throw ApiError.badRequest('Nothing to update.');
    params.push(pkg.id);
    db.prepare(`UPDATE packages SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM packages WHERE id = ?').get(pkg.id);
    res.json({ success: true, data: { ...row, includes: parseJSON(row.includes, []) } });
  })
);

router.delete(
  '/packages/:pkgId',
  authenticate, requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(req.params.pkgId));
    if (!pkg) throw ApiError.notFound('Package not found.');
    const { allowed } = ownedTruckOr403(pkg.truck_id, req.user);
    if (!allowed) throw ApiError.forbidden('Not your package.');
    const used = db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE package_id = ?').get(pkg.id).c;
    if (used) {
      db.prepare('UPDATE packages SET is_active = 0 WHERE id = ?').run(pkg.id);
      return res.json({ success: true, message: 'Package is used by past bookings - archived instead of deleted.' });
    }
    db.prepare('DELETE FROM packages WHERE id = ?').run(pkg.id);
    return res.json({ success: true, message: 'Package removed.' });
  })
);

/* ------------------------------------ owner sub-resources: service areas */

router.post(
  '/:id/areas',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: serviceAreaSchema }),
  asyncHandler(async (req, res) => {
    const { truck, allowed } = ownedTruckOr403(Number(req.params.id), req.user);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (!allowed) throw ApiError.forbidden('Not your truck.');
    try {
      const info = db
        .prepare('INSERT INTO service_areas (truck_id, area_name, radius_km) VALUES (?,?,?)')
        .run(truck.id, req.body.area_name, req.body.radius_km || null);
      res.status(201).json({ success: true, data: db.prepare('SELECT * FROM service_areas WHERE id = ?').get(info.lastInsertRowid) });
    } catch (e) {
      throw ApiError.conflict(`"${req.body.area_name}" is already a service area for this truck.`);
    }
  })
);

router.delete(
  '/areas/:areaId',
  authenticate, requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const area = db.prepare('SELECT * FROM service_areas WHERE id = ?').get(Number(req.params.areaId));
    if (!area) throw ApiError.notFound('Service area not found.');
    const { allowed } = ownedTruckOr403(area.truck_id, req.user);
    if (!allowed) throw ApiError.forbidden('Not your service area.');
    db.prepare('DELETE FROM service_areas WHERE id = ?').run(area.id);
    res.json({ success: true, message: 'Service area removed.' });
  })
);

module.exports = router;
