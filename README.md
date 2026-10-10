# 🚚 Truckify — Event-Based Food Truck Booking Platform

A full-stack web application that connects **event organizers** with **food truck owners** through a single
digital marketplace. Unlike food-delivery apps, Truckify books an **entire food truck for an event**
(birthdays, weddings, college fests, corporate events, private parties).

> **Payment is SIMULATED.** The project demonstrates a payment *workflow* only — the system updates the
> payment status to `Paid` and stores a reference number. **No real financial transaction is performed.**

Built to the project abstract & flowchart: React + Tailwind CSS · Node.js + Express · PostgreSQL schema
(SQLite engine for zero-setup local runs) · JWT authentication with role-based access control.

---

## 1. Quick start

```bash
# 1) install everything + create & seed the database
npm run setup

# 2) terminal A - API on http://localhost:4000
npm run dev:backend

# 3) terminal B - SPA on http://localhost:5173
npm run dev:frontend
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the Express server, so no CORS setup is needed in dev.

### Seeded demo accounts

| Role     | Email                     | Password       | What to try |
|----------|---------------------------|----------------|-------------|
| Customer | `customer@truckify.test`  | `Customer@123` | Search by date + area, book, pay (simulated), review |
| Owner    | `owner@truckify.test`     | `Owner@123`    | 2 live trucks, accept requests, event-day status |
| Admin    | `admin@truckify.test`     | `Admin@123`    | Approve *The Chaat Cart* (pending), platform stats |

Extra accounts: `sana@truckify.test` / `imran@truckify.test` (owners), `karan@truckify.test` /
`neha@truckify.test` (customers) — same role passwords as above.

---

## 2. Project structure

```
truckify/
├── package.json                 # one-command setup / run scripts
├── README.md
├── docs/
│   ├── ARCHITECTURE.md          # layers, modules, ERD, workflow
│   └── API.md                   # full endpoint reference
├── database/
│   ├── schema.postgres.sql      # production PostgreSQL schema (DDL + indexes)
│   └── seed-notes.md            # seed data description
├── backend/                     # Node.js + Express REST API
│   ├── .env.example
│   ├── package.json
│   ├── scripts/smoke-test.js    # 40+ end-to-end API assertions
│   └── src/
│       ├── server.js            # app bootstrap (helmet, cors, rate limit, errors)
│       ├── config/env.js
│       ├── db/
│       │   ├── index.js         # single connection + transactions
│       │   ├── schema.sql       # DDL (SQLite dialect, PG-compatible design)
│       │   ├── migrate.js
│       │   └── seed.js          # demo data
│       ├── middleware/          # auth (JWT + RBAC), validation (zod), errors
│       ├── services/            # booking rules, notifications, truck search
│       ├── validators/schemas.js
│       └── routes/              # auth, trucks, bookings, notifications, admin, meta
└── frontend/                    # React + Tailwind CSS SPA (Vite)
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── api/client.js        # fetch wrapper, JWT storage, formatters
        ├── context/             # AuthContext, ToastContext
        ├── components/          # Navbar, TruckCard, ui kit, route guard
        └── pages/               # 18 screens: public, customer, owner, admin
```

---

## 3. Main modules (as specified in the abstract)

| Module | Highlights |
|---|---|
| **Customer** | Search by event date + area (+ cuisine, budget, keyword), truck profile with menu/packages/ratings/reviews, booking request, simulated payment, booking history, cancellation, verified review |
| **Owner** | Truck registration, profile/menu/package/service-area management, booking requests (accept/decline), event calendar, earnings, event-day status |
| **Admin** | Truck verification (approve/reject with reason), truck management (activate/suspend), booking monitoring, platform statistics, user management, audit log |
| **Booking** | request → accept/decline → simulated payment → confirmed → en route → arrived → completed, cancellation with simulated refund, **double-booking prevention** |
| **Notification** | In-app feed + unread badge for booking requests, approvals, payments, event-status changes and reviews |

---

## 4. The booking workflow (matches the project flowchart)

```
Customer: search (date + area) → view truck/menu/packages → select package + event details
        → send booking request ─────────────────────────────────┐
