# Seed data (backend/src/db/seed.js)

`npm run db:reset` recreates and re-seeds the database at `backend/data/truckify.db`.

## Users (7)

| Name | Email | Password | Role |
|---|---|---|---|
| Priya Nair | admin@truckify.test | Admin@123 | admin |
| Rahul Mehta | owner@truckify.test | Owner@123 | owner (2 trucks) |
| Sana Kapoor | sana@truckify.test | Owner@123 | owner (2 trucks) |
| Imran Sheikh | imran@truckify.test | Owner@123 | owner (1 live + 1 pending) |
| Aditi Sharma | customer@truckify.test | Customer@123 | customer |
| Karan Verma | karan@truckify.test | Customer@123 | customer |
| Neha Gupta | neha@truckify.test | Customer@123 | customer |

## Trucks (6)

| Truck | Cuisine | Price | Status | Packages |
|---|---|---|---|---|
| The Rolling Tandoor | North Indian | $$ | active | Silver / Gold Wedding / Corporate Lunch |
| Smash & Co. Burgers | American | $$ | active | Fest Combo / Corporate Quick Service |
| Wok This Way | Asian | $$ | active | Wok Party / College Fest Special |
| Sweet Ride Desserts | Desserts | $$ | active | Dessert Bar / Birthday Sweet Corner |
| Coastal Fry House | Seafood | $$$ | active | Coastal Premium / Grand Reception |
| The Chaat Cart | Street Food | $ | **pending** | Chaat Counter / Society Evening |

Each truck has 5 menu items, 2-3 packages and 5 service areas
(Koramangala, Indiranagar, Whitefield, HSR Layout, Jayanagar).

## Bookings (9) — a full lifecycle spread

| Code | Truck | Status | Payment |
|---|---|---|---|
| TRK-DEMO-0001 | The Rolling Tandoor | completed (+ reviewed) | paid |
| TRK-DEMO-0002 | Wok This Way | completed (+ reviewed) | paid |
| TRK-DEMO-0003 | Sweet Ride Desserts | completed (+ reviewed) | paid |
| TRK-DEMO-0004 | Coastal Fry House | confirmed | paid |
| TRK-DEMO-0005 | Smash & Co. Burgers | accepted | unpaid |
| TRK-DEMO-0006 | The Rolling Tandoor | pending | unpaid |
| TRK-DEMO-0007 | Wok This Way | pending | unpaid |
| TRK-DEMO-0008 | Sweet Ride Desserts | cancelled | refunded |
| TRK-DEMO-0009 | Coastal Fry House | declined | unpaid |

Plus 3 verified reviews (which drive the truck ratings), 5 notifications across the three roles, and
audit-log rows for the approvals — so every dashboard has meaningful data on first run.
