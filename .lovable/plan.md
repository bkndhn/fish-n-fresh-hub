# Bulk orders, mobile fixes, printer connectivity — plus your questions answered

## 1. Bulk order test run (wholesale price list)

Set bulk rates on a few items, place a bulk order from a trade account, and confirm the order lands at the bulk price and can be marked delivered from the admin orders screen. I will run this end to end in the app and report the prices seen at each step (cart, saved order, admin view).

## 2. Bulk-quantity discount rules

Today each item can have a flat bulk rate plus quantity slabs. Adding order-level rules so a whole basket earns a discount:

- Per item: keep the existing slabs (from X kg, price Y).
- New per-buyer / per-store rules: discount bands by order value (for example 5% over 10,000, 8% over 25,000), plus a minimum bulk order value.
- The price is always recalculated on the server when the order is saved, so a buyer cannot send a cheaper price from their phone.
- The trade buyer sees the applied band and how much more to add for the next band.

## 3. Mobile layout fixes (things spilling off the screen)

- Quick Refill on the products page: widths tied to the actual screen, no fixed pixel widths, long names wrapped.
- Past-orders views everywhere (customer account, orders page, admin order cards, reports): item rows, totals and long addresses wrapped instead of pushing the page sideways.
- Sweep the whole app for the same pattern (wide tables, fixed-width rows, long unbroken text) and fix each one; check at 320, 360, 390 and 430 px wide.

## 4. Printer connectivity (Bluetooth and others)

Known causes I will fix:

- Inside the Lovable preview window, phone Bluetooth is blocked by the browser. It has to be enabled explicitly, and on the published site it must be opened over a secure address in Chrome on Android. I will enable it and add a clear on-screen message when the phone or browser cannot support it.
- The connect step only looks at a fixed list of printer services, so many common 58mm/80mm printers pair but then report "no writable characteristic". I will widen the service discovery and fall back correctly.
- Data is sent in one style only; some printers need small chunks and the no-response write mode. I will send in safe chunk sizes with the correct mode and retry.
- Dropped connections are not detected, so the next print silently fails. I will watch for disconnects, reconnect automatically, and show connection status.
- A "Test print" button on the printer screen that reports exactly what failed.
- Keep USB/serial, network IP and normal browser printing working as fallbacks, with the right one offered per device.

## 5. Your questions

**App value (INR).** Rebuilding this from scratch: roughly ₹18–30 lakh of work. Selling the code once: ₹60,000–₹1.5 lakh. As a white-label service: ₹40,000–₹1 lakh setup per shop plus ₹2,000–₹6,000 a month. It is only worth ₹30 lakh+ as a running business with paying shops on it, not as code alone.

**Moving off Lovable Cloud to your own Supabase.** Yes. The app already talks to a standard Supabase backend, and the repo has a one-file setup script plus a settings template for exactly this. It is not literally one click: create the project, run the setup script, paste the keys. About 10–15 minutes per client, and the same code then serves every client.

**Lovable Cloud costs and free limits.** Cloud bills through your Lovable credits rather than a separate bill, and the backend it runs on has these practical free ceilings: 500 MB database, 1 GB file storage, 5 GB monthly traffic, 50,000 monthly active signed-in users, and projects that get no traffic for a week are paused until reopened. For a single fish shop, storage for product photos and monthly traffic are what you would hit first; a busy multi-shop setup crosses the database and traffic limits and moves to paid tiers.

## Technical notes

- New migration: order-value discount bands on `wholesale_accounts` (or a small `wholesale_discount_rules` table), applied inside the existing `enforce_order_pricing()` trigger so server-side pricing stays authoritative.
- Web Bluetooth needs `allow="bluetooth"` on the preview frame, a secure origin, and a user gesture; GATT discovery must request services not in the optional list via `getPrimaryServices()` fallback; writes chunked to 20 bytes with `writeWithoutResponse` preferred, plus `gattserverdisconnected` handling in `src/lib/thermalPrinter.ts`.
- Responsive pass: replace fixed `min-w-[...]`/`w-[...]` with fluid widths, add `min-w-0` + `break-words` on flex children, keep wide tables in bounded scroll containers.
