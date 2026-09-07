# Fish N Fresh Hub

Here's a complete, copy-paste-ready markdown prompt that rebuilds the entire Fish N Fresh app on a Supabase backend (Postgres + Auth + Storage + Realtime + RLS) with every feature intact.

````markdown
# Build "Fish N Fresh" — a Premium Seafood Ordering PWA (Supabase Backend)

Build a production-ready, mobile-first PWA: a seafood store with storefront, cart, checkout (COD + UPI + Stripe), real-time order tracking, admin dashboard, inventory, CRM/loyalty, referrals, subscriptions, reviews, posters, price-list generator, driver dashboard, AI assistant, multi-language + voice search, and PWA install. Use **React + Vite + Tailwind CSS + shadcn/ui (Radix)** for the frontend and **Supabase** (Postgres, Auth, Storage, Realtime, Row-Level Security) for the backend.

## 1. Mission & Goals
- Customers browse a seafood catalog, add to cart, place orders with delivery or pickup, pay via COD / UPI deep-link / Stripe, track orders live on a map, leave photo reviews, earn loyalty points, refer friends, and set up auto-delivery subscriptions.
- Admins manage products, orders, categories, branches, promotions, customers, reviews, banners, posters, price-lists, reports, staff, settings, and subscriptions.
- Drivers see a map of pending deliveries.
- Native-app feel in mobile WebViews (safe-area, no rubber-banding, disabled text selection on chrome), installable PWA, works offline (shell cache).

## 2. Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui (Radix primitives), lucide-react icons, react-router-dom, framer-motion, recharts, react-leaflet (OpenStreetMap), react-quill, @hello-pangea/dnd, date-fns, moment, react-markdown, jspdf + html2canvas (PDFs), canvas-confetti.
- **Backend:** Supabase (Postgres database, Auth, Storage, Realtime).
- **Payments:** Stripe Checkout (test mode) for online card/UPI; native `upi://` deep-link intent for direct UPI.
- **Comms:** WhatsApp via `wa.me` links (no API), Supabase Edge Function + Resend (or SMTP) for transactional email, OpenAI/Anthropic via edge function for AI poster generation + storefront chat assistant.
- **Voice:** Web Speech API (`webkitSpeechRecognition`, Tamil-first `ta-IN` / `en-IN`).
- **Maps:** react-leaflet + OpenStreetMap tiles + Nominatim geocoding/reverse-geocoding.

