'use strict';

/**
 * End-to-end API smoke test - proves the full Truckify workflow works:
 * register -> truck setup -> admin approval -> search -> booking request ->
 * accept -> simulated payment -> event-day status -> verified review.
 * Run with the server already running:  node scripts/smoke-test.js
 */

const BASE = process.env.API_URL || 'http://localhost:4000/api';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name} ${extra}`); }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const futureDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const stamp = Date.now();

(async () => {
  console.log(`\nTruckify API smoke test -> ${BASE}\n`);

  // ---------------------------------------------------------------- health
  let r = await call('GET', '/health');
  check('GET /health returns healthy', r.status === 200 && r.json.data.status === 'healthy');

  // ------------------------------------------------------------ registrations
  const ownerEmail = `owner${stamp}@truckify.test`;
  r = await call('POST', '/auth/register', { body: { name: 'Smoke Owner', email: ownerEmail, password: 'secret123', role: 'owner' } });
  check('POST /auth/register (owner)', r.status === 201 && !!r.json.data.token);
  const ownerToken = r.json.data?.token;

  const custEmail = `cust${stamp}@truckify.test`;
  r = await call('POST', '/auth/register', { body: { name: 'Smoke Customer', email: custEmail, password: 'secret123', role: 'customer' } });
  check('POST /auth/register (customer)', r.status === 201 && !!r.json.data.token);
  const custToken = r.json.data?.token;

  r = await call('POST', '/auth/login', { body: { email: 'admin@truckify.test', password: 'Admin@123' } });
  check('POST /auth/login (seeded admin)', r.status === 200 && r.json.data.user.role === 'admin');
  const adminToken = r.json.data?.token;

  r = await call('POST', '/auth/register', { body: { name: 'Bad', email: ownerEmail, password: 'secret123' } });
  check('duplicate email rejected with 409', r.status === 409);

  r = await call('POST', '/auth/login', { body: { email: 'admin@truckify.test', password: 'wrong' } });
  check('wrong password rejected with 401', r.status === 401);

  // --------------------------------------------------------------- truck CRUD
  r = await call('POST', '/trucks', { token: ownerToken, body: { name: 'Smoke Truck', cuisine: 'Test', price_range: '$$', base_city: 'Testville' } });
  check('POST /trucks creates a pending truck', r.status === 201 && r.json.data.status === 'pending');
  const truckId = r.json.data?.id;

  r = await call('POST', `/trucks/${truckId}/menu`, { token: ownerToken, body: { name: 'Test Dish', price: 120, category: 'Main' } });
  check('POST /trucks/:id/menu adds a menu item', r.status === 201);

  r = await call('POST', `/trucks/${truckId}/packages`, { token: ownerToken, body: { name: 'Smoke Package', price_per_event: 15000, min_guests: 10, max_guests: 100, includes: ['Dish'] } });
  check('POST /trucks/:id/packages adds a package', r.status === 201);
  const packageId = r.json.data?.id;

  r = await call('POST', `/trucks/${truckId}/areas`, { token: ownerToken, body: { area_name: 'Smoke Area', radius_km: 15 } });
  check('POST /trucks/:id/areas adds a service area', r.status === 201);

  r = await call('POST', `/trucks/${truckId}/submit`, { token: ownerToken });
  check('POST /trucks/:id/submit resubmits for approval', r.status === 200);

  r = await call('GET', '/trucks', { token: custToken });
  check('pending truck is hidden from public search', !r.json.data.some((t) => t.id === truckId));

  r = await call('GET', '/admin/trucks?status=pending', { token: adminToken });
  check('GET /admin/trucks?status=pending lists the queue', r.status === 200);

  r = await call('POST', `/admin/trucks/${truckId}/approve`, { token: adminToken });
  check('POST /admin/trucks/:id/approve activates the truck', r.status === 200 && r.json.data.status === 'active');

  r = await call('GET', `/trucks/${truckId}`, { token: custToken });
  const truck = r.json.data;
  check('GET /trucks/:id returns menu/packages/areas', truck.menu.length === 1 && truck.packages.length === 1 && truck.areas.length === 1);

  r = await call('GET', '/trucks?area=Smoke%20Area');
  check('GET /trucks?area= filters by service area', r.json.data.some((t) => t.id === truckId));

  // --------------------------------------------------------------- bookings
  const d1 = futureDate(45);
  r = await call('POST', '/bookings', { token: custToken, body: { truck_id: truckId, package_id: packageId, event_date: d1, area_name: 'Smoke Area', guests: 50, event_type: 'Wedding' } });
  check('POST /bookings creates a request', r.status === 201 && r.json.data.status === 'pending');
  const bookingId = r.json.data?.id;
  check('booking amount priced from the package', r.json.data.amount === 15000);

  r = await call('POST', '/bookings', { token: custToken, body: { truck_id: truckId, package_id: packageId, event_date: d1, area_name: 'Smoke Area', guests: 50 } });
  check('DOUBLE BOOKING blocked with 409', r.status === 409);
  check('double booking returns the conflicting code', !!r.json.details?.conflicting_booking);

  r = await call('POST', '/bookings', { token: custToken, body: { truck_id: truckId, package_id: packageId, event_date: futureDate(-3), area_name: 'Smoke Area', guests: 20 } });
  check('past event date rejected', r.status === 400);

  r = await call('POST', '/bookings', { token: custToken, body: { truck_id: truckId, package_id: packageId, event_date: futureDate(46), area_name: 'No Where Land', guests: 20 } });
  check('area outside service zones rejected', r.status === 400);

  r = await call('POST', `/bookings/${bookingId}/pay`, { token: custToken, body: { method: 'card' } });
  check('payment before acceptance rejected', r.status === 400);

  r = await call('POST', `/bookings/${bookingId}/accept`, { token: custToken });
  check('customer cannot accept own booking (403)', r.status === 403);

  r = await call('POST', `/bookings/${bookingId}/accept`, { token: ownerToken });
  check('owner accepts the request', r.status === 200 && r.json.data.status === 'accepted');

  r = await call('POST', `/bookings/${bookingId}/status`, { token: ownerToken, body: { status: 'en_route' } });
  check('event-day status blocked before payment (state machine)', r.status === 400);

  r = await call('POST', `/bookings/${bookingId}/pay`, { token: custToken, body: { method: 'card' } });
  check('SIMULATED payment confirms the booking', r.status === 200 && r.json.data.status === 'confirmed' && r.json.data.payment_status === 'paid');
  check('simulated payment returns a payment reference', !!r.json.data.payment_ref);

  r = await call('POST', `/bookings/${bookingId}/review`, { token: custToken, body: { rating: 5, comment: 'Too early' } });
  check('review blocked before completion', r.status === 400);

  for (const s of ['en_route', 'arrived', 'completed']) {
    r = await call('POST', `/bookings/${bookingId}/status`, { token: ownerToken, body: { status: s } });
    check(`owner advances status to ${s}`, r.status === 200 && r.json.data.status === s);
  }

  r = await call('POST', `/bookings/${bookingId}/status`, { token: ownerToken, body: { status: 'arrived' } });
  check('illegal transition completed -> arrived rejected', r.status === 400);

  r = await call('POST', `/bookings/${bookingId}/review`, { token: custToken, body: { rating: 5, comment: 'Great event!' } });
  check('verified review accepted after completion', r.status === 201);

  r = await call('POST', `/bookings/${bookingId}/review`, { token: custToken, body: { rating: 4 } });
  check('second review on same booking rejected', r.status === 409);

  r = await call('GET', `/trucks/${truckId}`);
  check('truck rating recalculated to 5.0', r.json.data.rating_avg === 5 && r.json.data.rating_count === 1);

  r = await call('GET', `/bookings/${bookingId}/receipt`, { token: custToken });
  check('GET /bookings/:id/receipt returns a simulated receipt', r.status === 200 && r.json.data.payment_status === 'paid');

  r = await call('GET', '/bookings/summary', { token: ownerToken });
  check('GET /bookings/summary returns counters', r.status === 200 && r.json.data.counters.total >= 1);

  r = await call('GET', '/bookings/calendar', { token: ownerToken });
  check('GET /bookings/calendar returns a month view', r.status === 200 && Array.isArray(r.json.data.bookings));

  r = await call('GET', '/notifications', { token: ownerToken });
  check('notification module produced notifications', r.status === 200 && r.json.data.length > 0);

  r = await call('GET', '/admin/stats', { token: adminToken });
  check('GET /admin/stats returns platform statistics', r.status === 200 && typeof r.json.data.counts.trucks_total === 'number');

  r = await call('GET', '/admin/stats', { token: custToken });
  check('RBAC: customer blocked from admin stats (403)', r.status === 403);

  r = await call('GET', '/meta');
  check('GET /meta returns filter lookups', r.status === 200 && r.json.data.event_types.length > 0);

  r = await call('GET', '/trucks/999999');
  check('unknown truck returns 404', r.status === 404);

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed) { console.log(`  failing checks: ${failures.join(', ')}`); process.exitCode = 1; }
  else console.log('  ALL CHECKS PASSED\n');
})().catch((e) => { console.error('smoke test crashed:', e); process.exitCode = 1; });
