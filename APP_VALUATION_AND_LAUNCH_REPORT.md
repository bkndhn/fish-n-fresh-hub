# Fish N Fresh — Honest App Report

_Prepared 12 September 2026. Based on a direct inspection of the code and the live database, not estimates._

---

## 1. Is this a real app or a demo?

**It is real working software with demo content in it.**

What is genuinely real and working:

- Storefront, catalogue, product pages, cart, checkout, order tracking, customer account area
- 23 admin screens: orders, products, customers, promotions, delivery, schedule, driver map, counter billing, purchases, waste, expenses, reports, payments, staff, support, banners, badges, broadcasts, complaints, settings, onboarding, super admin
- Role separation that is enforced in the database, not just hidden in the menu
- Counter billing (POS) with weighing-scale support, barcode scanning, thermal receipt printing and reprint auditing
- Delivery PIN handover, driver cash settlement, atomic stock deduction and restoration
- GST tax invoices, profit & loss, expense tracking, multi-branch stock isolation

What is still demo or unfinished:

| Area | State |
| --- | --- |
| Products (14 items) | Demo catalogue with stock-photo images |
| Store name, address, phone | Still placeholder ("Fish N Fresh", "Harbour Road, Chennai") |
| GST number | Not entered |
| Payment gateway | Sandbox only — no live keys, cannot charge a real card today |
| Customer emails | Blocked — sending domain not verified |
| Orders (4) | Test orders, one paid counter sale |

---

## 2. What would it cost to build from scratch, in INR?

Measured scope: roughly 71,000 lines of application code, 40+ database tables, 20+ database functions, 134 automated tests.

| Who builds it | Realistic cost |
| --- | --- |
| Solo freelancer (6–9 months) | ₹10,00,000 – ₹16,00,000 |
| Small studio (3–4 people, 4–5 months) | ₹18,00,000 – ₹30,00,000 |
| Established agency with PM + QA | ₹30,00,000 – ₹45,00,000 |

---

## 3. The ₹90 lakh question

**₹90 lakh is not real.** Nothing in this app supports that number.

Here is the honest breakdown of the three different "values" people confuse:

1. **Rebuild cost** — ₹10L to ₹45L depending on who builds it. This is what it would cost *someone else* to recreate. It is not what you can sell it for.
2. **Code sale value today** — ₹60,000 to ₹1,50,000 for a one-time sale of the source. A buyer pays to skip 4 months of work, nothing more, because there are no customers attached.
3. **Business value** — ₹30L+ becomes real only when shops are paying you every month. Roughly: 20 shops × ₹4,000/month = ₹9.6L a year, and software businesses sell for 3–4× annual revenue. That is the only path to a crore-scale number.

### Why the ₹10k "vibe coder" apps are not the same thing

They sell a catalogue plus a cart plus a WhatsApp order button. This app additionally has:

- Multi-branch stock with per-branch staff isolation
- Counter billing with weighing scale, barcode, cash drawer and thermal printing
- Driver cash settlement and reconciliation with an audit trail
- Delivery PIN verification with brute-force lockout
- GST-compliant invoices, HSN handling, P&L and expense reporting
- Batch and cold-chain tracking with expiry
- Nine distinct staff roles enforced at the database level

A ₹10k app is a shopfront. This is a shop management system. But scope alone does not create value — **customers do**.

### Recommended pricing for you

- One-time white-label per client: ₹40,000 – ₹1,00,000 setup
- Monthly: ₹2,000 – ₹6,000 per shop (hosting, support, updates)
- Do not quote lakhs to a single fish shop; quote lakhs only to a chain with 5+ outlets.

---

## 4. How it compares to competitors

| Capability | Licious / FreshToHome | Zepto-style grocery | Typical ₹10k local app | **This app** |
| --- | --- | --- | --- | --- |
| Online ordering | Yes | Yes | Yes | Yes |
| Weight-based fish pricing with cutting styles | Yes | No | Rare | Yes |
| In-shop counter billing | No (not sold to shops) | No | No | Yes |
| Driver cash reconciliation | Internal only | Internal only | No | Yes |
| Delivery PIN handover | No | Partly | No | Yes |
| Batch / cold-chain / expiry tracking | Internal only | No | No | Yes |
| Multi-branch with per-branch staff | Internal only | Internal only | No | Yes |
| GST invoice + P&L + expenses | No | No | No | Yes |
| Sold to independent shops | No | No | Yes | Yes |

The real positioning: Licious and Zepto are competitors to *your client*, not to you. Your competition is the ₹10k app builder and generic POS software — and against both, this wins on depth.

---

## 5. Genuinely unique features

Things that are rare or absent in comparable shop apps:

1. **Delivery PIN with lockout** — customer reads a 4-digit code from their tracking screen, driver enters it, order only closes then. Five wrong attempts locks it and needs an owner override with a written reason.
2. **Driver cash settlement ledger** — end-of-day reconciliation of what each driver collected in cash versus handed over, with a locked, non-editable settlement record.
3. **Weighing scale integration** — live weight capture at the counter, with auto-stabilisation, so fish is billed on actual weight, not guessed.
4. **Batch and cold-chain records** — catch date, harbour, boat number, storage temperature and shelf life per batch.
5. **Agent integration** — the app exposes its own tools so an AI assistant can list products and check order status on a customer's behalf. Almost no shop app has this.

---

## 6. Wow features

- One-tap GST tax invoice PDF from any order
- Thermal receipt printing with cash drawer kick and reprint counting (anti-theft)
- Live driver map with route optimisation
- Profit & loss with expenses, wastage and purchase cost in one view
- Barcode and PLU quick codes at the counter
- Multi-language product benefit cards (English, Tamil, Hindi)
- Super admin governance with forced logout and audit logging

---

## 7. Weakest features (be honest with clients about these)

1. **Email notifications do not work yet** — no verified sending domain, so customers get no order confirmation.
2. **Payments are sandbox only** — no real money can be taken today.
3. **No native mobile app** — it is an installable web app; good, but not an App Store listing.
4. **Demo catalogue** — 14 stock-photo items that must be replaced per client.
5. **Too many admin screens** — 23 pages is overwhelming for a small shop owner; needs a simplified mode.
6. **No customer-facing ratings flow prompt** — reviews exist but nothing asks for them after delivery.
7. **No automated onboarding for a new client** — setting up a new shop is still manual work by you.

---

## 8. Required before launch

**Blocking (you must supply):**

- Real store name, address, phone
- GST number and FSSAI licence number
- Live payment gateway keys
- A verified email sending domain

**Blocking (development):**

- Cash-on-delivery orders must be marked paid on delivery — two delivered orders are still showing unpaid
- Replace demo products with the client's real items and photos

**Strongly recommended:**

- Simplified "shop owner" view that hides the advanced screens
- Post-delivery review prompt
- A written client onboarding checklist

---

## 9. Launch verdict

**Do not onboard several clients and fix bugs as they report them.** That burns the relationships you need most.

Recommended sequence:

1. Finish the code cleanup and the fixes listed above.
2. Set up one real shop — ideally someone patient — on sandbox payments for two weeks.
3. Fix what that real usage exposes.
4. Switch on live payments and email, then onboard the rest.

The software is close. The business setup around it is what is not ready.
