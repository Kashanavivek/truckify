# Truckify — API reference

Base URL: `http://localhost:4000/api`
Auth: `Authorization: Bearer <jwt>` (obtained from `/auth/login` or `/auth/register`)
Response shape: success `{ "success": true, data | data + meta }` · error `{ "success": false, "error": "…", "details": [...] }`
Roles: `customer` · `owner` · `admin`

## Health & lookups

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | service status + uptime |
| GET | `/meta` | public | areas, cuisines, price bands, event types, status labels |

## Auth

| Method | Path | Role | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password, role: customer\|owner, phone? }` → `{ token, user }` |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | current user (+ owned trucks for owners) |
| PATCH | `/auth/me` | any | `{ name?, phone? }` |

Rate limited: 40 requests / 10 min per IP. Admin accounts cannot be self-registered.

## Trucks

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/trucks` | public | filters: `date`, `area`, `cuisine`, `price_range`, `q`, `sort` (`rating\|price_asc\|price_desc\|newest\|name`), `page`, `limit` |
| GET | `/trucks/:id` | public* | full profile: menu, packages, areas, reviews, booked dates, stats (*owner/admin can see non-active) |
| GET | `/trucks/:id/availability` | public | `?month=YYYY-MM` → booked dates |
| GET | `/trucks/:id/reviews` | public | verified reviews with booking context |
| GET | `/trucks/owner/mine` | owner, admin | console list with content counts |
| POST | `/trucks` | owner, admin | creates with `status = pending` |
| PUT | `/trucks/:id` | owner of truck, admin | editing an active truck returns it to review |
| POST | `/trucks/:id/submit` | owner of truck | requires ≥1 package and ≥1 service area |
| DELETE | `/trucks/:id` | owner of truck, admin | blocked while live bookings exist |
| POST | `/trucks/:id/menu` | owner of truck | `{ name, description?, category, price, is_veg?, is_available? }` |
| PUT/DELETE | `/trucks/menu/:itemId` | owner of truck | update / remove |
| POST | `/trucks/:id/packages` | owner of truck | `{ name, description?, includes[], price_per_event, min_guests, max_guests }` |
| PUT/DELETE | `/trucks/packages/:pkgId` | owner of truck | used packages are archived instead of deleted |
| POST | `/trucks/:id/areas` | owner of truck | `{ area_name, radius_km? }` (unique per truck) |
| DELETE | `/trucks/areas/:areaId` | owner of truck | remove |

## Bookings

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/bookings` | customer | `{ truck_id, package_id, event_date, event_type, area_name, venue_address?, guests, notes? }` |
| GET | `/bookings` | any (scoped) | filters: `status` (`all\|upcoming\|active\|<state>`), `payment_status`, `from`, `to`, `truck_id`, `q` |
| GET | `/bookings/summary` | any (scoped) | counters + upcoming confirmed events |
| GET | `/bookings/calendar` | owner, admin | `?month=YYYY-MM` |
| GET | `/bookings/:id` | parties + admin | booking + status timeline |
| GET | `/bookings/:id/receipt` | parties + admin | simulated payment receipt |
| POST | `/bookings/:id/accept` | owner of truck, admin | only from `pending`; re-checks availability |
| POST | `/bookings/:id/decline` | owner of truck, admin | `{ reason? }` |
| POST | `/bookings/:id/cancel` | parties | `{ reason? }` → releases date, marks paid as `refunded` |
| POST | `/bookings/:id/pay` | customer (owner of booking) | `{ method, card_name?, card_last4? }` → **simulated**, sets `paid` + `confirmed` |
| POST | `/bookings/:id/status` | owner of truck, admin | `{ status: en_route \| arrived \| completed }` |
| POST | `/bookings/:id/review` | customer | `{ rating 1-5, comment? }` — only after `completed`, once per booking |

Common errors: `400` validation/rules, `401` missing/expired token, `403` wrong role or not your record,
`404` unknown id, `409` duplicate email / double booking / duplicate review.

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | feed (unread first) + unread count |
| GET | `/notifications/unread-count` | badge counter |
| POST | `/notifications/:id/read` · `/notifications/read-all` | mark read |

## Admin (all require role `admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | counts, GMV, top trucks, by-cuisine, monthly series, recent bookings |
| GET | `/admin/trucks` | `?status=pending\|active\|rejected\|inactive` |
| POST | `/admin/trucks/:id/approve` | sets `active`, stamps approver, notifies owner |
| POST | `/admin/trucks/:id/reject` | `{ reason }` (≥3 chars), notifies owner |
| PATCH | `/admin/trucks/:id/status` | force any status (suspend / re-open) |
| GET | `/admin/bookings` | `?status=&q=` platform-wide monitoring |
| GET | `/admin/users` | `?role=` |
| PATCH | `/admin/users/:id/status` | `{ status: active\|blocked }` |
| GET | `/admin/audit-logs` | last 100 admin actions |

## Example

```bash
# login as the seeded customer
TOKEN=$(curl -s localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer@truckify.test","password":"Customer@123"}' | jq -r .data.token)

# search trucks free on a date, in an area
curl -s "localhost:4000/api/trucks?date=2026-11-20&area=Koramangala" | jq '.data[].name'

# send a booking request
curl -s localhost:4000/api/bookings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"truck_id":1,"package_id":1,"event_date":"2026-11-20","area_name":"Koramangala","guests":120,"event_type":"Wedding"}'
```
