/**
 * @fileoverview Core TypeScript Domain Types & Data Contracts
 * @module lib/types
 * 
 * Defines the enterprise data models for Universal Retail Hub, including
 * catalog products, 2D variant matrices, multi-branch partitioning, orders,
 * financial P&L reporting, hardware telemetry, and procurement accounting.
 */

import type { Database } from '@/integrations/supabase/types';
export type SiteSettings = Database['public']['Tables']['store_settings']['Row'] & {
  ordering_mode?: "standard" | "both" | "whatsapp_only" | "catalog_only" | string | null;
  whatsapp_order_phone?: string | null;
  printer_show_gstin?: boolean | null;
  printer_show_fssai?: boolean | null;
  printer_show_address?: boolean | null;
  printer_show_phone?: boolean | null;
  printer_show_whatsapp?: boolean | null;
  printer_show_social?: boolean | null;
  printer_show_support?: boolean | null;
  printer_show_return_policy?: boolean | null;
  printer_custom_footer_message?: string | null;
  printer_whatsapp_number?: string | null;
  printer_social_handle?: string | null;
  shipping_scope_config?: any | null;
};

export type StoreOrderingMode = "standard" | "both" | "whatsapp_only" | "catalog_only";

/**
 * Checks whether GST tax calculation is active for this store.
 * Defaults to true if not explicitly disabled.
 */
export function isGstEnabled(settings?: Partial<SiteSettings> | null): boolean {
  if (!settings) return true;
  return (settings as any).gst_enabled !== false;
}

/**
 * Returns the effective ordering mode for this store:
 * - 'standard': Standard online checkout (default for all existing and upcoming stores)
 * - 'both': Hybrid (both standard checkout and WhatsApp order available)
 * - 'whatsapp_only': Catalog + WhatsApp deep-link order (no payment gateways)
 * - 'catalog_only': Showcase only (browse products, enquire only)
 */
export function getStoreOrderingMode(settings?: Partial<SiteSettings> | null): StoreOrderingMode {
  // If settings explicitly specifies a valid mode other than undefined
  const dbMode = (settings as any)?.ordering_mode;
  if (dbMode === "both" || dbMode === "whatsapp_only" || dbMode === "catalog_only") {
    return dbMode;
  }
  if (dbMode === "standard") {
    // If standard is explicitly in db, check if there is an active local override from recent admin actions
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("fnf_store_ordering_mode") as StoreOrderingMode | null;
      if (local && ["both", "whatsapp_only", "catalog_only"].includes(local)) {
        return local;
      }
    }
    return "standard";
  }
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("fnf_store_ordering_mode") as StoreOrderingMode | null;
    if (local && ["standard", "both", "whatsapp_only", "catalog_only"].includes(local)) {
      return local;
    }
  }
  return "standard";
}

/**
 * Checks whether the Refer & Earn customer program is currently active.
 * Controlled by the client admin in Settings.
 */
export function isReferralProgramActive(settings?: Partial<SiteSettings> | null): boolean {
  if (!settings) return true;
  if ((settings as any).referral_program_enabled === false) return false;
  if (settings.wallet_enabled === false) return false;
  return true;
}

/**
 * 2D Matrix Product Variant for size, color, SKU, and barcode.
 */
export interface ProductVariant {
  id: string;
  size?: string | null;
  color?: string | null;
  sku: string;
  price: number;
  stock: number;
  barcode?: string | null;
}

/**
 * Core Catalog Product Model.
 */
export type Product = {
  id: string;
  name: string;
  name_tamil: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  unit: string;
  category: string | null;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  origin: string | null;
  rating: number;
  is_featured: boolean;
  is_bestseller?: boolean;
  tags: string[] | null;
  calories: number | null;
  protein: string | null;
  best_for: string | null;
  benefits: string[] | null;
  storage: string | null;
  source_origin: string | null;
  lab_tested: boolean;
  traceability: string | null;
  recipe_title: string | null;
  recipe_steps: string | null;
  gst_percent: number;
  gst_included: boolean;
  allow_custom_qty: boolean;
  low_stock_threshold?: number | null;
  pos_code?: number | null;
  branch_id?: string | null;
  branch_name?: string | null;
  cost_price?: number | null;
  // Universal Retail extensions
  brand?: string | null;
  model_number?: string | null;
  warranty_period_months?: number | null;
  specifications?: Record<string, string> | null;
  aisle_location?: string | null;
  variants?: ProductVariant[] | null;
  requires_serial?: boolean;
  // Wholesale (trade buyer) pricing
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  wholesale_tiers?: unknown;
};

/**
 * Operational Expense Classification Categories.
 */
export type ExpenseCategory =
  | "rent_lease"
  | "salaries_wages"
  | "electricity_utilities"
  | "packaging_bags"
  | "cold_storage_ice"
  | "fuel_logistics"
  | "marketing_ads"
  | "maintenance_repairs"
  | "licenses_taxes"
  | "other";

/**
 * Operational Expense Record Model.
 */
