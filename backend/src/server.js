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

const env = require('./config/env');
const { migrate } = require('./db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

// Apply the schema on boot so a fresh clone is always runnable.
migrate();

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

app.get('/', (_req, res) => {
  res.json({
    name: 'Truckify API',
    description: 'Event-based food truck booking platform - REST API',
    version: '1.0.0',
    docs: '/api/health',
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Truckify API listening on http://localhost:${env.port}  [${env.nodeEnv}]`);
  });
}

module.exports = app;
