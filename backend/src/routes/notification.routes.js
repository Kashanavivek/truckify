'use strict';

const express = require('express');

const { db } = require('../db');
const { asyncHandler } = require('../utils/helpers');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/** GET /api/notifications - notification module feed. */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const svc = require('../services/notification.service');
    res.json({
      success: true,
      data: svc.listForUser(req.user.id, Number(req.query.limit) || 50),
      meta: { unread: svc.unreadCount(req.user.id) },
    });
  })
);

/** GET /api/notifications/unread-count */
router.get(
  '/unread-count',
  authenticate,
  asyncHandler(async (req, res) => {
    const svc = require('../services/notification.service');
    res.json({ success: true, data: { unread: svc.unreadCount(req.user.id) } });
  })
);

/** POST /api/notifications/:id/read */
router.post(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const svc = require('../services/notification.service');
    svc.markRead(req.user.id, Number(req.params.id));
    res.json({ success: true, data: { unread: svc.unreadCount(req.user.id) } });
  })
);

/** POST /api/notifications/read-all */
router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    const svc = require('../services/notification.service');
    svc.markAllRead(req.user.id);
    res.json({ success: true, data: { unread: 0 } });
  })
);

module.exports = router;
