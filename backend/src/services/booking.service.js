'use strict';

const { db } = require('../db');
const { ApiError, todayISO, ACTIVE_BOOKING_STATUSES } = require('../utils/helpers');

/**
 * Booking Module business rules: availability, pricing, and the
 * strict state machine that prevents illegal status transitions.
 */

// ---------------------------------------------------- status state machine
const TRANSITIONS = {
  //        from            -> allowed next states
  pending: ['accepted', 'declined', 'cancelled'],
  accepted: ['confirmed', 'cancelled', 'declined'],
  confirmed: ['en_route', 'cancelled'],
  en_route: ['arrived'],
  arrived: ['completed'],
  completed: [],
  declined: [],
  cancelled: [],
};

const OWNER_TRANSITIONS = {
  pending: ['accepted', 'declined'],
  accepted: [],
  confirmed: ['en_route'],
  en_route: ['arrived'],
  arrived: ['completed'],
};

const LABELS = {
  pending: 'Request sent',
  accepted: 'Accepted by owner',
  confirmed: 'Confirmed - paid',
  en_route: 'Truck en route',
  arrived: 'Truck arrived',
  completed: 'Event completed',
  declined: 'Declined by owner',
  cancelled: 'Cancelled',
};

function assertTransition(from, to, actorRole) {
  const table = actorRole === 'owner' ? OWNER_TRANSITIONS : TRANSITIONS;
  const allowed = table[from] || [];
  if (!allowed.includes(to)) {
    throw ApiError.badRequest(
      `Invalid status change: ${LABELS[from] || from} → ${LABELS[to] || to}`
    );
  }
}

// ------------------------------------------------------------ availability
function isDateTaken(truckId, eventDate, excludeBookingId = null) {
  const placeholders = ACTIVE_BOOKING_STATUSES.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT b.id, b.code, b.status FROM bookings b
        WHERE b.truck_id = ?
          AND b.event_date = ?
          AND b.status IN (${placeholders})
          AND (? IS NULL OR b.id <> ?)
        LIMIT 1`
    )
    .get(truckId, eventDate, ...ACTIVE_BOOKING_STATUSES, excludeBookingId, excludeBookingId);
  return row || null;
}

function assertAvailable(truckId, eventDate, excludeBookingId = null) {
  if (eventDate < todayISO()) {
    throw ApiError.badRequest('Event date cannot be in the past.');
  }
  const clash = isDateTaken(truckId, eventDate, excludeBookingId);
  if (clash) {
    throw ApiError.conflict(
      `Truck is already booked on ${eventDate} (booking ${clash.code}). Please choose another date or truck.`,
      { event_date: eventDate, conflicting_booking: clash.code }
    );
  }
}

/** Is the truck willing to serve this area? */
function servesArea(truckId, areaName) {
  const areas = db
    .prepare('SELECT area_name FROM service_areas WHERE truck_id = ?')
    .all(truckId)
    .map((r) => r.area_name.toLowerCase());
  if (!areas.length) return true; // truck defined no restriction
  return areas.some((a) => a === String(areaName).toLowerCase());
}

/** Flat per-event package price = booking amount (simulated payment). */
function priceForPackage(pkg, guests) {
  if (!pkg) return 0;
  let amount = Number(pkg.price_per_event);
  if (guests > pkg.max_guests) {
    throw ApiError.badRequest(
      `Package "${pkg.name}" supports a maximum of ${pkg.max_guests} guests (requested ${guests}).`
    );
  }
  return Math.round(amount * 100) / 100;
}

function timeline(bookingId) {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!b) return [];
  const steps = ['pending', 'accepted', 'confirmed', 'en_route', 'arrived', 'completed'];
  const terminal = b.status === 'declined' || b.status === 'cancelled';
  const current = steps.indexOf(b.status);
  return steps.map((s, i) => ({
    status: s,
    label: LABELS[s],
    done: terminal ? false : i <= current,
    active: b.status === s,
  }));
}

module.exports = {
  TRANSITIONS,
  OWNER_TRANSITIONS,
  LABELS,
  assertTransition,
  isDateTaken,
  assertAvailable,
  servesArea,
  priceForPackage,
  timeline,
};
