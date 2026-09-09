# Fish N Fresh — Valuation, Competitive Review, and Next Build Steps

## 1. What the app is today (page by page)

Storefront
- Home: banner carousel (auto + swipe, centre dots), trust badges (admin-managed, horizontal scroll), round categories, bestsellers, featured, all products, catch alerts.
- Catalog: search, category filter, availability, stock urgency.
- Product page: images, Tamil name, price/GST, benefits, AI nutrition card, reviews, add to cart.
- Cart + floating cart: quantities, coupon, delivery vs pickup.
- Checkout: address book, map pin picker, distance-based delivery fee, delivery date + time window, COD / UPI deep link / card, server-side price recalculation (tamper-proof).
- Orders: signed-in history + guest lookup by phone.
- Tracking: live status timeline, driver ETA, delivery PIN card, route map.
- Payment status, settings (theme, language), terms.

Admin / staff
- Dashboard, Orders, Delivery, Schedule (windows), Driver map, POS, Products, Categories/Banners/Badges, Promotions, Customers, Complaints, Reviews, Broadcasts, Purchases, Suppliers, Waste, Reports, Payments (status, refunds, balances, CSV), Staff onboarding (creates driver/staff logins), Settings (store, hours, delivery, GST, UPI, gateway keys, printer).
- Role isolation: admin (all), staff (orders/delivery/products/customers), driver (map + own orders only).

Backend
- Postgres with RLS on every table, role table + has_role(), delivery PIN verification, COD driver cash settlement, wallet/referrals, loyalty, subscriptions, function bookings, Stripe checkout + webhook, MCP agent integration.

## 2. Cost to build this from scratch (India, INR)

| Track | Effort | Agency rate |
|---|---|---|
| Product/UX design | 3–4 weeks | ₹1.5–2.5L |
| Storefront + PWA | 6–8 weeks | ₹4–6L |
| Admin + POS + reports | 8–10 weeks | ₹6–9L |
| Backend, RLS, roles, security | 4–6 weeks | ₹3–5L |
| Payments, refunds, settlements | 3 weeks | ₹1.5–2.5L |
| Delivery, PIN, maps, routing | 3 weeks | ₹1.5–2.5L |
| QA, deploy, docs | 3 weeks | ₹1.5–2L |

Total realistic build cost: **₹19–29 lakh** with a mid-tier Indian agency (6–8 months, 4–5 people). Freelance team: ₹8–14L. Top-tier product studio: ₹40L+.
Running cost: ₹3,000–15,000/month (hosting, database, maps, SMS/WhatsApp) plus payment fees.
Sale value as a white-label product: ₹40,000–1,50,000 per client licence, or ₹3,000–8,000/month SaaS.

## 3. Competitive position

Versus Licious/FreshToHome/TenderCuts: they win on supply chain and brand, not software. This app already matches their storefront and beats their franchise tooling.
Versus local shop apps (Dukaan, Shopify, generic builders): those have no fish-specific weight/GST handling, no harbour catch alerts, no driver cash settlement, no delivery PIN.
Real edge: this is a **complete shop operating system**, not just a store.

## 4. Unique features (rare or absent elsewhere)

- Delivery PIN handover with attempt lock and audited admin bypass.
- Driver cash settlement ledger with atomic locking (no double settlement).
- Harbour catch broadcast alerts tied to today's stock.
- Waste/spoilage register with cost loss — fresh-food specific.
- Agent (MCP) access so AI assistants can browse catalogue and track a customer's own order.
- Server-enforced pricing: totals recomputed from the database on every customer order.

## 5. Wow features

Live driver map with route, AI nutrition/benefit cards per fish, thermal printer + POS with scale weight, referral wallet with cashback, one-tap WhatsApp order flow, tri-lingual UI (English/Tamil/Hindi), PWA install, offline banner.

## 6. Weak areas to improve

- No real push notifications yet (FCM half-wired) — status updates rely on the app being open.
- Email notifications not live (needs a sender address).
- No inventory auto-deduction per order; stock is manual.
- Reports are basic — no profit per product, no cohort or repeat-rate view.
- No customer support chat; complaints only.
- No A/B or campaign tooling; promotions are manual codes.

## 7. Required before selling to clients

Push notifications, order confirmation and status emails, automatic stock deduction, invoice PDF with GSTIN, data export/backup per client, onboarding wizard, and a signed licence/terms page.

## 8. Multi-client white-label — is it possible?

Yes, and the project is already half-way there (`src/lib/tenant.ts`, `.env.example`, `new_client_master_seed.sql`).

How it works: one codebase, one Git repository. Each client gets their own deployment with their own environment values — their own database account, their own domain, their own store name, logo, UPI and payment keys. Nothing is shared between clients except the code.

When you improve the app, you push once and every client deployment rebuilds from the same code, so all clients get the update on their own domain and their own data. Database structure changes must be applied per client — a versioned migration script that you run on each client's database (the master seed file is the starting point for that).

Caveats to plan for: each client needs their own payment account and their own map/messaging keys; a shared "version" marker per client database so you know which ones are behind; and a rollback path in case an update breaks one client.

## 9. Work to do next (proposed, in order)

1. **End-to-end paid-order walkthrough (seeded products, nothing replaced)** — place a real checkout order, pay it, confirm it flips to paid via the webhook, appears in the Payments report, then move it through confirmed → packed → out for delivery → delivered with PIN verification, and confirm tracking, history and settlement all reflect it. Report findings and fix anything broken along the way.
2. **Customer portal** — a signed-in customer area with their orders, live delivery status, past payments and refunds, saved addresses, wallet and referral, reorder button. Strictly own-data only, no admin surface. New routes under the protected area, reusing existing order/tracking components.
3. **Payment keys walkthrough** — a written step-by-step for entering live keys in Admin → Settings → Payments (UPI ID and name, gateway provider, API key, secret key) plus what must be true before live charging works, and where the test-mode banner disappears.
4. **Order confirmation email** — blocked: I need the email address orders should be sent from before this can be switched on.

## Technical notes

- Order walkthrough uses the existing Stripe sandbox connection and `/api/public/payments/webhook?env=sandbox`; no product data is touched.
- Customer portal: new routes under `src/routes/_authenticated/account/*`, backed by RLS-scoped reads (`orders`, `wallet_transactions`, `customer_addresses`) — no new tables expected.
- Live-key guidance covers `payment_gateway_credentials` (admin-only table) and `store_settings.upi_id` / `upi_name`; Stripe live charging additionally requires payment go-live completion, which is outside the admin screen.
