'use strict';

const fs = require('fs');
const env = require('../config/env');

// Delete the old file BEFORE opening a connection (requiring ./index opens it).
if (process.argv.includes('--reset') && fs.existsSync(env.sqliteFile)) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(env.sqliteFile + suffix, { force: true });
  }
  console.log(`reset: removed ${env.sqliteFile}`);
}

const { migrate } = require('./index');

migrate();
console.log(`migrated: schema applied to ${env.sqliteFile}`);