Owner:   receive request → ACCEPT (or DECLINE + reason)          │
Customer: "Pay Now" → SIMULATED payment → payment_status = Paid  │  ← no real money moves
        → booking status = CONFIRMED                             │
Owner:   event day: en_route → arrived → completed               │
Customer: submits a VERIFIED review (only after completion)      │
        → truck rating recalculated ─────────────────────────────┘
```

**Double-booking prevention** is enforced twice:

1. a business check inside the booking transaction (`assertAvailable`), and
2. a **partial unique index** in the database:

```sql
CREATE UNIQUE INDEX idx_no_double_booking ON bookings (truck_id, event_date)
  WHERE status IN ('pending','accepted','confirmed','en_route','arrived','completed');
```

Declined/cancelled bookings drop out of the index, so the date is released automatically.

---

## 5. Technology

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS 3 (18 screens, role-aware navigation) |
| Backend | Node.js + Express 4, layered (routes → services → db), zod validation |
| Database | SQLite via Node's built-in driver for local runs; **PostgreSQL schema included** (`database/schema.postgres.sql`) |
| Auth | JWT bearer tokens + role-based access control middleware (`customer` / `owner` / `admin`) |
| Security | helmet, CORS allow-list, express-rate-limit (global + stricter on auth), bcrypt password hashing, parameterised SQL |
| Payments | Simulated flow only (status + reference, no gateway) |
| Maps | Static map representation (as specified) |

---

## 6. API surface (short form)

```
GET    /api/health
POST   /api/auth/register | /login        GET/PATCH /api/auth/me
GET    /api/trucks                        # date, area, cuisine, price_range, q, sort, page
GET    /api/trucks/:id | /:id/availability | /:id/reviews
GET    /api/trucks/owner/mine
POST   /api/trucks | /:id/submit          PUT/DELETE /api/trucks/:id
POST   /api/trucks/:id/menu | /:id/packages | /:id/areas      (+ PUT/DELETE sub-resources)
POST   /api/bookings                      GET /api/bookings | /summary | /calendar
GET    /api/bookings/:id | /:id/receipt
POST   /api/bookings/:id/accept | /decline | /cancel | /pay | /status | /review
GET    /api/notifications | /unread-count POST /api/notifications/:id/read | /read-all
GET    /api/admin/stats | /trucks | /bookings | /users | /audit-logs
POST   /api/admin/trucks/:id/approve | /reject      PATCH /api/admin/trucks/:id/status
PATCH  /api/admin/users/:id/status
GET    /api/meta
```

Full reference with request/response bodies: [`docs/API.md`](docs/API.md).

---

## 7. Verify it works

```bash
# with the backend running on :4000
npm run test:api
```

`backend/scripts/smoke-test.js` walks the whole lifecycle and asserts the rules:

- registration + duplicate-email and wrong-password handling
- truck creation, menu/package/area setup, submission for approval
- pending trucks hidden from public search; admin approval activates them
- search by service area, booking creation, pricing from the package
- **double booking → HTTP 409** with the conflicting booking code
- past dates and out-of-area bookings rejected
- payment before acceptance rejected; customer cannot accept their own booking (403)
- owner accept → simulated payment → `confirmed` + payment reference
- illegal status transitions rejected (state machine); review before completion rejected
- verified review accepted once; second review rejected (409); rating recalculated
- receipt, dashboard summary, owner calendar, notifications, admin stats, RBAC 403s

---

## 8. Notes for the report / viva

- **RBAC** is enforced server-side on every route (`requireRole`), not just hidden in the UI.
- **Transactions** wrap booking creation, payment and review updates (BEGIN/COMMIT/ROLLBACK).
- **Validation** happens at the edge with zod schemas; SQLite constraint errors are mapped to clean 409/400 JSON errors.
- **Notification module** is written once as a service and called from every domain event, so owner/customer messages stay consistent.
- Swap to PostgreSQL: run `database/schema.postgres.sql`, install `pg`, and replace `src/db/index.js` — the SQL is already PG-compatible.

---

MIT licensed — built as an academic full-stack project reference implementation.
