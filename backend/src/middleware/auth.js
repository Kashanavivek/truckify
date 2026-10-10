'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { db } = require('../db');
const { ApiError } = require('../utils/helpers');

const publicColumns = 'id, name, email, role, phone, status, created_at';

/** Verify the Bearer token and attach the fresh user row to req.user. */
function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired session token'));
  }

  const user = db
    .prepare(`SELECT ${publicColumns} FROM users WHERE id = ?`)
    .get(payload.sub);

  if (!user) return next(ApiError.unauthorized('Account no longer exists'));
  if (user.status === 'blocked') return next(ApiError.forbidden('This account has been blocked'));

  req.user = user;
  return next();
}

/** Attach req.user when a valid token is present, but never reject. */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7).trim(), env.jwtSecret);
    req.user =
      db.prepare(`SELECT ${publicColumns} FROM users WHERE id = ?`).get(payload.sub) || null;
  } catch {
    req.user = null;
  }
  return next();
}

/** Role-based access control guard: requireRole('admin'), etc. */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`This action requires role: ${roles.join(' or ')}`)
      );
    }
    return next();
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

module.exports = { authenticate, optionalAuth, requireRole, signToken };
