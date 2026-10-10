'use strict';

/**
 * Seed data - makes the delivered project demo-ready out of the box.
 * Run:  npm run db:reset      (migrate --reset + seed)
 */

const bcrypt = require('bcryptjs');
const { db, tx, migrate } = require('./index');
const { refreshRating } = require('../services/truck.service');



migrate();

const IMG = {
  truckA: 'https://sspark.genspark.ai/i/RcmkIEALLBkwqpUP?width=1280',
  truckB: 'https://sspark.genspark.ai/i/NeIjoumqaFAyp8vu?width=1280',
  truckC: 'https://sspark.genspark.ai/i/hQjR2j9pOCB7ZCUT?width=1280',
  truckD: 'https://sspark.genspark.ai/i/SjDdIdZbG8e2wBhU?width=1280',
  truckE: 'https://sspark.genspark.ai/i/5Uoo9NQblTG935r1?width=1280',
  truckF: 'https://sspark.genspark.ai/i/lQ0Go0qPyPRlY14Q?width=1280',
};

const iso = (dayOffset) => new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

console.log('seeding Truckify ...');

const wipe = tx(() => {
  for (const t of ['audit_logs', 'notifications', 'reviews', 'bookings', 'packages', 'menu_items', 'service_areas', 'trucks', 'users']) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('audit_logs','notifications','reviews','bookings','packages','menu_items','service_areas','trucks','users')").run();
});
wipe();

/* ------------------------------------------------------------------ users */
const hash = (p) => bcrypt.hashSync(p, 10);

const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, role, phone, status, created_at) VALUES (?,?,?,?,?,?,?)'
);

const users = {
  admin: insertUser.run('K.Vivek (Platform Admin)', 'admin@truckify.test', hash(process.env.ADMIN_PASSWORD || 'Admin@123'), 'admin', '+91 98000 11111', 'active', daysAgo(120)).lastInsertRowid,
  ownerA: insertUser.run('Rahul Mehta', 'owner@truckify.test', hash('Owner@123'), 'owner', '+91 98000 22222', 'active', daysAgo(90)).lastInsertRowid,
  ownerB: insertUser.run('Sana Kapoor', 'sana@truckify.test', hash('Owner@123'), 'owner', '+91 98000 33333', 'active', daysAgo(80)).lastInsertRowid,
  ownerC: insertUser.run('Imran Sheikh', 'imran@truckify.test', hash('Owner@123'), 'owner', '+91 98000 44444', 'active', daysAgo(70)).lastInsertRowid,
  custA: insertUser.run('Aditi Sharma', 'customer@truckify.test', hash('Customer@123'), 'customer', '+91 98000 55555', 'active', daysAgo(60)).lastInsertRowid,
  custB: insertUser.run('Karan Verma', 'karan@truckify.test', hash('Customer@123'), 'customer', '+91 98000 66666', 'active', daysAgo(45)).lastInsertRowid,
  custC: insertUser.run('Neha Gupta', 'neha@truckify.test', hash('Customer@123'), 'customer', '+91 98000 77777', 'active', daysAgo(30)).lastInsertRowid,
};

