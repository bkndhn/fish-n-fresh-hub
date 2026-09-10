-- ==============================================================================
-- MIGRATION: Atomic Stock Hardening, Email Sender Settings & Schema Update
-- ==============================================================================

-- 1. Add Email Sender & Notification Columns to store_settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sender_email TEXT DEFAULT 'orders@fishnfresh.in',
ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT 'Fish N Fresh Hub',
ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_port INT DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_user TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_pass TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN DEFAULT true;

-- 2. Enhanced Atomic Stock Deduction Stored Function
-- Supports both 'product_id' and 'productId' JSON keys, uses row-locking FOR UPDATE
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
    v_deducted_count INT := 0;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items found in order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        -- Safely extract UUID from either 'product_id' or 'productId'
        BEGIN
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_prod_id := NULL;
        END;

        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL AND v_qty > 0 THEN
            -- Row lock the product to guarantee concurrent atomicity
            SELECT stock INTO v_current_stock
            FROM public.products
            WHERE id = v_prod_id
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.products
                SET stock = GREATEST(0, COALESCE(stock, 0) - v_qty),
                    updated_at = NOW()
                WHERE id = v_prod_id;

                v_deducted_count := v_deducted_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'deducted_items', v_deducted_count,
        'message', 'Inventory decremented successfully'
    );
END;
$$;

-- 3. Enhanced Atomic Stock Restoral Stored Function
-- Restores stock on order cancellation or rejection
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
    v_restored_count INT := 0;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items found in order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        BEGIN
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_prod_id := NULL;
        END;

        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL AND v_qty > 0 THEN
            UPDATE public.products
            SET stock = COALESCE(stock, 0) + v_qty,
                updated_at = NOW()
            WHERE id = v_prod_id;

            v_restored_count := v_restored_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'restored_items', v_restored_count,
        'message', 'Inventory restored successfully'
    );
END;
$$;

-- 4. Mark schema version
INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('2.3.0', '20260910180000', 'Hardened atomic stock deduction/restoral and email sender settings')
ON CONFLICT DO NOTHING;
