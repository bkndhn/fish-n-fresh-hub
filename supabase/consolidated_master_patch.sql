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

