'use strict';

const express = require('express');

const { db } = require('../db');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();

/** GET /api/meta - lookup lists that power the search filters & forms. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const areas = db
      .prepare('SELECT area_name, COUNT(*) AS trucks FROM service_areas GROUP BY area_name ORDER BY trucks DESC, area_name')
      .all();
    const cuisines = db
      .prepare("SELECT cuisine, COUNT(*) AS trucks FROM trucks WHERE status = 'active' GROUP BY cuisine ORDER BY trucks DESC")
      .all();

    res.json({
      success: true,
      data: {
        areas,
        cuisines,
        price_ranges: [
          { value: '$', label: 'Budget friendly' },
          { value: '$$', label: 'Mid range' },
          { value: '$$$', label: 'Premium' },
        ],
        event_types: [
          'Birthday Party', 'Wedding', 'College Fest', 'Corporate Event',
          'Private Party', 'Housing Society Event', 'Food Festival', 'Other',
        ],
        booking_statuses: [
          { value: 'pending', label: 'Request sent' },
          { value: 'accepted', label: 'Accepted by owner' },
          { value: 'confirmed', label: 'Confirmed - paid' },
          { value: 'en_route', label: 'Truck en route' },
          { value: 'arrived', label: 'Truck arrived' },
          { value: 'completed', label: 'Event completed' },
          { value: 'declined', label: 'Declined by owner' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    });
  })
);

module.exports = router;
