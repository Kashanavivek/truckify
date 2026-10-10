'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const truckRoutes = require('./truck.routes');
const bookingRoutes = require('./booking.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin.routes');
const metaRoutes = require('./meta.routes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Truckify API',
      status: 'healthy',
      uptime_s: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/trucks', truckRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/meta', metaRoutes);

module.exports = router;
