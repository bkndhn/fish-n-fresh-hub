# Fish N Fresh — Phase 1: Storefront + Full Admin

A mobile-first seafood ordering PWA with a real backend: catalog, cart, checkout (COD + UPI), live order tracking, loyalty, reviews, and the complete admin suite.

## Stack note

This project runs on TanStack Start (TanStack Router + server functions), not Vite + react-router-dom. Every feature in the brief is kept; routing uses file-based routes and data access uses Lovable Cloud (Postgres + Auth + Storage + Realtime + RLS). Tailwind, shadcn/ui, lucide, framer-motion, recharts, react-leaflet, date-fns, jspdf/html2canvas are used as specified.

## What Phase 1 delivers

**Backend**
- Full schema: `profiles`, `products`, `categories`, `branches`, `orders`, `promotions`, `store_settings`, `banners`, `reviews`, `loyalty_accounts`, `order_templates`, `function_bookings`, `subscriptions`.
- RLS on every table per the brief (public read for catalog/settings/banners/reviews; admin-only writes; owner-scoped rows for templates and subscriptions; role checks through a separate `user_roles` table + `has_role()` function rather than a role column, so role changes can't be self-granted).
- Storage buckets: `products`, `reviews`, `posters`, `logos` (public read, authenticated/admin write).
- Realtime enabled on `orders`, `reviews`, `subscriptions`, `products`.
- Indexes on order phone/status/date, product category, review product, subscription due date.
- Seed migration: store settings singleton, 6 categories, ~14 seafood products with images, 2 branches, 3 promotions, sample banners, a few demo orders and reviews.

**Auth**
- Email/password with verification, password reset, Google sign-in.
- Signup captures name + phone into `profiles`.
- Protected customer routes and role-gated admin routes (admin / staff / driver allow-lists).

**Storefront**
- `/` home — banner carousel, hero, pincode serviceability check, trust badges, categories, best sellers, featured, all products; every section toggleable from settings.
- `/catalog` — search + Tamil-first voice search, category chips, sort, URL-driven filters.
- `/product/:id` — gallery, nutrition card, quality & traceability badges, portion calculator, recipe section, reviews with photo upload and verified badges, related products.
- `/cart` — quantity controls, free-delivery progress, save-as-template, clear cart.
- `/checkout` — delivery vs pickup, branch selector, date + slot picker, address with geolocation and draggable Leaflet picker, reverse-geocoded pincode, coupons + auto promotions, GST, delivery-radius/holiday/lunch checks, duplicate-order guard, COD or UPI, loyalty award, referral capture, WhatsApp order message.
- `/order-success` — UPI deep link, WhatsApp send, tracking link.
- `/orders` — phone-based history with realtime updates, reorder, share.
- `/track/:id` — Leaflet map with store/destination/animated driver, ETA card, status timeline, invoice download after delivery.
- `/account` — profile, loyalty tier + points, refer & earn card, theme switch, delete account.
- `/subscriptions` — create auto-delivery from cart, pause/resume/cancel.
- `/driver` — map of pending deliveries with status updates.
- `/prebook`, `/pricelist/:id`, `/terms`, `/privacy`, `/refund`, `/contact`.

**Admin**
- `/admin` dashboard — revenue/orders/pending/products stats, revenue chart, status pie, top products, recent orders, low-stock and new-review alerts (realtime).
- Products, Orders (status transitions with stock adjust, driver assign, bulk print/invoice, CSV export, realtime), Categories, Branches, Calendar, Promotions, Customers (CRM by phone, drawer with history, referral bonus grant), Bulk Orders, Reviews moderation, Banners, Reports, Analytics, Subscriptions (incl. "generate today's orders"), Staff, Settings.
- Collapsible desktop sidebar, mobile drawer + bottom nav, role-filtered navigation, branch selector.

**Payments & comms (Phase 1)**
- COD and native `upi://pay` deep link.
- WhatsApp order messages via `wa.me`.
- Stripe, transactional email, and AI features are deferred to Phase 2.

**PWA & platform**
- Manifest, service worker app-shell cache, install prompt, dynamic app icon from store logo.
- English + Tamil language provider with switcher; abandoned-cart reminder after 1h.
- Safe-area insets, no rubber-banding, chrome text-select disabled, content selectable.

**Design system**
- Ocean palette as semantic tokens (`--primary` #0c6ca8, `--accent` #15b3a0), light/dark sets, Plus Jakarta Sans headings + Inter body, `--radius: 1rem`, `.ocean-gradient` / `.glass` / safe-area utilities. Admin `primary_color` / `accent_color` override the tokens at runtime. No hardcoded colors in components.

## Deferred to Phase 2

Stripe Checkout + webhook, transactional email, AI poster generation, AI storefront chat assistant, the 51-theme poster/price-list generators, deeper analytics, and native push. The Posters and Price List admin pages ship in Phase 1 as manual (upload/compose) tools so navigation is complete; AI generation lands in Phase 2.

## Technical approach

- Schema and seed data go in migrations (schema + literal INSERTs), never seeded at page load.
- Reads: public catalog data through public server functions using the publishable key with narrow anon SELECT policies; user-scoped data through authenticated server functions with RLS applied as the user.
- Route loaders prime TanStack Query (`ensureQueryData`) and components read with `useSuspenseQuery`; mutations invalidate keys.
- Protected pages live under `_authenticated/`; public shareable pages stay top-level with their own `head()` metadata.
- Leaflet, the Web Speech API, and PDF generation are loaded client-only to keep SSR clean.
- Roles resolved server-side via `has_role()`; admin route guards are UX only, every admin server function re-checks the role.
- Each route file gets unique title/description/OG metadata.

## Build order

1. Enable Lovable Cloud, run schema + RLS + storage + realtime + seed migrations.
2. Design tokens, layout shell, contexts (settings, cart, language, branch).
3. Auth pages and route guards.
4. Storefront: home → catalog → product → cart → checkout → success → orders → track → account.
5. Subscriptions, driver, prebook, legal, contact.
6. Admin layout + all admin pages.
7. Realtime wiring, invoices/labels/CSV exports, PWA, i18n, polish.
