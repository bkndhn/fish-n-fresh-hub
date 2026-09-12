# Universal Retail & Fresh Hub — Enterprise Commerce Suite

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TanStack](https://img.shields.io/badge/TanStack-Router%20%26%20Start-ff4154.svg)](https://tanstack.com/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646cff.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ecf8e.svg)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-134%20Passing-brightgreen.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-Commercial%20Enterprise-gold.svg)](#license)

> **Enterprise-grade, omnichannel multi-branch commerce platform.** High-speed desktop/tablet Point of Sale (POS), real-time Web Serial / WebHID weighing scales, ESC/POS thermal printers, multi-branch inventory isolation, driver GPS tracking, and comprehensive Profit & Loss accounting.

---

## 📚 Complete Developer & Architecture Documentation Suite

This repository is organized according to world-class software engineering standards. Detailed architecture blueprints, developer onboarding manuals, database dictionaries, and API references are available:

| Document | Purpose & Key Topics |
| :--- | :--- |
| 🏛️ **[ARCHITECTURE.md](ARCHITECTURE.md)** | System topology, Nitro edge runtime, multi-tenant & multi-branch RLS isolation, hardware driver subsystems, P&L math models, 0ms caching architecture. |
| 🚀 **[DEVELOPER_HANDOVER_GUIDE.md](DEVELOPER_HANDOVER_GUIDE.md)** | 5-minute setup, complete codebase directory map, extension playbooks (adding routes, tables, server functions), hardware mocking, and troubleshooting. |
| 🗄️ **[DATABASE_DICTIONARY.md](DATABASE_DICTIONARY.md)** | Field-by-field schema reference of all 25+ PostgreSQL tables, constraints, foreign keys, RLS security matrix, and custom stored procedures (RPCs). |
| 🔌 **[API_AND_FUNCTIONS.md](API_AND_FUNCTIONS.md)** | Full catalog of TanStack Start server RPC functions (`*.functions.ts`), client query options (`queries.ts`, `admin.ts`), and hardware custom events. |

---

## ⚡ Core Feature Matrix

### 1. High-Speed Point of Sale (POS) & Counter Billing
- **Trade Weighing Scale Integration**: Connects directly to commercial scales (CAS, Essae Teraoka, Toledo, Avery, Phoenix) via Web Serial and WebHID. Continuous auto-capture stabilizes and registers weights hands-free.
- **ESC/POS Thermal Printing**: Formats and prints 58mm and 80mm receipts via Network TCP, Raw Bluetooth, and Web Serial. Supports dynamic UPI QR codes and vernacular font rasterization.
- **Quick-Code & PLU Numeric Pad**: High-speed lookup by 1-4 digit PLU codes and laser barcode scanners.
- **Offline-First Resilience**: Transactions process locally and synchronize with the database without blocking the cashier.

### 2. Multi-Branch & Multi-Tenant Governance
- **Strict Data Isolation**: PostgreSQL Row-Level Security (RLS) ensures branch managers and cashiers only access their assigned location's data.
- **Super Admin Partitioning**: Super Administrators control tenant lifecycle and enforce branch creation quotas, strictly quarantined from internal client store data.
- **Dynamic Branch Switcher**: Client administrators toggle between branches or view unified platform-wide totals with 0ms transition latency.

### 3. Financial Intelligence & Accounting (P&L)
- **Real-Time Cost of Goods Sold (COGS)**: Automatically linked to inward procurement batches and buying rates.
- **Granular Operating Expenses**: Branch-scoped tracking across Rent, Salaries, Electricity, Logistics, Packaging, and Cold Storage.
- **Shrinkage & Waste Tracking**: Spoilage, cleaning loss, and transit damage logged and deducted from gross margin.
- **Three-Tier GST Tax Engine**: Automated CGST, SGST, and IGST computations, HSN codes, and B2B GST tax invoices.
- **Driver Cash Reconciliation**: End-of-day cash collection settlement tracking and discrepancy auditing.

### 4. Customer Storefront & PWA Experience
- **0ms Instant Navigation**: Eager hover/touch prefetching and native browser View Transitions.
- **Live Order Tracking**: Real-time driver GPS tracking, route display, and secure doorstep 4-digit PIN verification.
- **Portion Selection & Subscriptions**: Custom portion weights (250g, 500g, 1kg) and automated weekly subscriptions with 5% discounts.
- **Installable PWA**: Offline shell caching, Web App Manifest, and mobile safe-area optimization.

---

## 🛠️ Technology Stack Summary

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS v4, Radix UI Primitives, Lucide Icons.
- **Routing & Server**: TanStack Router 1.170, TanStack Start, Nitro Cloudflare Worker engine.
- **State & Caching**: TanStack Query v5 (stale-while-revalidate tiered in-memory caching).
- **Backend & Database**: Supabase (PostgreSQL 15), Supabase Auth, PostgreSQL Realtime WebSockets.
- **Test Suite**: Vitest 5.0 (18 test suites, 134/134 passing tests).

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run test suite
npx vitest run

# 4. Start local development server
npm run dev
```

Open `http://localhost:3000` for the storefront or `http://localhost:3000/admin` for the merchant console.

---

## 📄 License & Commercial Handover

This codebase is proprietary commercial software built for enterprise deployment. All documentation, database schemas, and source code are structured for seamless handover, white-labeling, and client onboarding.
