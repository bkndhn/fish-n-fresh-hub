-- ==============================================================================
-- MIGRATION: Commercial Hardening, Atomic Stock, Support Chat & Version Marker
-- ==============================================================================

-- 1. Database Schema Version Marker
CREATE TABLE IF NOT EXISTS public.schema_version (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    migration_hash TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('2.2.0', '20260909190000', 'Commercial hardening: atomic stock sync, support chat, tax invoice, and feature flags');

-- 2. Add Cost Price to Products (for Gross Profit & Margin calculation)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hsn_code TEXT DEFAULT '0302';

-- 3. Add Feature Flags & Legal Fields to Store Settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS feature_pos_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_wallet_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_route_optimization_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_live_chat_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_ai_benefits_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_fcm_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gst_legal_name TEXT DEFAULT 'Fish N Fresh Enterprises',
ADD COLUMN IF NOT EXISTS fssai_license_no TEXT DEFAULT '12423008000123',
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

-- 4. Customer Support Chat Tables
CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    subject TEXT DEFAULT 'General Customer Inquiry',
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
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

-- Enable RLS on support tables
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select support_conversations" ON public.support_conversations FOR SELECT USING (true);
CREATE POLICY "Allow public insert support_conversations" ON public.support_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update support_conversations" ON public.support_conversations FOR UPDATE USING (true);

CREATE POLICY "Allow public select support_messages" ON public.support_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert support_messages" ON public.support_messages FOR INSERT WITH CHECK (true);

-- 5. Atomic Stock Deduction Stored Function
CREATE OR REPLACE FUNCTION public.deduct_order_stock_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_current_stock NUMERIC;
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

-- 6. Atomic Stock Restoral Stored Function (On Order Cancellation)
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

-- 7. Campaign & Promotional Automation Rules Table
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'flash_sale', -- 'flash_sale', 'cart_rule', 'ab_test'
    variant_a_code TEXT,
    variant_b_code TEXT,
    variant_a_orders INT DEFAULT 0,
    variant_b_orders INT DEFAULT 0,
    banner_text TEXT,
    countdown_end TIMESTAMPTZ,
    min_cart_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read marketing_campaigns" ON public.marketing_campaigns FOR SELECT USING (true);
CREATE POLICY "Public insert marketing_campaigns" ON public.marketing_campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update marketing_campaigns" ON public.marketing_campaigns FOR UPDATE USING (true);
CREATE POLICY "Public delete marketing_campaigns" ON public.marketing_campaigns FOR DELETE USING (true);
