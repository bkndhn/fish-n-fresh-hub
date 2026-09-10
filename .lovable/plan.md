# Fish N Fresh — Updated Valuation & Competitive Review (Sep 2026)

This reflects the app as it stands today, after the customer portal, security hardening, POS/driver/PIN/checkout fixes, and the full admin/operating suite were completed.

## 1. What the app is today (page by page)

Storefront (public)
- Home: auto-swipe banner carousel with centre dots, admin-managed trust badges (horizontal scroll), round category tiles, bestsellers, featured, all products, catch-alert banner.
- Catalog: search, category filter, availability + stock urgency.
- Product page: images, Tamil name, price + GST split, AI nutrition/benefit card, verified reviews, add to cart.
- Cart + floating cart: quantities, coupon, delivery vs pickup.
- Checkout: address book, map pin picker, distance-based delivery fee, delivery date + time window, COD / UPI deep link / card, server-side price recalculation (tamper-proof via `enforce_order_pricing` trigger).
- Orders: signed-in history + guest lookup by phone.
- Tracking: live status timeline, driver ETA, delivery PIN card, route map.
- Payment status page, settings (theme, language), terms, licence.
- Customer portal `/account`: own orders + delivery status, payments/refunds, saved addresses, wallet + referral code, reorder. Strictly own-data (RLS-scoped), no admin surface.

Admin / staff / driver
- Dashboard, Orders, Delivery (windows + assigned/past), Schedule (delivery windows), Driver map (mobile cards, Call/Navigate), POS (counter billing, scale weight, barcode), Products, Categories, Banners, Badges, Promotions, Customers, Complaints, Reviews, Broadcasts (catch alerts), Purchases (supplier POs), Suppliers, Waste (spoilage ledger), Reports, Payments (status, refunds, balances, CSV), Support chat, Staff onboarding (creates driver/staff logins), Settings (store, hours, delivery, GST, UPI, gateway keys, printer, SEO).
- Role isolation: admin (all), staff (orders/delivery/products/customers), driver (map + own orders only), crew board.

Backend
- Postgres with RLS on every table, role table + `has_role()`/`is_admin()`/`is_staff()`, delivery PIN verification with attempt lock + audited admin bypass, COD driver cash settlement ledger with atomic locking, wallet/referrals, loyalty, subscriptions, function bookings, Stripe checkout + webhook, AI nutrition generation, MCP agent integration, thermal printer, tax invoice PDF, supplier ledger PDF, route optimizer.

## 2. Cost to build this from scratch (India, INR)

| Track | Effort | Agency rate |
|---|---|---|
| Product/UX design | 3–4 weeks | ₹1.5–2.5L |
| Storefront + PWA + customer portal | 7–9 weeks | ₹5–7L |
| Admin + POS + reports + settlements | 9–11 weeks | ₹7–10L |
| Backend, RLS, roles, security hardening | 5–7 weeks | ₹4–6L |
| Payments, refunds, driver settlements | 3–4 weeks | ₹2–3L |
| Delivery, PIN, maps, routing, tracking | 3–4 weeks | ₹2–3L |
| AI nutrition, MCP agent, SEO, emails | 2–3 weeks | ₹1.5–2.5L |
| QA, deploy, docs, white-label setup | 3–4 weeks | ₹2–2.5L |

Total realistic build cost: **₹25–37 lakh** with a mid-tier Indian agency (7–9 months, 4–5 people). Freelance team: ₹10–16L. Top-tier product studio: ₹50L+.
Running cost: ₹3,000–15,000/month (hosting, database, maps, SMS/WhatsApp) plus payment fees.
Sale value as a white-label product: ₹50,000–2,00,000 per client licence, or ₹4,000–10,000/month SaaS.

## 3. Competitive position