export interface Expense {
  id: string;
  branch_id?: string | null;
  branch_name?: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  vendor_name?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * Aggregated Profit & Loss Financial Statement Summary.
 */
export interface PnlSummary {
  grossSales: number;
  discounts: number;
  netSales: number;
  gstCollected: number;
  totalCogs: number;
  totalWasteCost: number;
  totalProductionCost: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  netProfit: number;
  netMarginPct: number;
  orderCount: number;
  unitsSold: number;
}

/**
 * Per-Product Margin and COGS Analytics Item.
 */
export interface ProductPnlItem {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  unit: string;
  stock: number;
  sellingPrice: number;
  costPrice: number;
  unitsSold: number;
  revenue: number;
  cogs: number;
  wasteQty: number;
  wasteCost: number;
  grossProfit: number;
  marginPct: number;
  profitSharePct: number;
  tier: "high_profit" | "healthy" | "slim" | "loss_making";
}

/**
 * Product Category Hierarchy Model.
 */
export type Category = {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
};

/**
 * Storefront Promotional Banner Model.
 */
export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link: string | null;
  cta: string | null;
  active: boolean;
  sort_order: number;
};

/**
 * Active Shopping Cart Line Item.
 */
export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  qty: number;
  cut_preference?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  // Universal Retail additions
  serial_numbers?: string[] | null;
  variant?: { id?: string; size?: string; color?: string; sku?: string } | null;
  brand?: string | null;
  warranty_months?: number | null;
  aisle_location?: string | null;
  // Wholesale (trade buyer) pricing snapshot, used to resolve bulk rates
  retail_price?: number | null;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  wholesale_tiers?: unknown;
};

/**
 * Harbor / Wholesale Procurement Supplier Model.
 */
export type Supplier = {
  id: string;
  name: string;
  harbour?: string | null;
  contact_person?: string | null;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  gstin?: string | null;
  upi_id?: string | null;
  bank_details?: string | null;
  balance_due?: number;
  created_at?: string;
};

/**
 * Purchase Order Item Line.
 */
export type PurchaseItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  total_cost: number;
};

/**
 * Inward Procurement Purchase Order Record.
 */
export type PurchaseOrder = {
  id: string;
  reference_no: string;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  inward_date: string;
  items: PurchaseItem[];
  total_amount: number;
  paid_amount: number;
  payment_status: "paid" | "partial" | "pending";
  payment_method: "cash" | "upi" | "bank" | "credit";
  notes?: string | null;
  created_at?: string;
};

/**
 * Supplier Payment Transaction Audit.
 */
export type SupplierPaymentRecord = {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  po_id?: string | null;
  po_reference?: string | null;
  payment_date: string;
  amount: number;
  payment_mode: "full" | "partial";
  payment_method: "cash" | "upi" | "bank" | "cheque";
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
};

/**
 * Shrinkage & Spoilage Waste Log.
 */
export type WasteEntry = {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: "spoilage" | "trimming_loss" | "transit_damage" | "customer_return" | "other";
  cost_loss: number;
  notes?: string | null;
  logged_by?: string | null;
  created_at?: string;
};

/**
 * Customer Loyalty Wallet Balance.
 */
export type CustomerWallet = {
  user_id: string;
  balance: number;
  referral_code: string;
  referred_by?: string | null;
  total_earned: number;
  total_redeemed: number;
  created_at?: string;
  updated_at?: string;
};

/**
 * Wallet Credit/Debit Audit Record.
 */
export type WalletTransaction = {
  id: string;
  wallet_id: string;
  amount: number;
  type: "referral_bonus" | "signup_bonus" | "cashback" | "order_redemption" | "admin_adjustment";
  description: string | null;
  order_id?: string | null;
  created_at: string;
};

/**
 * Multi-Language AI Health & Culinary Intelligence.
 */
export type ProductAiBenefits = {
  id?: string;
  product_id: string;
  product_name: string;
  omega3_level: string;
  protein_per_100g: string;
  calories_per_100g: string;
  benefits_en: string[];
  benefits_ta: string[];
  benefits_hi: string[];
  cooking_tips: string[];
  disclaimer: string;
  generated_at?: string;
  model_used?: string;
};

/**
 * Real-time Catch Alert Broadcast Announcement.
 */
export type CatchBroadcast = {
  id: string;
  title: string;
  message: string;
  harbour_source: string;
  target_category?: string | null;
  is_active: boolean;
  sent_by?: string | null;
  sent_at: string;
};

/**
 * FCM Push Notification Device Token.
 */
export type FcmToken = {
  id?: string;
  user_id?: string | null;
  token: string;
  role: "customer" | "driver" | "staff" | "admin";
  device_type: "web" | "android" | "ios";
  created_at?: string;
  updated_at?: string;
};

/**
 * End-of-Day Driver & Cashier Cash Settlement Ledger.
 */
export type DriverCashSettlement = {
  id: string;
  settlement_number: string;
  driver_name: string;
  driver_phone?: string | null;
  driver_id?: string | null;
  amount_collected: number;
  amount_settled: number;
  balance_remaining: number;
  orders_count: number;
  order_ids: string[];
  settled_by_name: string;
  settled_by_id?: string | null;
  payment_mode: "cash" | "counter_upi" | "bank_transfer" | string;
  notes?: string | null;
  settled_at: string;
  created_at?: string;
};

/**
 * Multi-Branch Operational Hub Location.
 */
export interface BranchLocation {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  delivery_radius_km: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at?: string;
}

/**
 * Three-Tier GST Breakdown Model.
 */
export interface GstTaxBreakdown {
  taxableAmount: number;
  gstRate: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
}
