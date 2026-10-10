'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const { db } = require('../db');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { signToken, authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/schemas');
const { push } = require('../services/notification.service');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});

const PUBLIC = 'id, name, email, role, phone, status, created_at';

/**
 * POST /api/auth/register
 * Public self-registration is limited to customers and owners.
 * Admin accounts are provisioned by seeding / existing admins only.
 */
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, phone } = req.body;

    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) throw ApiError.conflict('An account with this email already exists.');

    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hash, role, phone || null);

    const user = db.prepare(`SELECT ${PUBLIC} FROM users WHERE id = ?`).get(info.lastInsertRowid);

    push({
      userId: user.id,
      title: 'Welcome to Truckify 👋',
      body:
        role === 'owner'
          ? 'Create your truck profile, add menus and packages, then submit it for admin approval.'
          : 'Search food trucks for your event, send booking requests and track them here.',
      type: 'welcome',
    });

    res.status(201).json({ success: true, data: { token: signToken(user), user } });
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw ApiError.unauthorized('Invalid email or password.');
    }
    if (row.status === 'blocked') throw ApiError.forbidden('This account has been blocked by an admin.');

    const user = db.prepare(`SELECT ${PUBLIC} FROM users WHERE id = ?`).get(row.id);
    res.json({ success: true, data: { token: signToken(user), user } });
  })
);

/** GET /api/auth/me */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = { user: req.user };
    if (req.user.role === 'owner') {
      data.trucks = db
        .prepare('SELECT id, name, status, rating_avg, rating_count, image_url FROM trucks WHERE owner_id = ?')
        .all(req.user.id);
    }
    res.json({ success: true, data });
  })
);

/** PATCH /api/auth/me - update own profile */
router.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'phone'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!sets.length) throw ApiError.badRequest('Nothing to update.');
    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
    const user = db.prepare(`SELECT ${PUBLIC} FROM users WHERE id = ?`).get(req.user.id);
    res.json({ success: true, data: { user } });
  })
);

module.exports = router;
