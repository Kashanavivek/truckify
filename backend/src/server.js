'use strict';

/**
 * Truckify API server entry point.
 * Middleware order: security -> cors -> parsers -> logging -> routes -> errors.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const { db, migrate } = require('./db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

// Apply the schema on boot so a fresh clone is always runnable.
migrate();
try {
  const row = db.prepare('SELECT count(*) as count FROM users').get();
  if (!row || row.count === 0) {
    // eslint-disable-next-line no-console
    console.log('Seeding initial data for first-time boot...');
    require('./db/seed');
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('Database initialization note:', err.message);
}

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.corsOrigin.includes('*') ? true : env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Global soft rate limit (auth routes have their own stricter limiter).
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 400, standardHeaders: true, legacyHeaders: false }));

app.use('/api', routes);

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      name: 'Truckify API',
      description: 'Event-based food truck booking platform - REST API',
      version: '1.0.0',
      docs: '/api/health',
    });
  });
}

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Truckify API listening on http://localhost:${env.port}  [${env.nodeEnv}]`);
  });
}

module.exports = app;
