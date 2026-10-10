'use strict';

const express = require('express');

const { db } = require('../db');
const { asyncHandler, ApiError, round2 } = require('../utils/helpers');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { rejectSchema, truckStatusSchema, userStatusSchema } = require('../validators/schemas');
const { push } = require('../services/notification.service');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

function audit(actorId, action, entity, entityId, meta) {
  db.prepare('INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta) VALUES (?,?,?,?,?)')
    .run(actorId, action, entity, entityId || null, meta ? JSON.stringify(meta) : null);
}

/* ------------------------------------------------------------- analytics */

/** GET /api/admin/stats - platform statistics for the admin dashboard. */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM users  WHERE role = 'customer')                     AS customers,
           (SELECT COUNT(*) FROM users  WHERE role = 'owner')                        AS owners,
           (SELECT COUNT(*) FROM trucks)                                            AS trucks_total,
           (SELECT COUNT(*) FROM trucks WHERE status = 'pending')                    AS trucks_pending,
           (SELECT COUNT(*) FROM trucks WHERE status = 'active')                     AS trucks_active,
           (SELECT COUNT(*) FROM trucks WHERE status = 'rejected')                   AS trucks_rejected,
           (SELECT COUNT(*) FROM bookings)                                          AS bookings_total,
           (SELECT COUNT(*) FROM bookings WHERE status = 'pending')                  AS bookings_pending,
           (SELECT COUNT(*) FROM bookings WHERE status = 'completed')                AS bookings_completed,
           (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled')                AS bookings_cancelled,
           (SELECT COUNT(*) FROM reviews)                                            AS reviews_total,
           (SELECT IFNULL(AVG(rating), 0) FROM reviews)                              AS avg_rating,
           (SELECT IFNULL(SUM(amount), 0) FROM bookings WHERE payment_status = 'paid') AS gmv_paid,
           (SELECT IFNULL(SUM(amount), 0) FROM bookings WHERE status = 'completed')    AS gmv_completed`
      )
      .get();

    const topTrucks = db
      .prepare(
        `SELECT t.id, t.name, t.cuisine, t.rating_avg, t.rating_count,
                COUNT(b.id) AS bookings,
                IFNULL(SUM(CASE WHEN b.status = 'completed' THEN b.amount ELSE 0 END), 0) AS revenue
           FROM trucks t LEFT JOIN bookings b ON b.truck_id = t.id
          GROUP BY t.id ORDER BY bookings DESC, t.rating_avg DESC LIMIT 6`
      )
      .all();

    const byCuisine = db
      .prepare(
        `SELECT cuisine, COUNT(*) AS trucks,
                IFNULL(AVG(rating_avg), 0) AS avg_rating
           FROM trucks WHERE status = 'active' GROUP BY cuisine ORDER BY trucks DESC LIMIT 8`
      )
      .all();

    const monthly = db
      .prepare(
        `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS bookings,
                IFNULL(SUM(amount), 0) AS value
           FROM bookings GROUP BY month ORDER BY month DESC LIMIT 6`
      )
      .all()
      .reverse();

    const recent = db
      .prepare(
        `SELECT b.id, b.code, b.event_date, b.status, b.amount, b.payment_status,
                t.name AS truck_name, u.name AS customer_name
           FROM bookings b JOIN trucks t ON t.id = b.truck_id JOIN users u ON u.id = b.customer_id
          ORDER BY datetime(b.created_at) DESC LIMIT 8`
      )
      .all();

    res.json({
      success: true,
      data: {
        counts: { ...counts, avg_rating: round2(counts.avg_rating) },
        top_trucks: topTrucks,
        by_cuisine: byCuisine,
        monthly,
        recent_bookings: recent,
      },
    });
  })
);

/* ----------------------------------------------------------- moderation */

/** GET /api/admin/trucks?status=pending - listing verification queue. */
router.get(
  '/trucks',
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const rows = db
      .prepare(
        `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*) FROM menu_items WHERE truck_id = t.id)    AS menu_count,
                (SELECT COUNT(*) FROM packages   WHERE truck_id = t.id)    AS package_count,
                (SELECT COUNT(*) FROM service_areas WHERE truck_id = t.id) AS area_count
           FROM trucks t JOIN users u ON u.id = t.owner_id
          WHERE (@status IS NULL OR t.status = @status)
          ORDER BY CASE t.status WHEN 'pending' THEN 0 ELSE 1 END, datetime(t.created_at) DESC`
      )
      .all({ status: status || null });
    res.json({ success: true, data: rows });
  })
);

/** POST /api/admin/trucks/:id/approve - truck becomes active. */
router.post(
  '/trucks/:id/approve',
  asyncHandler(async (req, res) => {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(Number(req.params.id));
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (truck.status === 'active') throw ApiError.badRequest('Truck is already active.');

    db.prepare(
      `UPDATE trucks SET status = 'active', rejection_reason = NULL,
              approved_at = datetime('now'), approved_by = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.id, truck.id);

    push({
      userId: truck.owner_id,
      title: 'Your truck is approved and live ✅',
      body: `"${truck.name}" is now visible to customers on Truckify.`,
      type: 'approval',
    });
    audit(req.user.id, 'approve_truck', 'trucks', truck.id, { name: truck.name });

    res.json({ success: true, data: db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck.id), message: 'Truck approved and activated.' });
  })
);

