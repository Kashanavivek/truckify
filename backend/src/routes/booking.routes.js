'use strict';

const express = require('express');

const { db, tx } = require('../db');
const { asyncHandler, ApiError, bookingCode, todayISO, parseJSON } = require('../utils/helpers');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createBookingSchema, reasonSchema, ownerStatusSchema, paySchema, reviewSchema,
} = require('../validators/schemas');
const svc = require('../services/booking.service');
const { refreshRating } = require('../services/truck.service');
const { push } = require('../services/notification.service');
const env = require('../config/env');

const router = express.Router();

/** Shape a booking row for the API (joins truck/package/customer names). */
function hydrate(row) {
  if (!row) return null;
  const truck = db.prepare('SELECT id, name, cuisine, image_url, base_city, owner_id FROM trucks WHERE id = ?').get(row.truck_id);
  const pkg = row.package_id
    ? db.prepare('SELECT id, name, price_per_event FROM packages WHERE id = ?').get(row.package_id)
    : null;
  const customer = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(row.customer_id);
  const review = db.prepare('SELECT id, rating, comment, created_at FROM reviews WHERE booking_id = ?').get(row.id) || null;
  return {
    ...row,
    truck,
    package: pkg,
    customer,
    review,
    status_label: svc.LABELS[row.status],
    timeline: svc.timeline(row.id),
  };
}

/** Load + authorise access to a single booking. */
function loadBooking(req, { allowCustomer = true, allowOwner = true, allowAdmin = true } = {}) {
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id));
  if (!row) throw ApiError.notFound('Booking not found.');
  const truck = db.prepare('SELECT owner_id FROM trucks WHERE id = ?').get(row.truck_id);
  const u = req.user;
  const ok =
    (allowAdmin && u.role === 'admin') ||
    (allowCustomer && u.role === 'customer' && row.customer_id === u.id) ||
    (allowOwner && u.role === 'owner' && truck && truck.owner_id === u.id);
  if (!ok) throw ApiError.forbidden('You do not have access to this booking.');
  return row;
}

/* ------------------------------------------------------------ create */

/**
 * POST /api/bookings
 * Customer sends a booking request. Double booking is prevented in the same
 * transaction that writes the row, plus by a DB-level partial unique index.
 */
router.post(
  '/',
  authenticate,
  requireRole('customer'),
  validate({ body: createBookingSchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;

    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(b.truck_id);
    if (!truck) throw ApiError.notFound('Truck not found.');
    if (truck.status !== 'active') throw ApiError.badRequest('This truck is not accepting bookings yet.');

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(b.package_id);
    if (!pkg || pkg.truck_id !== truck.id) throw ApiError.badRequest('Select a valid package for this truck.');
    if (!pkg.is_active) throw ApiError.badRequest('This package is no longer offered.');
    if (b.guests < pkg.min_guests) {
      throw ApiError.badRequest(`Package "${pkg.name}" requires at least ${pkg.min_guests} guests.`);
    }
    if (!svc.servesArea(truck.id, b.area_name)) {
      throw ApiError.badRequest(`"${truck.name}" does not currently serve ${b.area_name}. Try another area or truck.`);
    }

    svc.assertAvailable(truck.id, b.event_date);
    const amount = svc.priceForPackage(pkg, b.guests);

    const create = tx(() => {
      const info = db
        .prepare(
          `INSERT INTO bookings
             (code, customer_id, truck_id, package_id, event_date, event_type, area_name,
              venue_address, guests, notes, status, amount, payment_status)
           VALUES (?,?,?,?,?,?,?,?,?,?, 'pending', ?, 'unpaid')`
        )
        .run(
          bookingCode(), req.user.id, truck.id, pkg.id, b.event_date, b.event_type,
          b.area_name, b.venue_address || null, b.guests, b.notes || null, amount
        );
      return info.lastInsertRowid;
    });

    const id = create();
    const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

    push({
      userId: truck.owner_id,
      title: `New booking request - ${truck.name}`,
      body: `${req.user.name} requested ${b.event_type} on ${b.event_date} in ${b.area_name} (${b.guests} guests).`,
      type: 'booking_request',
      bookingId: id,
    });
    push({
      userId: req.user.id,
      title: 'Booking request sent',
      body: `Your request to ${truck.name} for ${b.event_date} was sent. Awaiting owner approval.`,
      type: 'booking_update',
      bookingId: id,
    });

    res.status(201).json({ success: true, data: hydrate(row), message: 'Booking request sent to the truck owner.' });
  })
);

