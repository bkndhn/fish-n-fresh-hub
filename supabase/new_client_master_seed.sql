-- ==============================================================================
-- FISH N FRESH HUB: MASTER SQL SEED FOR NEW CLIENT SUPABASE BACKENDS
-- ==============================================================================
-- Run this script ONCE in your new client's Supabase SQL Editor.
-- It initializes all core tables, RLS policies, indexes, and stored procedures.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Store Settings
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name TEXT DEFAULT 'Fish N Fresh Hub',
    store_phone TEXT DEFAULT '9843061919',
    store_address TEXT DEFAULT 'Main Beach Road, Chennai, Tamil Nadu',
    shop_lat NUMERIC DEFAULT 13.0827,
    shop_lng NUMERIC DEFAULT 80.2707,
    business_vertical TEXT DEFAULT 'seafood',
    upi_id TEXT DEFAULT '9843061919@upi',
    upi_name TEXT DEFAULT 'Fish N Fresh Hub',
    delivery_fee_base NUMERIC DEFAULT 30,
    per_km_charge NUMERIC DEFAULT 10,
    free_delivery_over NUMERIC DEFAULT 500,
    express_delivery_enabled BOOLEAN DEFAULT true,
    express_delivery_fee NUMERIC DEFAULT 25,
    express_sla_mins INTEGER DEFAULT 35,
    wallet_enabled BOOLEAN DEFAULT true,
    max_wallet_burn_percent NUMERIC DEFAULT 50,
    referral_reward_referrer NUMERIC DEFAULT 50,
    referral_reward_referee NUMERIC DEFAULT 50,
    live_alerts_enabled BOOLEAN DEFAULT true,
    harbour_source_name TEXT DEFAULT 'Kasimedu Fish Harbour',
    harbour_alert_title TEXT DEFAULT '🌅 Kasimedu 06:30 AM Boat Landed!',
    harbour_alert_message TEXT DEFAULT 'Fresh Vanjaram, White Prawns, and Snapper just unloaded. 100% chemical-free.',
    printer_paper_width TEXT DEFAULT '58mm',
    printer_auto_cut BOOLEAN DEFAULT true,
    printer_open_drawer BOOLEAN DEFAULT false,
    printer_header_line1 TEXT DEFAULT 'FISH N FRESH HUB',
    printer_header_line2 TEXT DEFAULT 'Fresh Seafood & Meat Superstore',
    printer_footer_text TEXT DEFAULT 'Fresh Catch Daily · No Returns After Cutting',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default store settings if none exists
INSERT INTO public.store_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- 3. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_ta TEXT,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_ta TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC NOT NULL,
    original_mrp NUMERIC,
    unit TEXT DEFAULT 'kg',
    stock NUMERIC DEFAULT 50,
    image_url TEXT,
    description TEXT,
    ai_benefits_summary TEXT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    gst_percent NUMERIC DEFAULT 0,
    gst_included BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Driver Cash Settlements
CREATE TABLE IF NOT EXISTS public.driver_cash_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_number TEXT UNIQUE NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    driver_id UUID,
    amount_collected NUMERIC NOT NULL DEFAULT 0,
    amount_settled NUMERIC NOT NULL DEFAULT 0,
    balance_remaining NUMERIC NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    order_ids UUID[] DEFAULT '{}',
    settled_by_name TEXT,
    settled_by_id UUID,
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE,
    user_id UUID,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    location_lat NUMERIC,
    location_lng NUMERIC,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    delivery_fee NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    gst_amount NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'cod',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    fulfillment_type TEXT NOT NULL DEFAULT 'delivery',
    delivery_date DATE,
    delivery_slot TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    driver_id UUID,
    notes TEXT,
    delivery_note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    cod_settled BOOLEAN DEFAULT false,
    settlement_id UUID REFERENCES public.driver_cash_settlements(id) ON DELETE SET NULL,
    actual_payment_method TEXT,
    actual_payment_ref TEXT,
    paid_to_bank_directly BOOLEAN DEFAULT false,
    pos_cashier_id UUID,
    pos_cashier_name TEXT,
    pos_amount_tendered NUMERIC,
    pos_change_due NUMERIC,
    pos_scale_weight_kg NUMERIC
);

-- 7. Delivery PINs
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID,
    pin_code TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FCM Push Tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    token TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'customer',
    device_type TEXT DEFAULT 'web',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Customer Wallets
CREATE TABLE IF NOT EXISTS public.customer_wallets (
    user_id UUID PRIMARY KEY,
    balance NUMERIC DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Atomic Driver COD Settlement Stored Procedure
CREATE OR REPLACE FUNCTION public.settle_driver_cod_orders_atomic(
    p_driver_name TEXT,
    p_driver_phone TEXT,
    p_driver_id UUID,
    p_order_ids UUID[],
    p_amount_collected NUMERIC,
    p_amount_settled NUMERIC,
    p_balance_remaining NUMERIC,
    p_settled_by_name TEXT,
    p_settled_by_id UUID,
    p_payment_mode TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settlement_id UUID;
    v_settlement_no TEXT;
    v_order_count INT;
    v_locked_count INT;
BEGIN
    v_order_count := cardinality(p_order_ids);
    IF v_order_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No orders provided for settlement');
    END IF;

    -- Row-level mutex lock to prevent concurrent double settlements
    SELECT COUNT(*) INTO v_locked_count
    FROM public.orders
    WHERE id = ANY(p_order_ids)
      AND (cod_settled = true OR settlement_id IS NOT NULL)
    FOR UPDATE;

    IF v_locked_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Conflict: One or more selected orders have already been settled by another cashier.'
        );
    END IF;

    v_settlement_no := 'SETTLE-' || to_char(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    INSERT INTO public.driver_cash_settlements (
        settlement_number, driver_name, driver_phone, driver_id,
        amount_collected, amount_settled, balance_remaining,
        orders_count, order_ids, settled_by_name, settled_by_id,
        payment_mode, notes, settled_at
    )
    VALUES (
        v_settlement_no, p_driver_name, p_driver_phone, p_driver_id,
        p_amount_collected, p_amount_settled, p_balance_remaining,
        v_order_count, p_order_ids, p_settled_by_name, p_settled_by_id,
        p_payment_mode, p_notes, NOW()
    )
    RETURNING id INTO v_settlement_id;

    UPDATE public.orders
    SET cod_settled = true,
        settlement_id = v_settlement_id
    WHERE id = ANY(p_order_ids);

    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', v_settlement_id,
        'settlement_number', v_settlement_no,
        'orders_settled', v_order_count
    );
END;
$$;

-- 11. Enable Row-Level Security
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);
