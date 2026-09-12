# Developer Handover & Engineering Guide

Welcome to the **Universal Retail & Fresh Hub** codebase. This guide is written for software engineers, tech leads, and development teams taking ownership of this platform. It provides everything required to run, understand, customize, extend, and deploy the application with zero ambiguity.

---

## 1. 5-Minute Quickstart

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` LTS
- **Package Manager**: `npm` (v10+) or `bun`
- **Database**: Supabase PostgreSQL project (or local Supabase CLI)

### Installation Steps

```bash
# 1. Clone repository and navigate to folder
cd fish-n-fresh-hub

# 2. Install dependencies (frozen lockfile recommended)
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Verify test suite (134 isolated tests)
npx vitest run

# 5. Start local development server (with HMR & SSR)
npm run dev
```

Visit `http://localhost:3000` to open the storefront. Navigate to `/admin` to access the management console.

---

## 2. Codebase Directory Map

```text
fish-n-fresh-hub/
├── ARCHITECTURE.md                 # System topology, RLS security model, hardware architecture
├── DEVELOPER_HANDOVER_GUIDE.md     # This onboarding and developer manual
├── DATABASE_DICTIONARY.md          # Complete schema dictionary for all database tables & RPCs
├── API_AND_FUNCTIONS.md            # Catalog of server RPC functions & TanStack Query hooks
├── package.json                    # Project scripts and dependencies
├── tsconfig.json                   # Strict TypeScript compiler options
├── vite.config.ts                  # Vite 8 bundling & TanStack Start SSR configuration
├── vitest.config.ts                # Sub-second unit test runner setup
│
├── public/                         # Static assets, PWA icons, manifest, service worker
│   ├── manifest.json               # Web App Manifest for Android/iOS PWA installation
│   ├── sw.js                       # Service worker with offline caching & background sync
│   └── icons/                      # App icon assets (192px, 512px, apple-touch-icon)
│
├── src/
│   ├── routes/                     # TanStack Router file-based route tree
│   │   ├── __root.tsx              # Root HTML shell, realtime CDC subscriber, theme providers
│   │   ├── index.tsx               # Storefront homepage (banner carousel, categories, bestsellers)
│   │   ├── catalog.tsx             # Product discovery, multi-filter, search, price ranges
│   │   ├── product.$id.tsx         # Product detail view, portion weights, subscription modal
│   │   ├── cart.tsx                # Shopping cart with branch express SLA check
│   │   ├── checkout.tsx            # Multi-step checkout (Delivery/Pickup, COD/UPI/Card)
│   │   ├── orders.tsx              # Customer order history & live tracking entry
│   │   ├── track.$id.tsx           # Real-time driver GPS tracking & order status timeline
│   │   ├── auth.tsx                # Phone OTP / Email magic link authentication
│   │   │
│   │   └── _authenticated/         # Authenticated route guard layout
│   │       ├── route.tsx           # 0ms in-memory session user cache & auth redirects
│   │       ├── account.tsx         # Customer profile, saved addresses, active subscriptions
│   │       └── admin/              # Comprehensive Merchant Administration Console
│   │           ├── index.tsx       # Real-time analytics, revenue, orders & profit charts
│   │           ├── pos.tsx         # High-speed POS Counter, weighing scale & thermal receipt
│   │           ├── products.tsx    # Inventory catalog, bulk CSV import/export, barcode/PLU
│   │           ├── orders.tsx      # Order fulfillment lifecycle (accept, pack, assign driver)
│   │           ├── purchases.tsx   # Supplier procurement, raw material batches & buying costs
│   │           ├── waste.tsx       # Spoilage & shrinkage logs debited from gross profit
│   │           ├── expenses.tsx    # Operational expense tracking by branch & category
│   │           ├── reports.tsx     # Comprehensive P&L statement, GST report, CSV export
│   │           ├── delivery.tsx    # Driver dispatch, fleet allocation, live delivery board
│   │           ├── driver.tsx      # Real-time driver map with route lines & destination markers
│   │           ├── customers.tsx   # Customer ledger, lifetime value, suspension controls
│   │           ├── staff.tsx       # Staff roster, biometric/attendance PIN, role permissions
│   │           ├── super.tsx       # Super Admin governance & branch limit quota enforcement
│   │           └── settings.tsx    # Store configuration, logo, business vertical, hours
│   │
│   ├── components/                 # Reusable React UI component library
│   │   ├── admin/                  # Admin-specific modal dialogs, switchers, and widgets
│   │   │   ├── AdminBranchSwitcher.tsx  # Dynamic branch switcher for client admins
│   │   │   ├── AdminPnlReport.tsx       # Isolated branch and platform-wide P&L breakdown
│   │   │   ├── AdminShell.tsx           # Persistent responsive admin layout (0ms nav)
│   │   │   ├── BranchManagement.tsx     # Branch CRUD, operational geofence, and defaults
│   │   │   ├── CategoryManagement.tsx   # Category ordering, image upload & management
│   │   │   ├── DriverCashSettlementModal.tsx # Daily driver COD reconciliation
│   │   │   └── PosPastBillsModal.tsx    # Counter bill reprint & historical lookup
│   │   ├── layout/                 # Site layout chrome (Header, Footer, Bottom Nav)
│   │   └── ui/                     # Accessible Radix primitives (Button, Dialog, Sheet, etc.)
│   │
│   ├── lib/                        # Core business logic, hardware drivers, and utilities
│   │   ├── admin.ts                # Admin queries and role permissions
│   │   ├── branchContext.tsx       # Admin branch provider and selector state
│   │   ├── customerBranchContext.tsx # Customer delivery branch geofence provider
│   │   ├── format.ts               # Indian Rupee (`inr()`), weights, dates, IST timezone
│   │   ├── pnl.ts                  # P&L calculation engine, COGS, waste loss, margin math
│   │   ├── queries.ts              # TanStack Query options with 15-min tiered caching
│   │   ├── thermalPrinter.ts       # ESC/POS raw byte formatter & canvas rasterizer
│   │   ├── weighingScale.ts        # Web Serial/WebHID trade scale protocol parser
│   │   ├── retailCsv.ts            # CSV import/export parser for products and categories
│   │   └── types.ts                # TypeScript domain models and data contracts
│   │
│   └── __tests__/                  # Vitest automated test suites
│       ├── pnlAndExpenses.test.ts  # Isolated branch P&L and expense math verification
│       ├── weighingScale.test.ts   # Scale ASCII parser and auto-capture event tests
│       ├── multiBranchPhase*.test.ts # Branch isolation and super admin governance tests
│       └── universalPrinterAndMaps.test.ts # ESC/POS bytes & geographic routing tests
│
└── supabase/
    ├── migrations/                 # Sequential SQL migration files
    ├── client_bootstrap.sql        # Clean schema initialization for new client tenant
    └── consolidated_master_patch.sql # Complete master schema with all modern features
```