Versus Licious / FreshToHome / TenderCuts: they win on supply chain and brand, not software. This app already matches their storefront and beats their franchise tooling (POS, driver cash settlement, waste ledger, catch alerts are absent in those consumer apps).
Versus local-shop builders (Dukaan, Shopify, generic builders): those have no fish-specific weight/GST handling, no harbour catch alerts, no driver cash settlement, no delivery PIN, no spoilage register, no MCP agent access.
Real edge: this is a **complete shop operating system**, not just a store — storefront + POS + logistics + finance + AI, in one codebase.

## 4. Unique features (rare or absent elsewhere)

- Delivery PIN handover with attempt lock and audited admin bypass.
- Driver cash settlement ledger with atomic locking (no double settlement).
- Harbour catch broadcast alerts tied to today's stock.
- Waste/spoilage register with cost loss — fresh-food specific.
- Server-enforced pricing: totals recomputed from the database on every customer order (`enforce_order_pricing` trigger).
- MCP agent access so AI assistants can browse catalogue and track a customer's own order.
- Thermal printer + POS with scale weight and barcode — rare in D2C fresh-food apps.
- Tri-lingual UI (English/Tamil/Hindi) with per-product AI nutrition cards.

## 5. Wow features

Live driver map with route, AI nutrition/benefit cards per fish, thermal printer + POS with scale weight, referral wallet with cashback, one-tap WhatsApp order flow, tri-lingual UI, PWA install, offline banner, customer portal with reorder, tax invoice PDF with GSTIN, supplier ledger PDF, route optimizer, social campaign hub.

## 6. Weak areas to improve (worst features)

- No real push notifications yet (FCM half-wired) — status updates rely on the app being open.
- Email notifications not live (needs a sender address / sending domain).
- No inventory auto-deduction per order; stock is manual (`deduct_order_stock_atomic` exists but is not wired into the order flow).
- Reports are basic — no profit per product, no cohort or repeat-rate view.
- No customer support chat; complaints only (support chat widget exists but conversations aren't fully live).
- No A/B or campaign tooling; promotions are manual codes (SocialCampaignHub exists but is limited).
- No invoice PDF generation wired to the customer email flow.

## 7. Required features before selling to clients

1. Push notifications — finish FCM wiring so order status updates reach the customer.
2. Order confirmation + status emails — needs a sending domain/sender address.
3. Automatic stock deduction per order — wire `deduct_order_stock_atomic` into checkout and restore on cancel.
4. Invoice PDF with GSTIN attached to the order email.
5. Data export/backup per client.
6. Onboarding wizard for new clients.
7. Signed licence/terms page (licence route exists; needs per-client legal copy).
8. Live payment keys walkthrough + go-live checklist.

## 8. Multi-client white-label — feasibility

Yes, and the project is already half-way there (`src/lib/tenant.ts`, `.env.example`, `new_client_master_seed.sql`, `DEPLOY_CLIENT_GUIDE.md`).
One codebase, one Git repository. Each client gets their own deployment with their own environment values — their own database account, domain, store name, logo, UPI and payment keys. Nothing is shared between clients except the code.
When you improve the app, you push once and every client deployment rebuilds from the same code, so all clients get the update on their own domain and data. Database structure changes must be applied per client via a versioned migration script (the master seed file is the starting point), with a per-client version marker and a rollback path.

## 9. Recommended next work (in order)

1. Wire automatic stock deduction into checkout (call `deduct_order_stock_atomic` on order creation, `restore_order_stock_atomic` on cancel/refund) and verify it on a real seeded-product order.
2. Finish FCM push notifications for order status changes.
3. Order confirmation + status emails once a sender address is provided.
4. Profit-per-product and repeat-rate reporting.
5. Live payment-key go-live checklist + end-to-end paid-order walkthrough using seeded products.

## Technical notes

- All customer-facing totals are enforced server-side by the `enforce_order_pricing` BEFORE INSERT trigger; client-submitted prices are ignored.
- Payment gateway credentials live in an admin-only `payment_gateway_credentials` table (RLS `is_admin()`), not in `store_settings`.
- Customer portal uses RLS-scoped reads on `orders`, `wallet_transactions`, `customer_addresses` — no new tables needed.
- Live Stripe charging additionally requires payment go-live completion, which is outside the admin screen.
