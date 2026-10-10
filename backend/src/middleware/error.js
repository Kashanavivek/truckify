'use strict';

const { ApiError } = require('../utils/helpers');
const env = require('../config/env');

/** Look up the booking that occupies a truck/date, for a helpful 409 payload. */
function conflictingBooking(req) {
  try {
    const truckId = Number(req?.body?.truck_id);
    const date = req?.body?.event_date;
    if (!truckId || !date) return null;
    const { db } = require('../db');
    return (
      db
        .prepare(
          `SELECT code FROM bookings
            WHERE truck_id = ? AND event_date = ?
              AND status IN ('pending','accepted','confirmed','en_route','arrived','completed')
            LIMIT 1`
        )
        .get(truckId, date) || null
    );
  } catch {
    return null;
  }
}

/** 404 for unmatched API routes. */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

/* eslint-disable no-unused-vars */
/** Central error handler - single JSON error shape for the whole API. */
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Database integrity errors -> meaningful API errors (applies to both the
  // built-in node:sqlite driver and better-sqlite3 / pg style error objects).
  const rawMessage = String(err.message || '');
  const isIntegrity =
    err.code === 'SQLITE_CONSTRAINT' ||
    err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    err.code === 'ERR_SQLITE_ERROR' ||
    err.code === '23505' || // PostgreSQL unique_violation
    /UNIQUE constraint failed|duplicate key value/i.test(rawMessage);

  if (isIntegrity) {
    if (/idx_no_double_booking|bookings\.truck_id/i.test(rawMessage)) {
      const clash = conflictingBooking(req);
      status = 409;
      message = `This truck is already booked on ${req?.body?.event_date || 'that date'}${clash ? ` (booking ${clash.code})` : ''}. Please pick another date or truck.`;
      details = details || {
        rule: 'no_double_booking',
        event_date: req?.body?.event_date || null,
        conflicting_booking: clash ? clash.code : null,
      };
    } else if (/users\.email/i.test(rawMessage)) {
      status = 409;
      message = 'An account with this email already exists.';
      details = details || { field: 'email' };
    } else {
      status = 409;
      message = 'The record conflicts with an existing one (duplicate value).';
    }
  } else if (status >= 500 && /no such column|no such table/i.test(rawMessage) && env.nodeEnv === 'development') {
    // Surface schema problems loudly during development instead of a vague 500.
    status = 500;
    message = `Database schema error: ${rawMessage}`;
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
    ...(env.nodeEnv === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
