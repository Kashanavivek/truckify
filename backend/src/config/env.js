'use strict';

require('dotenv').config();

const path = require('path');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'truckify-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbClient: process.env.DB_CLIENT || 'sqlite',
  sqliteFile: process.env.SQLITE_FILE
    ? path.resolve(process.cwd(), process.env.SQLITE_FILE)
    : path.resolve(__dirname, '../../data/truckify.db'),
  corsOrigin: (process.env.CORS_ORIGIN || '*,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  paymentMode: process.env.PAYMENT_MODE || 'simulated',
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'truckify-dev-secret-change-me') {
  console.warn('[SECURITY] JWT_SECRET was not set in production. Using an auto-generated secret for this session. Set JWT_SECRET in Render environment variables for persistent logins.');
  env.jwtSecret = require('crypto').randomBytes(32).toString('hex');
}

module.exports = env;