## 3. Design System & Theming
- Ocean-inspired palette via CSS custom properties mapped to Tailwind: `--primary` (#0c6ca8), `--accent` (#15b3a0), full light/dark token sets, `--font-heading` (Plus Jakarta Sans), `--font-body` (Inter), `--radius: 1rem`.
- Admin-configurable `primary_color` / `accent_color` override tokens live.
- Utilities: `.ocean-gradient`, `.glass`, `.safe-top/.safe-bottom` (env(safe-area-inset)), `.no-scrollbar`, `overscroll-behavior-y: none`, `-webkit-user-select:none` on buttons/icons, content text selectable.
- Responsive grids (2 cols mobile → 4 cols desktop), bottom nav for storefront + admin mobile, collapsible admin sidebar on desktop.

## 4. Supabase Setup
### Project
- Create a Supabase project. Enable Email auth + Google OAuth provider. Configure redirect URLs for published domain.
### Auth
- Email/password with email verification (OTP), password reset, Google OAuth.
- Roles via a `role` column on the `profiles` table (default `user`): `admin`, `staff`, `driver`, `user`.
- On signup capture `full_name`, `phone`; store in `profiles`.
- Protected routes redirect to `/login`; post-login redirect resolves a `returnTo` query param (fallback `/`).
### Storage Buckets
- `products` (public) for product images.
- `reviews` (public) for customer review photos.
- `posters` (public) for generated posters / price-list banners.
- `logos` (public) for store branding.
- Use Supabase Storage uploads from client (signed upload) for product images, review photos, banners.
### Realtime
- Enable realtime on `orders`, `reviews`, `subscriptions`, `products`. Subscribe via Supabase channels for live order status, review alerts, subscription updates.

## 5. Database Schema (Postgres tables + RLS)
Create these tables (all have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `created_by uuid references auth.users`). Add RLS policies as noted.

### profiles (extends auth.users, one row per user)
`id uuid pk references auth.users`, `full_name text`, `email text`, `phone text`, `role text default 'user'` (check in (admin,staff,driver,user)), `address text`, `created_at`.
RLS: read own or admin; update own or admin; only admin can set/change role (enforce via trigger/policy).

### products
`name text not null`, `name_tamil text`, `description text`, `price numeric not null`, `old_price numeric`, `unit text default 'kg'` (enum: kg,500g,250g,100g,piece,pack,litre,ml,dozen,bunch,box,tray,pair,combo), `category text`, `image_url text`, `stock numeric default 0`, `is_available boolean default true`, `origin text`, `rating numeric default 4.5`, `is_featured boolean default false`, `tags text[]`, `calories numeric`, `protein text`, `best_for text`, `benefits text[]`, `storage text`, `catch_date date`, `source_origin text`, `lab_tested boolean default false`, `traceability text`, `recipe_title text`, `recipe_steps text`, `branch_id uuid`.
RLS: public read; create/update/delete admin only.

### categories
`name text not null`, `slug text`, `image_url text`, `icon text`, `sort_order numeric default 0`.
RLS: public read; create/update/delete admin only.

### branches
`name text not null`, `address text`, `phone text`, `manager text`, `lat numeric`, `lng numeric`, `open_time text`, `close_time text`, `delivery_radius_km numeric default 0`, `is_active boolean default true`, `sort_order numeric default 0`.
RLS: public read; create/update/delete admin only.

### orders
`order_number text`, `customer_name text not null`, `customer_phone text not null`, `customer_email text`, `customer_address text`, `items jsonb default '[]'` (array of {product_id,name,price,quantity,unit,image_url}), `subtotal numeric default 0`, `delivery_fee numeric default 0`, `additional_charges numeric default 0`, `additional_charge_label text`, `discount numeric default 0`, `coupon_code text`, `promotion_id uuid`, `gst_amount numeric default 0`, `gst_percent numeric`, `total numeric default 0`, `status text default 'pending'` (enum: pending,confirmed,preparing,out_for_delivery,delivered,cancelled), `payment_method text default 'cod'` (cod,online), `fulfillment_type text default 'delivery'` (delivery,pickup), `delivery_date date`, `delivery_slot text`, `delivered_at timestamptz`, `location_lat numeric`, `location_lng numeric`, `map_link text`, `upi_paid boolean default false`, `whatsapp_sent boolean default false`, `driver_id uuid`, `driver_name text`, `notes text`, `cancel_reason text`, `branch_id uuid`, `branch_name text`, `referral_code text`.
RLS: public read (orders visible by phone lookup); create public; update: admin/staff/driver (driver only own assigned rows); delete admin only.

### promotions
`name text not null`, `type text default 'coupon'` (coupon,first_order,special_day), `code text`, `discount_type text default 'percent'` (percent,flat), `value numeric default 0`, `min_order numeric default 0`, `active boolean default true`, `valid_from date`, `valid_to date`, `special_day text`, `target_phone text`, `one_time_per_customer boolean default false`, `used_phones text[]`, `description text`.
RLS: public read; create/update/delete admin only.

### store_settings (singleton, one row)
`store_name text default 'Fish N Fresh'`, `tagline text`, `shop_logo text`, `open_time text`, `close_time text`, `lunch_start text`, `lunch_end text`, `block_during_lunch boolean default false`, `weekly_holidays text[]`, `holidays text`, `holiday_dates text[]`, `block_on_holidays boolean default false`, `whatsapp_number text`, `upi_id text`, `upi_name text default 'Fish N Fresh'`, `delivery_fee numeric default 40`, `free_delivery_over numeric default 500`, `min_order_value numeric default 0`, `delivery_radius_km numeric default 0`, `additional_charge_label text default 'Packing & Handling'`, `additional_charge_value numeric default 0`, `delivery_enabled boolean default true`, `pickup_enabled boolean default true`, `cod_enabled boolean default true`, `online_enabled boolean default true`, `store_address text`, `store_lat numeric`, `store_lng numeric`, `is_open boolean default true`, `announcement text`, `low_stock_threshold numeric default 10`, `primary_color text default '#0c6ca8'`, `accent_color text default '#15b3a0'`, `gst_enabled boolean default false`, `gst_percent numeric default 5`, `gstin text`, `footer_about text`, `contact_email text`, `contact_phone text`, `support_whatsapp text`, `address_line text`, `facebook_url text`, `instagram_url text`, `twitter_url text`, `terms_content text`, `privacy_content text`, `refund_content text`, `home_show_banner boolean default true`, `home_show_hero boolean default true`, `home_show_trust boolean default true`, `home_show_categories boolean default true`, `home_show_bestsellers boolean default true`, `home_show_featured boolean default true`, `home_show_allproducts boolean default true`, `serviceable_pincodes text[]`.
RLS: public read; create/update/delete admin only.

### banners
`title text not null`, `subtitle text`, `image_url text not null`, `link text`, `cta text`, `price_list text` (JSON), `active boolean default true`, `sort_order numeric default 0`.
RLS: public read; create/update/delete admin only.

### reviews
`product_id uuid not null`, `product_name text`, `order_id uuid`, `customer_name text`, `customer_phone text`, `rating numeric default 5`, `comment text`, `photo_url text`, `verified boolean default false`, `admin_reply text`, `active boolean default true`.
RLS: public read; create public (set `verified` server-side when reviewer has a delivered order for the product); update/delete admin only.

### loyalty_accounts
`phone text not null unique`, `name text`, `points numeric default 0`, `lifetime_points numeric default 0`, `total_spent numeric default 0`, `tier text default 'Bronze'` (Bronze,Silver,Gold,Platinum), `referral_code text`, `referred_by text`.
RLS: public read; create/update public (points updated on order placement); delete admin only.

### order_templates (per-user saved carts)
`name text not null`, `items jsonb default '[]'`.
RLS: read/update/delete own (`created_by = auth.uid()`); create own.

### function_bookings (bulk/event catering)
`customer_name text not null`, `customer_phone text not null`, `event_date date not null`, `event_type text`, `guest_count numeric default 0`, `items jsonb default '[]'`, `total_estimate numeric default 0`, `notes text`, `status text default 'new'` (new,confirmed,in_progress,completed,cancelled).
RLS: read own or admin/staff; update/delete admin only; create public.

### subscriptions (standing auto-delivery orders)
`customer_name text not null`, `customer_phone text not null`, `customer_address text`, `items jsonb default '[]'`, `frequency text default 'weekly'` (daily,alternate,weekly,monthly), `weekday numeric`, `next_delivery_date date not null`, `status text default 'active'` (active,paused,cancelled), `payment_method text default 'cod'` (cod,online), `fulfillment_type text default 'delivery'` (delivery,pickup), `notes text`.
RLS: read own or admin; create public; update own or admin; delete admin only.

### price_lists (price-list / poster banners, optional shared)
If you implement the price-list generator as stored data: `name text`, `config jsonb`, `image_url text`, `active boolean`. Otherwise keep as client-generated JSON stored on banners.

Add helpful indexes: `orders(customer_phone)`, `orders(status)`, `orders(created_at desc)`, `products(category)`, `reviews(product_id)`, `subscriptions(status, next_delivery_date)`.

## 6. Auth Flows & Guards
- **Register:** email+password+confirm → create `profiles` row (full_name, phone, address) → email OTP verification → verify → set session → redirect.
- **Login:** email+password or Google → resolve `returnTo` → redirect.
- **Forgot/Reset:** email → reset link → new password → redirect to login.
- **ProtectedRoute:** wrap authenticated routes; unauthenticated → `/login`.
- **AdminRoute:** role check (`admin`/`staff`/`driver` per page allow-list); unauthorized → `/admin`.
- Logout clears session + local cart/phone storage.

## 7. Storefront Pages & Features
### Home (`/`)
- Banner carousel (tappable → internal route or price-list view).
- Hero section.
- **Pincode serviceability checker** (6-digit; checks `serviceable_pincodes`, empty = radius at checkout).
- Trust badges row, categories row, best sellers (computed from order item aggregation), featured/today's catch, all-products grid.
- All sections toggleable via `home_show_*` settings.
### Catalog (`/catalog`)
- Search input + **voice search mic** (Web Speech API, `ta-IN` when Tamil selected else `en-IN`), category chips, sort (new/price/rating), URL-driven filters, responsive grid.
### Product Detail (`/product/:id`)
- Image, price/old-price, nutrition card (calories, protein, best_for, storage, benefits), **Quality & Source** badges (lab-tested, catch date, source origin, traceability), **Portion calculator** (guests → suggested qty with "Set qty"), **Recipe / Cook with this** section (title + steps), **Reviews** with photos + "Verified" badges (verified when reviewer has a delivered order for the product), review form with photo upload, related products.
### Cart (`/cart`)
- Quantity controls, free-delivery progress, order summary, save-as-template (named, per-user), "Auto-deliver this cart" link to subscriptions, clear cart.
### Checkout (`/checkout`)
- Sign-in gate. Fulfillment: delivery or pickup (respect toggles); branch selector; name/phone/email; delivery date + time-slot picker; address textarea + **geolocation capture** + **draggable Leaflet location picker** + reverse-geocode to pincode; manual pincode; notes.
- Payment: COD / Online (UPI/Stripe), respect toggles.
- Coupons (code, target_phone, one-time-per-customer, min_order) + auto promotions (first_order, special_day MM-DD or YYYY-MM-DD).
- Totals: subtotal, delivery fee (free over threshold), additional charges, GST (if enabled), discount, total.
- Duplicate-order guard (identical order within 2 min). Holiday/lunch-block checks. Delivery-radius check (haversine from shop coords).
- On place: insert order, **award loyalty points** (1 pt / ₹100, tier recompute, stamp `referral_code = FNF + last6 of phone`), send order-placed email, mark one-time coupon used, **WhatsApp order** (formatted message via `wa.me`), or **Stripe Checkout** redirect (iframe-blocked), or COD → order-success.
- Capture `?ref=` referral from localStorage onto `orders.referral_code` (skip if equals own code).
### Order Success (`/order-success?id=`)
- Success card, itemized total, **UPI pay** (`upi://pay?pa=&pn=&am=&cu=INR&tn=`) for online orders, **WhatsApp send** button, address/contact, track + continue-shopping.
### My Orders (`/orders`)
- List by phone; real-time updates; reorder; share via WhatsApp/native share.
### Track Order (`/track/:id`)
- Live Leaflet map (store 🐟, destination 🏠, animated driver 🛵 along store→dest by status progress), **ETA card** (status-based estimate, "updates automatically"), status timeline, driver + address cards, items, invoice download (enabled after delivered).
### Account (`/account`)
- Profile card, loyalty points + lifetime/total spent, **Refer & earn** card (referral code `FNF+last6`, copyable `?ref=` link, tier perks grid Bronze→Platinum), order-history lookup by phone, menu (My Orders, Subscriptions, Admin Dashboard, Driver Dashboard by role), theme switch (light/dark/auto), delete-account dialog.
### Subscriptions (`/subscriptions`)
- Sign-in gate. Create auto-delivery from current cart (frequency + first delivery date + customer info from saved checkout). List own subscriptions with pause/resume/cancel. Per-delivery billing (COD/UPI) — no auto-charge.
### Driver (`/driver`)
- Map of all pending/out-for-delivery orders geocoded and plotted; assignment; status updates.
### Prebook (`/prebook`)
- Function/bulk booking request form (event type, date, guest count, items, estimate) → `function_bookings`.
### Price List View (`/pricelist/:id`)
- Render a stored price-list (from banner) with themed layout.
### Legal (`/terms`,`/privacy`,`/refund`,`/contact`)
- Dynamic content from settings; Contact Us with tap-to-call, WhatsApp, email, directions (store coords), hours, native share.

## 8. Admin Pages (role-guarded)
- **Dashboard** (`/admin`): stat cards (revenue, orders, pending, products), revenue area chart, order-status pie, top products, recent orders, low-stock alerts, new-review alerts (real-time toast).
- **Products** (`/admin/products`): CRUD with all fields incl. quality/traceability + recipe editor, branch scoping, image upload, stock, featured, availability.
- **Orders** (`/admin/orders`): filter by status/date/branch, status transitions (reduce stock on confirm, restore on cancel), driver assignment, branch reassign, bulk print/label/invoice, CSV export, real-time subscription, cancel with reason.
- **Categories**, **Branches**, **Calendar** (orders/functions timeline).
- **Promotions** (`/admin/promotions`): coupons, first-order, special-day; discount type/value/min_order/validity/target_phone/one-time.
- **Customers** (`/admin/customers`): CRM aggregated by phone (spent, count, last order, address), date filter, CSV/PDF export, customer drawer with order history, invoices, labels, **referral badge + "Grant referral bonus"** (adds 50 pts to referrer's loyalty account, recomputes tier).
- **Bulk Orders** (`/admin/functions`): function booking management.
- **Reviews** (`/admin/reviews`): moderation, active toggle, admin reply, verified badge, photo.
- **Banners** (`/admin/banners`): CRUD, sort order, attach price-list JSON.
- **Reports** (`/admin/reports`): revenue line chart (chronological), category revenue, status distribution, detailed order table, CSV/PDF export, bulk invoices.
- **Analytics** (`/admin/analytics`): deeper charts.
- **Posters** (`/admin/posters`): AI image generation (detailed product/promo/theme prompt), 51 theme presets, custom headline, product filter, real-time preview, pagination, **native social share** (Web Share API with file) + download, WhatsApp/Instagram/link share.
- **Price List** (`/admin/price-list`): banner/poster generator with 51 themes, unlimited custom colors, batch select/deselect, top/bottom text + layout controls, image pagination, "add to slideshow".
- **Staff** (`/admin/staff`): invite users (admin/user/driver/staff roles) via Supabase admin invite.
- **Subscriptions** (`/admin/subscriptions`): list all standing orders, status filters, "due today" count, **"Generate today's orders"** (creates real `orders` rows for active subscriptions whose `next_delivery_date = today`, then advances each by frequency), pause/resume/cancel.
- **Settings** (`/admin/settings`): branding (logo, name, tagline, colors), store status, hours + lunch/holiday blocking, **home-page section visibility toggles**, payment toggles, delivery params + **serviceable pincodes**, GST, footer/contact/social, legal content editors, shop location picker, theme presets.
- Admin layout: collapsible desktop sidebar + mobile drawer + mobile bottom nav; role-based nav filtering; branch selector.

## 9. Integrations / Edge Functions
- **Stripe Checkout** (edge function): create Stripe Checkout session for an order (amount in paise), `metadata.base44_app_id`/app id, success/cancel URLs, iframe-blocked on client, redirect to Stripe URL. Webhook endpoint to mark `upi_paid`/paid and update order status (store webhook secret in env).
- **Order Email** (edge function): transactional email on order placed/delivered (to registered user email or, with custom domain, non-registered).
- **AI Poster Generation** (edge function): prompt → image generation; return URL stored in posters bucket.
- **AI Storefront Chat Assistant** (edge function): answers order lookups/reorder help using product/order data; streamed or single-shot LLM call.
- **appIcon** (edge function/route): serve store logo as dynamic PWA icon.
- **Native UPI** (`upi://pay?pa=<upi_id>&pn=<upi_name>&am=<total>&cu=INR&tn=<order#>`) — client-side deep link.
- **WhatsApp** (`https://wa.me/<number>?text=<encoded formatted order message>`) — include items, totals, address, delivery date/slot, GST, payment, referral code, confirm footer.
- **Maps/Geocoding:** Leaflet + OSM tiles + Nominatim reverse geocode (pincode extraction with zoom fallback).
- **Voice Search:** `webkitSpeechRecognition`, Tamil-first.
- **Abandoned Cart:** after 1h with cart, show in-app reminder + fire native Notification + WhatsApp-the-store button with cart contents.
- **Push:** optional native mobile push (requires native build + credentials) — not for web.

## 10. PWA
- `manifest.json` with name, short_name, theme/display color, icons (dynamic via appIcon), standalone display, start_url.
- Service worker caching the app shell for offline; install prompt component; "add to home screen" banner.
- Meta tags for SEO/Open Graph, favicon.

## 11. i18n
- Language provider (English + Tamil minimum), language switcher in header. Tamil-first voice search. All visible strings translatable; RTL-ready if more languages added.

## 12. Routing Map
```
/ /catalog /product/:id /cart /checkout /order-success /orders /track/:id /account /subscriptions /driver /prebook /pricelist/:id /terms /privacy /refund /contact
/login /register /forgot-password /reset-password
/admin /admin/products /admin/orders /admin/categories /admin/branches /admin/calendar /admin/promotions /admin/customers /admin/functions /admin/reviews /admin/banners /admin/reports /admin/analytics /admin/posters /admin/price-list /admin/staff /admin/subscriptions /admin/settings
```
404 fallback. ScrollToTop on route change.

## 13. Build Order
1. Scaffold Vite+React+Tailwind+shadcn; install all packages listed in §2.
2. Set up Supabase client (`@supabase/supabase-js`) with env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Run SQL: create all tables, triggers for `updated_at`, RLS policies, enable realtime; seed one `store_settings` row and sample categories/products.
4. Auth: profiles table + triggers, Google provider, protected/admin route guards, login/register/forgot/reset pages.
5. Settings context (load singleton settings), Cart context, Language context, Branch context.
6. Storefront pages (Home → Catalog → ProductDetail → Cart → Checkout → OrderSuccess → MyOrders → TrackOrder → Account → Subscriptions → Driver → Prebook → Legal).
7. Realtime subscriptions on orders/reviews/subscriptions.
8. Admin pages + layout + role nav.
9. Stripe edge function + webhook + UPI deep-link + WhatsApp message builder.
10. PDF invoice/label + CSV/PDF exporters.
11. Posters + price-list generator + AI functions.
12. PWA manifest/SW/install + appIcon.
13. Theming, responsive polish, safe-area, WebView tweaks.
14. Seed demo data; test full flows (order→track→deliver→invoice, subscribe→generate orders, refer→grant, review photo+verified).

## 14. Quality Bar
- Every button works, every flow finishes, content actually renders, loading/empty states on all data flows, no stubs.
- Mobile-first responsive; safe-area-aware; no rubber-banding; disabled text-select on chrome, enabled on content.
- Use shadcn components for all dropdowns/selects/dialogs; lucide icons only.
- Let errors bubble except user-facing auth/form flows which show inline errors.
- Keep components small (<50 lines), one component per file.

Deliver the complete app with all features above wired end-to-end on Supabase.
````

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52d32340-5acf-40d4-bdd1-ecd16194b1eb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