/* ----------------------------------------------------------------- trucks */
const insertTruck = db.prepare(
  `INSERT INTO trucks (owner_id, name, tagline, description, cuisine, price_range, base_city,
                       image_url, gallery, status, rating_avg, rating_count, approved_at, approved_by, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

const truckDefs = [
  {
    owner: users.ownerA, name: 'The Rolling Tandoor', tagline: 'Live-grill North Indian street food',
    cuisine: 'North Indian', price: '$$', city: 'Bengaluru', image: IMG.truckA,
    description: 'A full-service tandoor truck serving char-grilled kebabs, butter naan and biryani, cooked fresh in front of your guests. Perfect for weddings and large family gatherings.',
    status: 'active',
  },
  {
    owner: users.ownerA, name: 'Smash & Co. Burgers', tagline: 'Gourmet smash burgers, straight off the flat-top',
    cuisine: 'American', price: '$$', city: 'Bengaluru', image: IMG.truckB,
    description: 'Double-smashed patties, brioche buns and hand-cut fries. Fast service line designed for college fests and corporate events with 200+ guests.',
    status: 'active',
  },
  {
    owner: users.ownerB, name: 'Wok This Way', tagline: 'Asian street-food wok truck',
    cuisine: 'Asian', price: '$$', city: 'Bengaluru', image: IMG.truckC,
    description: 'Noodles, dumplings, bao and satay tossed in a live wok station. Vegetarian and non-vegetarian counters run in parallel so nobody waits.',
    status: 'active',
  },
  {
    owner: users.ownerB, name: 'Sweet Ride Desserts', tagline: 'Waffles, gelato and dessert jars',
    cuisine: 'Desserts', price: '$$', city: 'Bengaluru', image: IMG.truckD,
    description: 'A dessert-only truck for birthdays and receptions - Belgian waffles, artisanal gelato and customised dessert jars with your event branding.',
    status: 'active',
  },
  {
    owner: users.ownerC, name: 'Coastal Fry House', tagline: 'Mangalorean seafood on wheels',
    cuisine: 'Seafood', price: '$$$', city: 'Bengaluru', image: IMG.truckE,
    description: 'Coastal seafood prepared in traditional clay-pot masalas - fish fry, prawn ghee roast, neer dosa and sol kadhi. Premium event catering.',
    status: 'active',
  },
  {
    owner: users.ownerC, name: 'The Chaat Cart', tagline: 'Bombay-style chaat & street snacks',
    cuisine: 'Street Food', price: '$', city: 'Bengaluru', image: IMG.truckF,
    description: 'Budget-friendly chaat counter - pani puri, sev puri, dahi puri, pav bhaji and masala chai. A crowd favourite for society events and fests.',
    status: 'pending', // intentionally pending so the admin approval flow is demo-able
  },
];

const trucks = {};
const AREAS = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Jayanagar', 'Electronic City', 'Yelahanka', 'MG Road'];

const insertArea = db.prepare('INSERT INTO service_areas (truck_id, area_name, radius_km) VALUES (?,?,?)');
const insertMenu = db.prepare(
  'INSERT INTO menu_items (truck_id, name, description, category, price, is_veg, is_available) VALUES (?,?,?,?,?,?,1)'
);
const insertPkg = db.prepare(
  'INSERT INTO packages (truck_id, name, description, includes, price_per_event, min_guests, max_guests, is_active) VALUES (?,?,?,?,?,?,?,1)'
);

const menus = {
  'The Rolling Tandoor': [
    ['Paneer Tikka', 'Char-grilled cottage cheese with mint chutney', 'Starters', 260, 1],
    ['Murgh Malai Kebab', 'Creamy chicken kebab, cardamom & cheese', 'Starters', 320, 0],
    ['Butter Naan', 'Tandoori naan brushed with butter', 'Breads', 60, 1],
    ['Veg Biryani', 'Dum-cooked basmati with seasonal vegetables', 'Main', 240, 1],
    ['Chicken Dum Biryani', 'Hyderabadi style, slow-cooked on dum', 'Main', 320, 0],
    ['Gulab Jamun (2 pc)', 'Warm milk dumplings in saffron syrup', 'Desserts', 90, 1],
  ],
  'Smash & Co. Burgers': [
    ['Classic Smash Burger', 'Double patty, cheddar, house sauce', 'Burgers', 260, 0],
    ['Paneer Smash Burger', 'Crispy paneer patty, chipotle mayo', 'Burgers', 220, 1],
    ['Loaded Fries', 'Cheese sauce, jalapenos, herbs', 'Sides', 180, 1],
    ['Peri Peri Chicken Wings', '6 pc, flame-grilled', 'Sides', 280, 0],
    ['Chocolate Shake', 'Thick shake, Belgian cocoa', 'Beverages', 150, 1],
  ],
  'Wok This Way': [
    ['Veg Hakka Noodles', 'Wok-tossed with crunchy vegetables', 'Noodles', 200, 1],
    ['Chicken Schezwan Noodles', 'Fiery schezwan, spring onion', 'Noodles', 250, 0],
    ['Steamed Veg Momos (6 pc)', 'With spicy tomato chutney', 'Dim Sum', 180, 1],
    ['Chicken Bao (2 pc)', 'Fluffy bao, hoisin chicken', 'Dim Sum', 260, 0],
    ['Chicken Satay (4 pc)', 'Peanut sauce, cucumber relish', 'Starters', 280, 0],
    ['Jasmine Iced Tea', 'Chilled, lightly sweetened', 'Beverages', 110, 1],
  ],
  'Sweet Ride Desserts': [
    ['Belgian Waffle', 'With chocolate ganache & berries', 'Waffles', 240, 1],
    ['Red Velvet Waffle', 'Cream cheese drizzle', 'Waffles', 260, 1],
    ['Gelato Cup (single)', 'Choice of 8 seasonal flavours', 'Ice Cream', 150, 1],
    ['Dessert Jar', 'Layered brownie, mousse, crunch', 'Jars', 220, 1],
    ['Filter Coffee Tiramisu', 'South-Indian filter coffee twist', 'Jars', 280, 1],
  ],
  'Coastal Fry House': [
    ['Neer Dosa (4 pc)', 'Soft rice crepes with chutney', 'Breads', 140, 1],
    ['Prawn Ghee Roast', 'Mangalorean ghee roast masala', 'Main', 480, 0],
    ['Anjal Tawa Fry', 'King fish, rava crusted', 'Main', 520, 0],
    ['Kane Rava Fry', 'Lady fish, crisp semolina coating', 'Main', 420, 0],
    ['Sol Kadhi', 'Coconut-kokum digestive drink', 'Beverages', 120, 1],
  ],
  'The Chaat Cart': [
    ['Pani Puri (8 pc)', 'Chilled mint & tamarind water', 'Chaat', 90, 1],
    ['Sev Puri', 'Crisp puris, chutneys, sev', 'Chaat', 110, 1],
    ['Dahi Puri', 'Sweet yoghurt, tamarind, sev', 'Chaat', 130, 1],
    ['Pav Bhaji', 'Butter-loaded bhaji with 2 pav', 'Main', 160, 1],
    ['Masala Chai', 'Ginger-cardamom, brewed fresh', 'Beverages', 60, 1],
  ],
};

const packages = {
  'The Rolling Tandoor': [
    ['Silver Package', 'Live tandoor counter with 4 starters + 2 breads', ['4 starters', '2 breads', '1 welcome drink', 'Uniformed chefs', '3 hour service'], 28000, 50, 150],
    ['Gold Wedding Package', 'Full dinner buffet with biryani counters', ['6 starters', '2 biryani counters', '4 breads', '2 desserts', '4 hour service', 'Service staff'], 62000, 150, 400],
    ['Corporate Lunch', 'Quick service lunch counter', ['2 starters', '1 main', '2 breads', '1 dessert'], 21000, 40, 200],
  ],
  'Smash & Co. Burgers': [
    ['Fest Combo', 'Burger + loaded fries + shake per guest', ['1 burger', 'Loaded fries', '1 shake', '2 hour service'], 19000, 50, 200],
    ['Corporate Quick Service', 'High-throughput burger line', ['2 burger options', 'Fries', 'Soft drink', '3 hour service'], 26000, 80, 300],
  ],
  'Wok This Way': [
    ['Wok Party Package', 'Live wok station, 3 mains + 2 sides', ['3 mains', '2 sides', '1 beverage', 'Veg + non-veg counters'], 32000, 60, 250],
    ['College Fest Special', 'Fast-moving noodle & momo counter', ['2 noodle options', 'Momos', '1 beverage'], 22000, 100, 500],
  ],
  'Sweet Ride Desserts': [
    ['Dessert Bar', 'Waffle + gelato + jar station', ['1 waffle', '1 gelato cup', '1 dessert jar'], 18000, 40, 150],
    ['Birthday Sweet Corner', 'Customised dessert jars with branding', ['2 jars per guest', 'Branded labels', '2 hour service'], 24000, 40, 200],
  ],
  'Coastal Fry House': [
    ['Coastal Premium', 'Seafood tasting counter, chef-served', ['3 seafood mains', 'Neer dosa', 'Sol kadhi', 'Chef interaction'], 68000, 80, 250],
    ['Grand Reception Seafood', 'Premium seafood buffet with live counter', ['5 seafood items', '2 rice options', '2 desserts', 'Service staff'], 98000, 150, 400],
  ],
  'The Chaat Cart': [
    ['Chaat Counter', 'Unlimited chaat for 3 hours', ['4 chaat items', 'Masala chai', '3 hour service'], 14000, 50, 300],
    ['Society Evening Special', 'Budget-friendly chaat + snacks', ['3 chaat items', 'Pav bhaji', 'Chai'], 11000, 40, 250],
  ],
};

const packageIds = {};

for (const def of truckDefs) {
  const id = insertTruck.run(
    def.owner, def.name, def.tagline, def.description, def.cuisine, def.price, def.city,
    def.image, JSON.stringify([def.image]), def.status, 0, 0,
    def.status === 'active' ? daysAgo(40) : null,
    def.status === 'active' ? users.admin : null,
    daysAgo(45)
  ).lastInsertRowid;
  trucks[def.name] = id;

  AREAS.forEach((a, i) => {
    if (i < 5) insertArea.run(id, a, 12 + i * 3);
  });

  for (const [name, desc, cat, price, veg] of menus[def.name]) {
    insertMenu.run(id, name, desc, cat, price, veg);
  }
  packageIds[def.name] = [];
  for (const [name, desc, includes, price, min, max] of packages[def.name]) {
    packageIds[def.name].push(
      insertPkg.run(id, name, desc, JSON.stringify(includes), price, min, max).lastInsertRowid
    );
  }
}

/* --------------------------------------------------------------- bookings */
const insertBooking = db.prepare(
  `INSERT INTO bookings (code, customer_id, truck_id, package_id, event_date, event_type, area_name,
                         venue_address, guests, notes, status, amount, payment_status, payment_ref,
                         paid_at, accepted_at, completed_at, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

const bookings = [
  // completed + reviewed
  { code: 'TRK-DEMO-0001', c: users.custA, t: 'The Rolling Tandoor', pi: 0, date: iso(-24), type: 'Wedding', area: 'Whitefield', guests: 220, status: 'completed', paid: 'paid', created: daysAgo(40) },
  { code: 'TRK-DEMO-0002', c: users.custB, t: 'Wok This Way', pi: 1, date: iso(-15), type: 'College Fest', area: 'Koramangala', guests: 320, status: 'completed', paid: 'paid', created: daysAgo(35) },
  { code: 'TRK-DEMO-0003', c: users.custC, t: 'Sweet Ride Desserts', pi: 0, date: iso(-9), type: 'Birthday Party', area: 'HSR Layout', guests: 90, status: 'completed', paid: 'paid', created: daysAgo(28) },
  // live pipeline
  { code: 'TRK-DEMO-0004', c: users.custA, t: 'Coastal Fry House', pi: 1, date: iso(21), type: 'Corporate Event', area: 'Indiranagar', guests: 180, status: 'confirmed', paid: 'paid', created: daysAgo(12) },
  { code: 'TRK-DEMO-0005', c: users.custB, t: 'Smash & Co. Burgers', pi: 0, date: iso(34), type: 'Food Festival', area: 'MG Road', guests: 150, status: 'accepted', paid: 'unpaid', created: daysAgo(4) },
  { code: 'TRK-DEMO-0006', c: users.custC, t: 'The Rolling Tandoor', pi: 2, date: iso(12), type: 'Corporate Event', area: 'Electronic City', guests: 120, status: 'pending', paid: 'unpaid', created: daysAgo(2) },
  { code: 'TRK-DEMO-0007', c: users.custA, t: 'Wok This Way', pi: 0, date: iso(45), type: 'Private Party', area: 'Jayanagar', guests: 80, status: 'pending', paid: 'unpaid', created: daysAgo(1) },
  { code: 'TRK-DEMO-0008', c: users.custB, t: 'Sweet Ride Desserts', pi: 0, date: iso(-40), type: 'Private Party', area: 'Yelahanka', guests: 60, status: 'cancelled', paid: 'refunded', created: daysAgo(50) },
  { code: 'TRK-DEMO-0009', c: users.custC, t: 'Coastal Fry House', pi: 0, date: iso(60), type: 'Wedding', area: 'Whitefield', guests: 200, status: 'declined', paid: 'unpaid', created: daysAgo(18) },
];

const pkgPrice = (truckName, idx) =>
  db.prepare('SELECT price_per_event FROM packages WHERE id = ?').get(packageIds[truckName][idx]).price_per_event;

const bookingIds = {};
for (const b of bookings) {
  const id = insertBooking.run(
    b.code, b.c, trucks[b.t], packageIds[b.t][b.pi], b.date, b.type, b.area,
    `${b.area}, Bengaluru`, b.guests, null, b.status, pkgPrice(b.t, b.pi), b.paid,
    b.paid === 'paid' ? `SIMPAY-${b.code.slice(-4)}` : null,
    b.paid === 'paid' ? b.created : null,
    b.status !== 'pending' ? b.created : null,
    b.status === 'completed' ? b.created : null,
    b.created
  ).lastInsertRowid;
  bookingIds[b.code] = id;
}

/* ---------------------------------------------------------------- reviews */
const insertReview = db.prepare(
  'INSERT INTO reviews (booking_id, truck_id, customer_id, rating, comment, created_at) VALUES (?,?,?,?,?,?)'
);

const reviews = [
  ['TRK-DEMO-0001', 'The Rolling Tandoor', users.custA, 5, 'The tandoor counter was the highlight of our wedding. Chefs were punctual, food was hot and the biryani counters never had a queue.', daysAgo(22)],
  ['TRK-DEMO-0002', 'Wok This Way', users.custB, 4, 'Great value for a college fest. The momo counter ran out for about 15 minutes but they refilled quickly.', daysAgo(13)],
  ['TRK-DEMO-0003', 'Sweet Ride Desserts', users.custC, 5, 'Dessert jars with our party branding were such a nice touch. Guests loved the waffles.', daysAgo(7)],
];
for (const [code, truckName, cust, rating, comment, created] of reviews) {
  insertReview.run(bookingIds[code], trucks[truckName], cust, rating, comment, created);
}
db.prepare("UPDATE trucks SET rating_avg = 4.5, rating_count = 1 WHERE name = 'Wok This Way'").run();
refreshRating(trucks['The Rolling Tandoor']);
refreshRating(trucks['Wok This Way']);
refreshRating(trucks['Sweet Ride Desserts']);

/* ---------------------------------------------------------- notifications */
const insertNotif = db.prepare(
  'INSERT INTO notifications (user_id, title, body, type, booking_id, is_read, created_at) VALUES (?,?,?,?,?,?,?)'
);

insertNotif.run(users.admin, 'Truck awaiting approval', '"The Chaat Cart" was submitted by Imran Sheikh and is waiting for verification.', 'approval', null, 0, daysAgo(1));
insertNotif.run(users.ownerC, 'Your truck is under review', '"The Chaat Cart" is being verified by an admin.', 'approval', null, 0, daysAgo(1));
insertNotif.run(users.custC, 'Booking request sent', 'Your request to The Rolling Tandoor for a corporate event was sent.', 'booking_update', bookingIds['TRK-DEMO-0006'], 0, daysAgo(2));
insertNotif.run(users.ownerA, 'New booking request - The Rolling Tandoor', 'Neha Gupta requested a Corporate Event for 120 guests.', 'booking_request', bookingIds['TRK-DEMO-0006'], 0, daysAgo(2));
insertNotif.run(users.custB, 'Booking request accepted 🎉', 'Proceed to payment to confirm your Food Festival booking.', 'booking_update', bookingIds['TRK-DEMO-0005'], 0, daysAgo(3));

/* ------------------------------------------------------------- audit logs */
const insertAudit = db.prepare(
  'INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta, created_at) VALUES (?,?,?,?,?,?)'
);
for (const def of truckDefs.filter((d) => d.status === 'active')) {
  insertAudit.run(users.admin, 'approve_truck', 'trucks', trucks[def.name], JSON.stringify({ name: def.name }), daysAgo(40));
}

console.log('\nSeed complete.');
console.log('  Admin    admin@truckify.test    / Admin@123');
console.log('  Owner    owner@truckify.test    / Owner@123   (2 trucks)');
console.log('  Owner    sana@truckify.test     / Owner@123   (2 trucks)');
console.log('  Customer customer@truckify.test / Customer@123');
console.log('  Customer karan@truckify.test    / Customer@123');
console.log(`\n  ${Object.keys(trucks).length} trucks, ${bookings.length} bookings, ${reviews.length} reviews, ${AREAS.length} service areas.\n`);
