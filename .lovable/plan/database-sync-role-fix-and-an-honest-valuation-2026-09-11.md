# Database sync + role fix, and an honest valuation

## What I checked first

Your three feature asks already exist in the app:

- Admin order tracking with status and delivery PIN — the Orders page shows every order's status, has a PIN verification step before an order can be marked delivered, and lets you move status forward.
- Customer portal — signed-in customers get their own page with their orders, delivery progress, tracking, past payments and refunds, saved addresses and wallet. No admin controls.
- Staff accounts — the Team page creates staff/driver logins with a password, and the admin menu is already filtered per role.

So the real work is not rebuilding those. It is fixing the mismatch below.

## The actual problem: four scripts never ran on the live database

You ran some SQL from another platform, and four newer scripts in the project were never applied. Live data confirms:

| Script (in project) | Status live | What is missing |
| --- | --- | --- |
| Multi-branch isolation | not applied | branch fields on branches/products/orders/team, branch access rules |
| Super-admin governance | not applied | tenant quota, revocation and audit-log tables, role-tamper protection |
| Universal retail fields | not applied | brand, model, warranty, variants, aisle fields on products |
| Expenses and profit isolation | not applied | the whole expenses table |

Consequences you can see today: the Expenses page and the profit report have no table to read or write, the Super Admin page has no tables behind it, and multi-branch screens read fields that do not exist.

Second, bigger issue: the roles list in the database only contains **admin, staff, driver, user**. The app menu and Team page offer **manager, cashier, inventory_manager, support_staff, super_admin**. Assigning any of those fails, so those people either get nothing or get shown the wrong menu.

## Plan

1. **Add the missing roles** to the database role list (manager, cashier, inventory_manager, support_staff, super_admin) so the Team page matches the app.
2. **Apply the four missing scripts** as one clean, re-runnable migration: expenses, governance tables, retail product fields, branch fields and branch-scoped access rules — each with proper permissions and access policies, matching what the pages actually read.
3. **Lock down staff permissions properly, on the server, not just in the menu.** Staff and support roles will be blocked from changing prices and from issuing refunds; admin and manager keep those. Today it is only the menu that hides them, which is not real protection.
4. **Re-verify end to end**: confirm every page's queries resolve against the live database (expenses, profit report, super admin, branches, products, team, orders, customer portal), then run the test suite and a build.
5. **Update the roadmap** with what is now closed and what is still open (customer email needs a sending domain; live card payment still untested).

### Technical notes

- One idempotent migration file, ordered: enum values, tables + GRANTs, RLS enable, policies, then column adds. Existing rows untouched; seeded products stay as they are.
- Price and refund restriction enforced in the database policies and in the server functions that write products and process refunds, so a staff login cannot bypass it through the API.
- No destructive statements: no drops, no deletes.

## Valuation — straight answer

**Is this a dummy app?** No. It is real, working software: real database, real logins with role separation, real order flow, counter billing, stock that moves by itself, delivery PIN, refunds, reports. What is *not* real yet: the catalogue is seeded demo produce, payments are in test mode, and customer email is not sending.

**Cost to build this from scratch in India, end to end**

| Who builds it | Realistic cost |
| --- | --- |
| Freelancer / small team | ₹10–16 lakh |
| Mid-tier agency | ₹25–37 lakh |
| Top-tier product studio | ₹50 lakh+ |

Running cost after launch: ₹3,000–15,000/month plus payment gateway fees.

**Is ₹90 lakh real?** No. ₹90 lakh is not defensible for this codebase, and neither was ₹30 lakh as a *sale price*. Those figures are **rebuild cost** — what an agency would charge to recreate it — not what someone will pay you for it today.

**What it is actually worth right now**

- Sold once, as code, to one buyer: ₹60,000 – ₹1,50,000
- White-label per client: ₹40,000 – ₹1,00,000 setup + ₹2,000 – ₹6,000/month
- As a business: if you run it as a subscription with 20+ paying shops, ₹30 lakh+ becomes a real number — because you are then selling revenue, not code.

**Why not ₹10,000 like the "vibe-coded" apps?** Those are single-screen storefronts: a product list, a cart, a WhatsApp order button. They have no role separation, no counter billing, no stock ledger, no delivery PIN, no refund audit, no multi-branch, no cold-chain traceability. This app has roughly 25 admin screens and a real permission model. It is genuinely two tiers above that — just not a proven product yet.

## Competition and features

**Where it beats the usual local-shop apps:** counter billing with a weighing scale and thermal printing in the same system as the website; stock that moves automatically on both channels; driver cash settlement; multi-branch; profit and waste reporting.

**Rare / nobody-else-has:** catch batch traceability (harbour, boat, catch date, cold-chain temperature, shelf life) shown to the customer; delivery PIN as anti-theft proof; harbour "fresh catch" broadcasts; assistant-ready tools so an AI agent can check orders.

**Wow features:** live order tracking with map, recurring fish subscriptions, wallet and referrals, AI nutrition benefits per fish, offline-capable counter billing, one-tap GST invoice.

**Weak spots:** demo catalogue instead of your real products; payments still in test mode; no customer email; too many admin screens for one shop owner to navigate; several screens overlap.

**Required before selling to anyone:** apply this database fix, real products and prices, live payment keys, a sending email domain, and one full order walked end to end on the live site.
