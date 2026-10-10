# Truckify — Architecture

## 1. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│  React + Tailwind CSS SPA (Vite, port 5173)                          │
│  pages/  ─ public · customer · owner · admin                         │
│  context/ ─ AuthContext (JWT), ToastContext                          │
│  api/client.js ─ fetch wrapper (Bearer token, JSON error shape)      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  /api/*  (Vite proxy in dev, REST in prod)
┌───────────────────────────▼──────────────────────────────────────────┐
│  Express API (port 4000)                                             │
│  routes/     thin HTTP layer (auth, trucks, bookings, notifications, │
│              admin, meta)                                            │
│  middleware/ authenticate · optionalAuth · requireRole (RBAC)        │
│              validate(zod) · errorHandler (single JSON error shape)  │
│  services/   booking.service  (state machine, availability, pricing) │
│              truck.service    (search, profile, rating refresh)      │
│              notification.service (single write path for alerts)     │
│  validators/ zod schemas per endpoint                                │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  parameterised SQL + transactions
┌───────────────────────────▼──────────────────────────────────────────┐
│  SQLite (node:sqlite built-in)  ⇄  PostgreSQL schema provided        │
│  9 tables + 1 partial unique index for double-booking prevention     │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Data model (ERD summary)

```
users ─┬─< trucks ─┬─< menu_items
       │           ├─< packages ──< bookings (package_id, SET NULL)
       │           ├─< service_areas
       │           └─< reviews
       ├─< bookings (customer_id)  >── trucks (truck_id)
       ├─< reviews  (customer_id)
       ├─< notifications
       └─< audit_logs (actor_id, admin only)

bookings 1─1 reviews        (UNIQUE booking_id → one review per event)
```

Key columns and constraints

| Table | Important columns / rules |
|---|---|
| `users` | `role ∈ (customer, owner, admin)`, `status ∈ (active, blocked)`, unique email, bcrypt hash |
| `trucks` | `status ∈ (pending, active, rejected, inactive)`, `rating_avg`/`rating_count` denormalised, `approved_at`, `approved_by` |
| `packages` | `price_per_event` (flat per-event price), `min_guests`/`max_guests`, `includes` JSON list |
| `service_areas` | unique `(truck_id, area_name)`; drives area search + booking eligibility |
| `bookings` | `code` unique, `status` 8-state machine, `payment_status ∈ (unpaid, paid, refunded)`, amount snapshot |
| `reviews` | `booking_id` **UNIQUE** → verified one-review-per-completed-event, `rating 1..5` |
| `notifications` | per-user feed, `is_read`, links back to `booking_id` |
| `audit_logs` | admin actions (approve/reject/status changes) |

Indexes: owner/status on trucks, truck/customer/date on bookings, area_name on service_areas,
`(user_id, is_read)` on notifications.

## 3. Booking state machine

```
pending ──accept──▶ accepted ──pay(simulated)──▶ confirmed ──▶ en_route ──▶ arrived ──▶ completed
   │                    │                            │
   ├──decline──▶ declined                    cancel ──▶ cancelled (payment → refunded)
   └──cancel──▶ cancelled
```

Allowed transitions are declared in `services/booking.service.js`; owner-only transitions are a
separate table, so an owner can never jump straight from `confirmed` to `completed`, and a customer
can never accept their own booking. Illegal transitions return HTTP 400 with a readable message.

## 4. Business rules enforced server-side

1. **Availability** — a truck with a live booking (pending/accepted/confirmed/en route/arrived/completed)
   on a date cannot receive another request for that date (409 + conflicting booking code).
2. **Service area** — a booking is rejected if the truck does not list that area.
3. **Package rules** — guest count must fall inside `min_guests…max_guests`; price is the package's
   flat per-event price (not per plate).
4. **Payment** — only after `accepted`; simulated only; flips payment to `paid`, status to `confirmed`,
   stores `payment_ref` + `paid_at`.
5. **Reviews** — customer only, only after `completed`, one per booking, then `rating_avg` recalculated.
6. **Approval gate** — a truck is invisible in public search until an admin sets `status = active`;
   editing an approved listing sends it back to review.
7. **Cancellation** — releases the event date immediately; a paid booking is marked `refunded`.

## 5. Request lifecycle

`route → validate(zod) → authenticate → requireRole → service rules → SQL in transaction → notification service → JSON`

Errors are normalised to `{ success: false, error, details? }`; SQLite constraint violations are mapped
to 409 with a human-readable message.

## 6. Configuration

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | token signing (production refuses the default secret) |
| `SQLITE_FILE` | local database file (`backend/data/truckify.db`) |
| `CORS_ORIGIN` | comma-separated allow-list (dev: `http://localhost:5173`) |
| `PAYMENT_MODE` | `simulated` (the only supported mode in this build) |