/* -------------------------------------------------------------- list */

/** GET /api/bookings - role-aware list with filters. */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, payment_status, from, to, truck_id: truckId, q } = req.query;
    const where = [];
    const params = {};

    if (req.user.role === 'customer') { where.push('b.customer_id = @uid'); params.uid = req.user.id; }
    else if (req.user.role === 'owner') {
      where.push('t.owner_id = @uid'); params.uid = req.user.id;
    }
    if (status === 'upcoming') where.push("b.status IN ('pending','accepted','confirmed','en_route','arrived')");
    else if (status === 'active') where.push("b.status IN ('confirmed','en_route','arrived')");
    else if (status && status !== 'all') { where.push('b.status = @status'); params.status = status; }
    if (payment_status) { where.push('b.payment_status = @ps'); params.ps = payment_status; }
    if (from) { where.push('b.event_date >= @from'); params.from = from; }
    if (to) { where.push('b.event_date <= @to'); params.to = to; }
    if (truckId) { where.push('b.truck_id = @tid'); params.tid = Number(truckId); }
    if (q) {
      where.push('(b.code LIKE @q OR t.name LIKE @q OR u.name LIKE @q)');
      params.q = `%${q}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT b.* FROM bookings b
           JOIN trucks t ON t.id = b.truck_id
           JOIN users u  ON u.id = b.customer_id
           ${whereSql}
          ORDER BY
            CASE b.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 WHEN 'confirmed' THEN 2
                          WHEN 'en_route' THEN 3 WHEN 'arrived' THEN 4 ELSE 5 END,
            b.event_date DESC, datetime(b.created_at) DESC
          LIMIT 300`
      )
      .all(params);

    res.json({ success: true, data: rows.map(hydrate) });
  })
);

/** GET /api/bookings/summary - dashboard counters for the current role. */
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    let scope = '1=1';
    const params = {};
    if (req.user.role === 'customer') { scope = 'b.customer_id = @uid'; params.uid = req.user.id; }
    if (req.user.role === 'owner') { scope = 't.owner_id = @uid'; params.uid = req.user.id; }

    const row = db
      .prepare(
        `SELECT
           COUNT(*)                                                        AS total,
           SUM(CASE WHEN b.status = 'pending'  THEN 1 ELSE 0 END)          AS pending,
           SUM(CASE WHEN b.status = 'accepted' THEN 1 ELSE 0 END)          AS accepted,
           SUM(CASE WHEN b.status IN ('confirmed','en_route','arrived') THEN 1 ELSE 0 END) AS confirmed,
           SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END)         AS completed,
           SUM(CASE WHEN b.status IN ('declined','cancelled') THEN 1 ELSE 0 END) AS closed,
           IFNULL(SUM(CASE WHEN b.payment_status = 'paid' THEN b.amount ELSE 0 END), 0) AS revenue_paid,
           IFNULL(SUM(CASE WHEN b.status = 'completed' THEN b.amount ELSE 0 END), 0)    AS revenue_completed,
           IFNULL(SUM(CASE WHEN b.event_date >= date('now') AND b.status IN ('accepted','confirmed','en_route','arrived') THEN b.amount ELSE 0 END), 0) AS upcoming_value
         FROM bookings b JOIN trucks t ON t.id = b.truck_id
         WHERE ${scope}`
      )
      .get(params);

    const upcoming = db
      .prepare(
        `SELECT b.id, b.code, b.event_date, b.status, b.amount, b.payment_status,
                b.area_name, b.guests, b.event_type, t.name AS truck_name
           FROM bookings b JOIN trucks t ON t.id = b.truck_id
          WHERE ${scope} AND b.event_date >= date('now')
            AND b.status IN ('accepted','confirmed','en_route','arrived')
          ORDER BY b.event_date ASC LIMIT 8`
      )
      .all(params);

    res.json({ success: true, data: { counters: row, upcoming } });
  })
);

