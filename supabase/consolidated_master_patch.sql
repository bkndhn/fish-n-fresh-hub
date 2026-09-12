-- ==============================================================================
-- FISH N FRESH HUB: ALL-IN-ONE MASTER CONSOLIDATED DATABASE PATCH
-- ==============================================================================
-- This idempotent script safely ensures ALL tables, columns, constraints,
-- indexes, and stored functions required by the entire application exist.
-- Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Schema Version Marker
CREATE TABLE IF NOT EXISTS public.schema_version (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    migration_hash TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('3.0.0', '20260910_master_consolidated', 'Comprehensive full-stack master patch for all features, POS, SEO, and inventory')
ON CONFLICT DO NOTHING;

-- 2b. Categories Table: Ensure Table and All Columns Exist
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT,
    image_url TEXT,
    icon TEXT,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS sort_order NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS slug TEXT;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2c. Branches Table: Ensure Table and All Columns Exist
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT 'HQ',
    slug TEXT NOT NULL DEFAULT 'main-dock',
    address TEXT,
    phone TEXT,
    manager TEXT,
    lat NUMERIC,
    lng NUMERIC,
    open_time TEXT DEFAULT '06:00',
    close_time TEXT DEFAULT '22:00',
    delivery_radius_km NUMERIC NOT NULL DEFAULT 12,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT 'HQ',
ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT 'main-dock',
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS open_time TEXT DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS close_time TEXT DEFAULT '22:00';

GRANT SELECT ON public.branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches public read" ON public.branches;
CREATE POLICY "branches public read" ON public.branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "branches admin write" ON public.branches;
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Products Table: Ensure All Columns Exist
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_custom_qty BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hsn_code TEXT DEFAULT '0302',
ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lab_tested BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS benefits TEXT[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS protein TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS calories NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recipe_title TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recipe_steps TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS name_tamil TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS catch_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS storage TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS traceability TEXT DEFAULT NULL;

-- 4. Store Settings Table: Ensure All Columns Exist
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS custom_domain TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS seo_title_template TEXT DEFAULT '%s | {{store_name}}',
ADD COLUMN IF NOT EXISTS seo_default_description TEXT DEFAULT 'Kasimedu Dock Fresh Seafood & Premium Meat delivered in 35 minutes.',
ADD COLUMN IF NOT EXISTS seo_keywords TEXT DEFAULT 'fresh fish, seer fish, vanjaram, prawns, crab, mutton, chicken, seafood delivery',
ADD COLUMN IF NOT EXISTS seo_og_image TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_site_verification TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bing_site_verification TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS printer_paper_width TEXT DEFAULT '58mm',
ADD COLUMN IF NOT EXISTS printer_auto_cut BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS printer_open_drawer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS printer_header_line1 TEXT DEFAULT 'FISH N FRESH HUB',
ADD COLUMN IF NOT EXISTS printer_header_line2 TEXT DEFAULT 'Premium Fresh Seafood & Meat',
ADD COLUMN IF NOT EXISTS printer_footer_text TEXT DEFAULT 'Thank You! Fresh Catch Guaranteed.',
ADD COLUMN IF NOT EXISTS show_stock_to_customers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS stock_urgency_threshold NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS vertical_badge_text TEXT DEFAULT '100% Sea Fresh',
ADD COLUMN IF NOT EXISTS vertical_tagline TEXT DEFAULT 'Coastal Catch Directly to Your Kitchen',
ADD COLUMN IF NOT EXISTS vertical_banner_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gst_legal_name TEXT DEFAULT 'Fish N Fresh Enterprises',
ADD COLUMN IF NOT EXISTS fssai_license_no TEXT DEFAULT '12423008000123',
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_pos_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_wallet_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_route_optimization_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_live_chat_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_ai_benefits_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_fcm_enabled BOOLEAN DEFAULT true;

-- 5. Orders Table: Ensure All Columns Exist
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS complaint TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS order_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pos_cashier_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pos_cashier_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pos_amount_tendered NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pos_change_due NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pos_scale_weight_kg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settlement_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS actual_payment_method TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS actual_payment_ref TEXT DEFAULT NULL;

-- 6. Support Conversations & Messages Tables
CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    subject TEXT DEFAULT 'General Customer Inquiry',
    status TEXT NOT NULL DEFAULT 'open',
    assigned_staff_id UUID,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL, -- 'customer', 'staff', 'system'
    sender_name TEXT NOT NULL,
    sender_id UUID,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Driver Cash Settlements Table
CREATE TABLE IF NOT EXISTS public.driver_cash_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL,
    driver_name TEXT NOT NULL,
    order_ids UUID[] NOT NULL DEFAULT '{}',
    total_cod_collected NUMERIC NOT NULL,
    cash_handed_over NUMERIC NOT NULL,
    discrepancy NUMERIC NOT NULL DEFAULT 0,
    settlement_status TEXT NOT NULL DEFAULT 'verified',
    received_by_staff_id UUID,
    received_by_staff_name TEXT NOT NULL,
    manager_notes TEXT,
    settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Order Delivery PIN Security Table
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID,
    pin_code TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    verified_at TIMESTAMPTZ,
    verified_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Product AI Marine Benefits Intelligence Table
CREATE TABLE IF NOT EXISTS public.product_ai_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    protein_per_100g TEXT NOT NULL,
    calories_per_100g TEXT NOT NULL,
    omega3_level TEXT NOT NULL,
    cooking_tips JSONB NOT NULL DEFAULT '[]'::jsonb,
    disclaimer TEXT NOT NULL,
    benefits_en JSONB NOT NULL DEFAULT '[]'::jsonb,
    benefits_ta JSONB NOT NULL DEFAULT '[]'::jsonb,
    benefits_hi JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Customer Suspensions Table
CREATE TABLE IF NOT EXISTS public.customer_suspensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL DEFAULT 'Admin suspended',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Atomic Stock Deduction Stored Function
CREATE OR REPLACE FUNCTION public.deduct_order_stock_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_items JSONB;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items found in order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL THEN
            UPDATE public.products
            SET stock = GREATEST(0, stock - v_qty)
            WHERE id = v_prod_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Inventory decremented successfully');
END;
$$;

-- 12. Atomic Stock Restoration Stored Function
CREATE OR REPLACE FUNCTION public.restore_order_stock_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_items JSONB;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items found in order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL THEN
            UPDATE public.products
            SET stock = stock + v_qty
            WHERE id = v_prod_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Inventory restored successfully');
END;
$$;

-- 13. High-Performance Indexing
CREATE INDEX IF NOT EXISTS idx_products_is_available_updated ON public.products (is_available, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_conv ON public.support_messages (conversation_id);

-- 14. Enable Safe Row Level Security
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_cash_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_delivery_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ai_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_suspensions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_conversations' AND policyname = 'Public select support_conversations') THEN
        CREATE POLICY "Public select support_conversations" ON public.support_conversations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_conversations' AND policyname = 'Public insert support_conversations') THEN
        CREATE POLICY "Public insert support_conversations" ON public.support_conversations FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_conversations' AND policyname = 'Public update support_conversations') THEN
        CREATE POLICY "Public update support_conversations" ON public.support_conversations FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_messages' AND policyname = 'Public select support_messages') THEN
        CREATE POLICY "Public select support_messages" ON public.support_messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_messages' AND policyname = 'Public insert support_messages') THEN
        CREATE POLICY "Public insert support_messages" ON public.support_messages FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ai_benefits' AND policyname = 'Public select product_ai_benefits') THEN
        CREATE POLICY "Public select product_ai_benefits" ON public.product_ai_benefits FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ai_benefits' AND policyname = 'Public insert product_ai_benefits') THEN
        CREATE POLICY "Public insert product_ai_benefits" ON public.product_ai_benefits FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ai_benefits' AND policyname = 'Public update product_ai_benefits') THEN
        CREATE POLICY "Public update product_ai_benefits" ON public.product_ai_benefits FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_suspensions' AND policyname = 'Public select customer_suspensions') THEN
        CREATE POLICY "Public select customer_suspensions" ON public.customer_suspensions FOR SELECT USING (true);
    END IF;
END $$;

-- 15. POS Quick Code (PLU) for Counter High-Speed Billing
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pos_code INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_pos_code ON public.products(pos_code) WHERE pos_code IS NOT NULL;

-- Seed unassigned products sequentially based on creation date
WITH ordered_products AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, name ASC) AS seq
  FROM public.products
  WHERE pos_code IS NULL
)
UPDATE public.products p
SET pos_code = op.seq
FROM ordered_products op
WHERE p.id = op.id;

-- 16. Multi-Branch Support & Zero-Downtime Data Isolation
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS fssai_license TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_user_id UUID;

UPDATE public.branches
SET slug = 'chennai-harbour', code = 'CHH', is_default = true
WHERE (name ILIKE '%harbour%' OR name ILIKE '%chennai%') AND slug IS NULL;

UPDATE public.branches
SET slug = 'velachery', code = 'VEL', is_default = false
WHERE (name ILIKE '%velachery%') AND slug IS NULL;

UPDATE public.branches
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')),
    code = UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_slug_unique ON public.branches(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_code_unique ON public.branches(code) WHERE code IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.waste_entries
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.driver_cash_settlements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

DO $$
DECLARE
  v_default_branch_id UUID;
  v_default_branch_name TEXT;
BEGIN
  SELECT id, name INTO v_default_branch_id, v_default_branch_name 
  FROM public.branches 
  WHERE is_default = true 
  LIMIT 1;

  IF v_default_branch_id IS NULL THEN
    SELECT id, name INTO v_default_branch_id, v_default_branch_name 
    FROM public.branches 
    ORDER BY sort_order ASC, created_at ASC 
    LIMIT 1;
  END IF;

  IF v_default_branch_id IS NOT NULL THEN
    UPDATE public.products SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
    UPDATE public.orders SET branch_id = v_default_branch_id, branch_name = COALESCE(branch_name, v_default_branch_name) WHERE branch_id IS NULL;
    UPDATE public.inventory_batches SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
    UPDATE public.purchase_orders SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
    UPDATE public.waste_entries SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
    UPDATE public.customer_subscriptions SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
    UPDATE public.driver_cash_settlements SET branch_id = v_default_branch_id WHERE branch_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON public.orders(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_branch_available ON public.products(branch_id, is_available);
CREATE INDEX IF NOT EXISTS idx_batches_branch_status ON public.inventory_batches(branch_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_waste_branch ON public.waste_entries(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchase_orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_branch ON public.customer_subscriptions(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_branch ON public.user_roles(user_id, branch_id, role);


-- ============================================================================
-- Phase 4: Super Admin Governance Platform & Anti-Impersonation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL DEFAULT 'Fish N Fresh Enterprise',
  tenant_code TEXT NOT NULL UNIQUE DEFAULT 'FNF-MAIN',
  max_branches INTEGER NOT NULL DEFAULT 10,
  max_staff_per_branch INTEGER NOT NULL DEFAULT 15,
  max_monthly_orders INTEGER NOT NULL DEFAULT 25000,
  max_storage_mb INTEGER NOT NULL DEFAULT 5000,
  tier TEXT NOT NULL DEFAULT 'enterprise' CHECK (tier IN ('starter', 'growth', 'enterprise')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.tenant_quotas (tenant_name, tenant_code, max_branches, max_staff_per_branch, max_monthly_orders, max_storage_mb, tier, is_locked)
VALUES ('Fish N Fresh Enterprise', 'FNF-MAIN', 10, 15, 25000, 5000, 'enterprise', false)
ON CONFLICT (tenant_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'branch', 'user')),
  target_id TEXT,
  reason TEXT NOT NULL DEFAULT 'Administrative security revocation',
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revocations_scope_target ON public.platform_revocations(scope, target_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'super_admin',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.platform_audit_logs(action, created_at DESC);

ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS \$\$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
\$\$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS \"Authenticated can view tenant quotas\" ON public.tenant_quotas;
CREATE POLICY \"Authenticated can view tenant quotas\" ON public.tenant_quotas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS \"Super Admin can manage tenant quotas\" ON public.tenant_quotas;
CREATE POLICY \"Super Admin can manage tenant quotas\" ON public.tenant_quotas
  FOR ALL TO authenticated USING (public.is_super_admin() OR public.is_admin_or_super())
  WITH CHECK (public.is_super_admin() OR public.is_admin_or_super());

DROP POLICY IF EXISTS \"Authenticated can view revocations\" ON public.platform_revocations;
CREATE POLICY \"Authenticated can view revocations\" ON public.platform_revocations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS \"Super Admin can issue revocations\" ON public.platform_revocations;
CREATE POLICY \"Super Admin can issue revocations\" ON public.platform_revocations
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR public.is_admin_or_super());

DROP POLICY IF EXISTS \"Super Admin can view audit logs\" ON public.platform_audit_logs;
CREATE POLICY \"Super Admin can view audit logs\" ON public.platform_audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin() OR public.is_admin_or_super());

DROP POLICY IF EXISTS \"Service and super admin can insert audit logs\" ON public.platform_audit_logs;
CREATE POLICY \"Service and super admin can insert audit logs\" ON public.platform_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Universal Retail Verticals Extensions (Electronics, Fashion, Grocery & Mart)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
    ALTER TABLE public.products ADD COLUMN brand TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='model_number') THEN
    ALTER TABLE public.products ADD COLUMN model_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='warranty_period_months') THEN
    ALTER TABLE public.products ADD COLUMN warranty_period_months INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='specifications') THEN
    ALTER TABLE public.products ADD COLUMN specifications JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='aisle_location') THEN
    ALTER TABLE public.products ADD COLUMN aisle_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='variants') THEN
    ALTER TABLE public.products ADD COLUMN variants JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='requires_serial') THEN
    ALTER TABLE public.products ADD COLUMN requires_serial BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_aisle ON public.products(aisle_location) WHERE aisle_location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_requires_serial ON public.products(requires_serial) WHERE requires_serial = true;

-- Operating Expenses & Branch-Isolated P&L Architecture
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'rent_lease',
    'salaries_wages',
    'electricity_utilities',
    'packaging_bags',
    'cold_storage_ice',
    'fuel_logistics',
    'marketing_ads',
    'maintenance_repairs',
    'licenses_taxes',
    'other'
  )),
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque')),
  vendor_name TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON public.expenses(branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
    OR (branch_id IS NULL AND public.get_auth_branch_id() IS NULL)
  );

DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
CREATE POLICY "expenses_insert_policy" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );

DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
CREATE POLICY "expenses_update_policy" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );

DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;
CREATE POLICY "expenses_delete_policy" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );

