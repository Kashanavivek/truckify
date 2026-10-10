'use strict';

const { db } = require('../db');

/**
 * Notification Module - booking & event-status notifications for users.
 * Every domain event funnels through here so notifications stay consistent.
 */
const notify = db.prepare(
  `INSERT INTO notifications (user_id, title, body, type, booking_id)
   VALUES (@user_id, @title, @body, @type, @booking_id)`
);

function push({ userId, title, body, type = 'info', bookingId = null }) {
  notify.run({
    user_id: userId,
    title,
    body: body || null,
    type,
    booking_id: bookingId,
  });
}

function listForUser(userId, limit = 50) {
  return db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY is_read ASC, datetime(created_at) DESC LIMIT ?`
    )
    .all(userId, limit);
}

function unreadCount(userId) {
  return db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId).c;
}

function markRead(userId, id) {
  return db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(id, userId).changes;
}

function markAllRead(userId) {
  return db
    .prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
    .run(userId).changes;
}

module.exports = { push, listForUser, unreadCount, markRead, markAllRead };