/** GET /api/bookings/calendar?month=YYYY-MM - owner event calendar. */
router.get(
  '/calendar',
  authenticate,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const month = req.query.month || todayISO().slice(0, 7);
    const params = { month };
    let scope = '1=1';
    if (req.user.role === 'owner') { scope = 't.owner_id = @uid'; params.uid = req.user.id; }
    const rows = db
      .prepare(
        `SELECT b.id, b.code, b.event_date, b.status, b.area_name, b.guests, b.amount,
                b.payment_status, b.event_type, t.name AS truck_name, u.name AS customer_name
           FROM bookings b JOIN trucks t ON t.id = b.truck_id JOIN users u ON u.id = b.customer_id
          WHERE ${scope} AND substr(b.event_date, 1, 7) = @month
          ORDER BY b.event_date`
      )
      .all(params);
    res.json({ success: true, data: { month, bookings: rows } });
  })
);

/* ------------------------------------------------------------ detail */

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const row = loadBooking(req);
    res.json({ success: true, data: hydrate(row) });
  })
);

/** GET /api/bookings/:id/receipt - simulated payment receipt / invoice. */
router.get(
  '/:id/receipt',
  authenticate,
  asyncHandler(async (req, res) => {
    const row = loadBooking(req);
    const h = hydrate(row);
    res.json({
      success: true,
      data: {
        receipt_no: `RCPT-${row.code}`,
        booking_code: row.code,
        issued_at: row.paid_at || row.created_at,
        customer: h.customer,
        vendor: h.truck,
        event: { type: row.event_type, date: row.event_date, area: row.area_name, guests: row.guests, venue: row.venue_address },
        package: h.package,
        amount: row.amount,
        currency: 'INR',
        payment_status: row.payment_status,
        payment_ref: row.payment_ref,
        mode: 'SIMULATED - no real financial transaction was performed',
      },
    });
  })
);

/* ------------------------------------------------- action endpoints */

/** POST /api/bookings/:id/accept - owner accepts a pending request. */
router.post(
  '/:id/accept',
  authenticate, requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req, { allowCustomer: false });
    svc.assertTransition(row.status, 'accepted', 'owner');
    svc.assertAvailable(row.truck_id, row.event_date, row.id); // re-check, it may have gone meanwhile

    db.prepare("UPDATE bookings SET status = 'accepted', accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(row.id);
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);

    push({
      userId: row.customer_id,
      title: 'Booking request accepted 🎉',
      body: `Proceed to payment to confirm your ${row.event_type} on ${row.event_date}.`,
      type: 'booking_update',
      bookingId: row.id,
    });
    res.json({ success: true, data: hydrate(updated), message: 'Booking accepted. Customer can now pay.' });
  })
);

/** POST /api/bookings/:id/decline */
router.post(
  '/:id/decline',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: reasonSchema }),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req, { allowCustomer: false });
    svc.assertTransition(row.status, 'declined', 'owner');
    db.prepare("UPDATE bookings SET status = 'declined', decline_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run(req.body.reason || null, row.id);
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
    push({
      userId: row.customer_id,
      title: 'Booking request declined',
      body: req.body.reason ? `Reason: ${req.body.reason}` : 'The truck owner declined this request. You can book another truck for the same date.',
      type: 'booking_update',
      bookingId: row.id,
    });
    res.json({ success: true, data: hydrate(updated), message: 'Request declined.' });
  })
);

/** POST /api/bookings/:id/cancel - customer or owner cancels. */
router.post(
  '/:id/cancel',
  authenticate,
  validate({ body: reasonSchema }),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req);
    svc.assertTransition(row.status, 'cancelled', 'customer');
    const refund = row.payment_status === 'paid';
    db.prepare(
      "UPDATE bookings SET status = 'cancelled', cancel_reason = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(req.body.reason || null, refund ? 'refunded' : row.payment_status, row.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
    const truck = db.prepare('SELECT owner_id, name FROM trucks WHERE id = ?').get(row.truck_id);
    const notifyUserId = req.user.id === row.customer_id ? truck.owner_id : row.customer_id;
    push({
      userId: notifyUserId,
      title: 'Booking cancelled',
      body: `${row.code} (${row.event_date}) was cancelled${refund ? ' and the simulated payment marked refunded' : ''}.`,
      type: 'booking_update',
      bookingId: row.id,
    });
    res.json({ success: true, data: hydrate(updated), message: refund ? 'Booking cancelled. Simulated payment marked as refunded.' : 'Booking cancelled.' });
  })
);

