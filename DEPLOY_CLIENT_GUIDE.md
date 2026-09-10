# Multi-Client Deployment Guide: Custom Domain & Independent Supabase

This guide outlines how to deploy the Fish N Fresh Hub engine for a client on their own custom domain (e.g. `www.oceancatch.in` or `store.clientdomain.com`) with their own independent Supabase backend.

---

## Architecture Overview

```
                        ┌───────────────────────────────────────────┐
                        │   Central GitHub Repository ("main")     │
                        │   (You push updates here once)            │
                        └─────────────────────┬─────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       ┌─────────────────────────┐                         ┌─────────────────────────┐
       │     Client 1: Chennai   │                         │     Client 2: Cochin    │
       │   Domain: fishchennai.in│                         │   Domain: keralafresh.in│
       │   Supabase: Client 1 DB │                         │   Supabase: Client 2 DB │
       │   Stripe: Client 1 Keys │                         │   Stripe: Client 2 Keys │
       └─────────────────────────┘                         └─────────────────────────┘
```

When you improve or add features in this repository, **all client deployments receive the updates instantly** via standard CI/CD deployment without any code fork.

---

## Step 1: Initialize Client Supabase Backend (2 Minutes)

1. Create a new project on [Supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase dashboard.
3. Open [`supabase/client_bootstrap.sql`](file:///C:/Users/USER/.gemini/antigravity/scratch/fish-n-fresh-hub/supabase/client_bootstrap.sql) in this repository.
4. Paste the entire SQL into the Supabase editor and click **Run**.
5. Your client's backend is now fully provisioned with:
   - Complete tables (`products`, `orders`, `customer_addresses`, `customer_wallets`, etc.).
   - Secure Row-Level Security (RLS) isolating customer data.
   - 10 authentic real coastal seafood items with market prices and photos.

---

## Step 2: Configure Environment Variables

Copy [`.env.client.template`](file:///C:/Users/USER/.gemini/antigravity/scratch/fish-n-fresh-hub/.env.client.template) to `.env` or paste into your hosting provider's environment settings:

| Variable | Source | Description |
| :--- | :--- | :--- |
| `VITE_STORE_NAME` | Client | e.g. "Ocean Fresh Catch" |
| `VITE_SUPABASE_URL` | Supabase Dashboard -> API | Client's project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard -> API | Client's anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard -> API | Client's secret service role key (Server only) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard -> API Keys | `pk_test_...` or `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard -> API Keys | `sk_test_...` or `sk_live_...` |
| `VITE_UPI_ID` | Client's Bank Account | e.g. `store@okhdfcbank` |
| `RESEND_API_KEY` | Resend.com | (Optional) For real order confirmation & delivery emails |

---

## Step 3: Deploy to Cloudflare Pages or Vercel

### Option A: Cloudflare Pages (Recommended - Zero Server Cost)
1. In Cloudflare Dashboard, go to **Workers & Pages** -> **Create Application** -> **Pages**.
2. Connect your GitHub repository.
3. Build Settings:
   - **Framework Preset**: None (or Vite)
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `.output/public`
4. Add the Environment Variables from Step 2.
5. Click **Save and Deploy**.
6. In **Custom Domains**, add your client's domain (e.g. `www.fishstore.in`) and follow Cloudflare's 1-click DNS instructions with free SSL.

### Option B: Vercel / Netlify
1. Import repository into Vercel.
2. Output Directory: `.output/public` (or leave default Vite configuration).
3. Paste Environment Variables.
4. Assign Custom Domain.

---

## Step 4: Verification Checklist

- [ ] Open Storefront at custom domain.
- [ ] Sign up as a new customer via `/auth`.
- [ ] Add a delivery address in `/account`.
- [ ] Add an item to cart and checkout via Card / Stripe.
- [ ] Check `/payment-status` confirms payment received.
- [ ] Check `/account` displays **only that customer's order and delivery status**.
- [ ] Log in as Admin and confirm payment appears in `/admin/payments`.