---

## 3. Coding Conventions & Standards

1. **Strict Type Safety**: Never use untyped `any` for business entities. Import types from `@/lib/types` or `@/integrations/supabase/types`.
2. **0ms Navigation Rule**:
   - Always use `<Link to="..." preload="intent">` for internal links.
   - Never perform remote network fetches in route `beforeLoad` hooks; use local session inspections via `supabase.auth.getSession()`.
   - Add explicit `staleTime` (e.g. `1000 * 60 * 10` to `15` mins) to frequently accessed TanStack Query hooks.
3. **Database Tenant Isolation**:
   - When querying tables that have `branch_id`, always pass the branch ID unless explicitly operating in platform-wide aggregate mode (`all`).
   - Any new table storing client or branch data must include Row Level Security (RLS) policies.

---

## 4. How-To Playbooks

### Playbook 1: How to Add a New Page/Route
TanStack Router automatically generates routes based on file paths under `src/routes/`:

```tsx
// src/routes/_authenticated/admin/my-new-feature.tsx
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/my-new-feature")({
  head: () => ({
    meta: [{ title: "My Feature | Admin Console" }],
  }),
  component: MyNewFeaturePage,
});

function MyNewFeaturePage() {
  return (
    <AdminShell title="My Feature" allow={["admin", "manager"]}>
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-bold">Feature Content</h2>
      </div>
    </AdminShell>
  );
}
```

Add the new route entry into the `NAV` array inside [`src/components/admin/AdminShell.tsx`](file:///C:/Users/USER/.gemini/antigravity/scratch/fish-n-fresh-hub/src/components/admin/AdminShell.tsx) with the required roles.

### Playbook 2: How to Add a New Server Function
TanStack Start uses type-safe RPC server functions defined with `createServerFn`:

```tsx
// src/lib/inventory.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const updateSafetyThreshold = createServerFn({ method: "POST" })
  .validator((data: { productId: string; threshold: number }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("products")
      .update({ low_stock_threshold: data.threshold })
      .eq("id", data.productId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
```

### Playbook 3: How to Test Hardware Without Physical Peripherals
You do not need a physical weighing scale or thermal printer to test the POS:
- **Weighing Scale Simulation**:
  - In `src/lib/weighingScale.ts`, call `simulateScaleWeight(1.450)` in developer mode to feed simulated ASCII packets into the state machine.
  - Run `npx vitest run src/__tests__/weighingScale.test.ts` to test continuous auto-capture algorithms.
- **ESC/POS Thermal Receipt Simulation**:
  - `src/lib/thermalPrinter.ts` includes a native HTML5 Canvas preview renderer. Selecting "Browser Dialog / Preview" in POS Printer Settings renders the exact 58mm/80mm receipt pixel-for-pixel on screen.

---

## 5. Environment Variables Reference

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client / SSR | Supabase Project URL (`https://xyz.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client / SSR | Supabase Anonymous / Publishable API Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Secret Service Role Key for elevated backend RPCs |
| `STRIPE_SECRET_KEY` | Server Only | Stripe secret API key for processing cards & refunds |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client Only | Stripe publishable key for Stripe Elements checkout |
| `FIREBASE_SERVER_KEY` | Server Only | FCM key for Web Push notifications to customer devices |

---

## 6. Deployment Strategy

### Option A: Cloudflare Pages / Workers (Recommended)
This codebase includes a preconfigured Nitro Cloudflare Worker preset:
```bash
npm run build
npx wrangler deploy
```

### Option B: Docker / Node.js Container
To run as a standalone Node.js server:
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```