/**
 * POST /api/bookings/:id/pay
 * SIMULATED payment - validates the booking is accepted, then flips
 * payment_status to 'paid' and status to 'confirmed'. No money moves.
 */
router.post(
  '/:id/pay',
  authenticate, requireRole('customer'),
  validate({ body: paySchema }),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req, { allowOwner: false, allowAdmin: false });
    if (row.status !== 'accepted') {
      throw ApiError.badRequest(`Payment is only possible after the owner accepts the request (current status: ${svc.LABELS[row.status]}).`);
    }
    if (env.paymentMode !== 'simulated') throw ApiError.badRequest('Only simulated payments are enabled in this build.');

    const ref = `SIMPAY-${Date.now().toString(36).toUpperCase()}`;
    const pay = tx(() => {
      db.prepare(
        `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_ref = ?,
                             paid_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?`
      ).run(ref, row.id);
    });
    pay();

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
    const truck = db.prepare('SELECT owner_id, name FROM trucks WHERE id = ?').get(row.truck_id);

    push({ userId: row.customer_id, title: 'Payment successful ✅', body: `Booking ${row.code} is confirmed for ${row.event_date}.`, type: 'payment', bookingId: row.id });
    push({ userId: truck.owner_id, title: 'Booking confirmed & paid', body: `${row.code} for ${row.event_date} is confirmed. Add it to your calendar.`, type: 'payment', bookingId: row.id });

    res.json({
      success: true,
      data: hydrate(updated),
      message: 'Simulated payment successful - booking confirmed.',
      simulated: true,
    });
  })
);

/**
 * POST /api/bookings/:id/status
 * Owner event-day progression: confirmed -> en_route -> arrived -> completed.
 */
router.post(
  '/:id/status',
  authenticate, requireRole('owner', 'admin'),
  validate({ body: ownerStatusSchema }),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req, { allowCustomer: false });
    const next = req.body.status;
    svc.assertTransition(row.status, next, 'owner');

    const stamp = next === 'completed' ? ", completed_at = datetime('now')" : '';
    db.prepare(`UPDATE bookings SET status = ?, updated_at = datetime('now')${stamp} WHERE id = ?`).run(next, row.id);
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);

    const bodyMap = {
      en_route: 'Your food truck is on the way to the venue.',
      arrived: 'Your food truck has arrived at the venue.',
      completed: 'The event is marked complete. Please share a verified review!',
    };
    push({
      userId: row.customer_id,
      title: `Event status: ${svc.LABELS[next]}`,
      body: bodyMap[next],
      type: 'event_status',
      bookingId: row.id,
    });

    res.json({ success: true, data: hydrate(updated), message: `Status updated to ${svc.LABELS[next]}.` });
  })
);

/**
 * POST /api/bookings/:id/review
 * Verified review - only the customer, only after the event is completed,
 * only once per booking.
 */
router.post(
  '/:id/review',
  authenticate, requireRole('customer'),
  validate({ body: reviewSchema }),
  asyncHandler(async (req, res) => {
    const row = loadBooking(req, { allowOwner: false, allowAdmin: false });
    if (row.status !== 'completed') {
      throw ApiError.badRequest('Reviews can be submitted only after the event is marked completed.');
    }
    const already = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(row.id);
    if (already) throw ApiError.conflict('You have already reviewed this booking.');

    const { rating, comment } = req.body;
    const info = tx(() => {
      const r = db
        .prepare('INSERT INTO reviews (booking_id, truck_id, customer_id, rating, comment) VALUES (?,?,?,?,?)')
        .run(row.id, row.truck_id, row.customer_id, rating, comment || null);
      refreshRating(row.truck_id);
      return r;
    })();

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);
    const truck = db.prepare('SELECT owner_id, name FROM trucks WHERE id = ?').get(row.truck_id);
    push({
      userId: truck.owner_id,
      title: `New ${rating}★ review for ${truck.name}`,
      body: comment || 'A customer reviewed your completed event.',
      type: 'review',
      bookingId: row.id,
    });

    res.status(201).json({ success: true, data: review, message: 'Thanks! Your verified review is now live.' });
  })
);

module.exports = router;
