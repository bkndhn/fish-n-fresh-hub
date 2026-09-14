# Finish the cleanup, then the launch walkthrough and report

## Where things stand

The library and component files are now clean. About 70 code errors remain, almost all in page files — mainly the admin pages (support, schedule, purchases, reports, settings, delivery, driver), the shared app frame, checkout, order history, product page, account page and the payment callback.

Tests pass (134) and the preview builds.

## Plan

### 1. Clear the remaining errors
Work through the pages in three batches, running the checker after each so nothing regresses:
- Admin pages: support, schedule, purchases, reports, settings, delivery, driver, waste, promotions, counter billing
- Shared frame, checkout, order history, product page, account page
- Payment callback, sign-in consent page, one test file

Rules for the fixes: no behaviour changes, no hiding errors with loose types, and no inventing database fields — where a page reads a field the database does not have, either the field gets added properly or the page stops asking for it.

### 2. Re-verify the data layer
Re-check that every field the pages save actually exists in the database, so no save fails silently like the counter-billing one did.

### 3. Walk the Go-Live checklist
Open the checklist in admin and record the real state of each item, then drive a full order through the storefront in a test session: place it, pay it in test mode, move it through confirmed, packed, out for delivery and delivered using the delivery PIN, and confirm it lands correctly in the Payments report with the right total and balance.

Also settle the two delivered-but-unpaid orders: confirm whether cash-on-delivery orders are being marked paid on delivery, and fix it if not.

### 4. Bug sweep
Click through the storefront and every admin page on a phone-sized screen, capture anything broken, and split the findings into "blocks launch" and "can ship later".

### 5. Final report
Update the written report with the verified results: what is real versus demo, honest build cost in INR, competitor comparison, unique/wow/weak features, the must-have gaps, and a direct answer on the valuation question.

## What will still be blocked afterwards

These need you, not code:
- Real store name, address, phone, GST and FSSAI numbers
- Live payment keys (test mode works today; real cards cannot be charged)
- A verified email sending address, so customers get order confirmations
