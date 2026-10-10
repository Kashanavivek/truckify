'use strict';

/**
 * Single database connection.
 *
 * Uses Node's built-in SQLite driver (`node:sqlite`, Node >= 22.5) so the
 * project runs with ZERO native build steps. Swap this one file for a `pg`
 * Pool to run on PostgreSQL - schema and queries stay PostgreSQL-compatible
 * (see /database/schema.postgres.sql).
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.sqliteFile), { recursive: true });

const db = new DatabaseSync(env.sqliteFile);
db.exec('PRAGMA foreign_keys = ON;');

/** Run a function inside a single ACID transaction (BEGIN / COMMIT / ROLLBACK). */
function tx(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  };
}

/** Apply schema.sql idempotently. */
function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return true;
}

module.exports = { db, tx, migrate };