/** POST /api/admin/trucks/:id/reject */
router.post(
  '/trucks/:id/reject',
  validate({ body: rejectSchema }),
  asyncHandler(async (req, res) => {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(Number(req.params.id));
    if (!truck) throw ApiError.notFound('Truck not found.');

    db.prepare(
      "UPDATE trucks SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(req.body.reason, truck.id);

    push({
      userId: truck.owner_id,
      title: 'Truck listing rejected',
      body: `"${truck.name}": ${req.body.reason}. Update the listing and re-submit for approval.`,
      type: 'approval',
    });
    audit(req.user.id, 'reject_truck', 'trucks', truck.id, { reason: req.body.reason });

    res.json({ success: true, data: db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck.id), message: 'Truck rejected.' });
  })
);

/** PATCH /api/admin/trucks/:id/status - force any status (e.g. suspend). */
router.patch(
  '/trucks/:id/status',
  validate({ body: truckStatusSchema }),
  asyncHandler(async (req, res) => {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(Number(req.params.id));
    if (!truck) throw ApiError.notFound('Truck not found.');
    db.prepare("UPDATE trucks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, truck.id);
    push({
      userId: truck.owner_id,
      title: `Truck status changed to ${req.body.status}`,
      body: `"${truck.name}" was updated by an administrator.`,
      type: 'approval',
    });
    audit(req.user.id, 'set_truck_status', 'trucks', truck.id, { status: req.body.status });
    res.json({ success: true, data: db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck.id) });
  })
);

/* ------------------------------------------------------------- bookings */

/** GET /api/admin/bookings - monitor every booking on the platform. */
router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { status, q } = req.query;
    const rows = db
      .prepare(
        `SELECT b.*, t.name AS truck_name, t.cuisine, u.name AS customer_name, u.email AS customer_email
           FROM bookings b JOIN trucks t ON t.id = b.truck_id JOIN users u ON u.id = b.customer_id
          WHERE (@status IS NULL OR b.status = @status)
            AND (@q IS NULL OR b.code LIKE @q OR t.name LIKE @q OR u.name LIKE @q)
          ORDER BY datetime(b.created_at) DESC LIMIT 300`
      )
      .all({ status: status || null, q: q ? `%${q}%` : null });
    res.json({ success: true, data: rows });
  })
);

/* ---------------------------------------------------------------- users */

/** GET /api/admin/users */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT id, name, email, role, phone, status, created_at,
                (SELECT COUNT(*) FROM bookings WHERE customer_id = users.id) AS bookings
           FROM users WHERE (@role IS NULL OR role = @role)
          ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END, datetime(created_at) DESC`
      )
      .all({ role: req.query.role || null });
    res.json({ success: true, data: rows });
  })
);

/** PATCH /api/admin/users/:id/status - block / unblock an account. */
router.patch(
  '/users/:id/status',
  validate({ body: userStatusSchema }),
  asyncHandler(async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!user) throw ApiError.notFound('User not found.');
    if (user.role === 'admin') throw ApiError.forbidden('Admin accounts cannot be blocked here.');

    db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, user.id);
    audit(req.user.id, 'set_user_status', 'users', user.id, { status: req.body.status });
    res.json({ success: true, message: `User ${req.body.status === 'blocked' ? 'blocked' : 'reactivated'}.` });
  })
);

/** GET /api/admin/audit-logs */
router.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT a.*, u.name AS actor_name FROM audit_logs a
           LEFT JOIN users u ON u.id = a.actor_id
          ORDER BY datetime(a.created_at) DESC LIMIT 100`
      )
      .all();
    res.json({ success: true, data: rows });
  })
);

module.exports = router;
