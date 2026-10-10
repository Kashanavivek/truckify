'use strict';

/** Wrap async route handlers so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Typed HTTP error used across the API. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, details); }
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const isPastDate = (dateStr) => dateStr < todayISO();

/** TRK-<base36 timestamp>-<random> booking code. */
function bookingCode() {
  return `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Parse a TEXT/JSON column safely. */
function parseJSON(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

const ACTIVE_BOOKING_STATUSES = ['accepted', 'confirmed', 'en_route', 'arrived', 'completed'];

module.exports = {
  asyncHandler,
  ApiError,
  todayISO,
  isPastDate,
  bookingCode,
  round2,
  parseJSON,
  ACTIVE_BOOKING_STATUSES,
};
